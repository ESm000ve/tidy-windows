/**
 * The organize run: the only code in the app that moves the user's files.
 *
 * Two invariants hold throughout. Every completed move is appended to
 * `operations` before the next file is touched. Completed runs can be
 * reversed; this is not a crash recovery journal. And a failure on one file is logged and counted, never
 * thrown — one unreadable file must not abandon the other nine hundred.
 */
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildExtensionMap,
  fingerprintFile,
  findAvailablePath,
  moveFile,
  passesFilters,
  validatePathSegment,
  walkSourceFiles,
  type SourceFile,
} from "../lib/files";
import type {
  AcceptedRename,
  Operation,
  OrganizeRequest,
  RunCallbacks,
  RunResult,
} from "../types";
import { dateFolderSegments } from "../../src/shared/dateFolders";

/** Files between progress reports. Reporting per file floods the IPC channel. */
const PROGRESS_INTERVAL = 10;

/** Where duplicates go when the conflict policy is "archive". */
const DUPLICATES_FOLDER = "Duplicates_Archive";

/** Where low-confidence AI renames go, for the user to check before filing. */
const REVIEW_FOLDER = "Review";

/** Renames the model was unsure about are quarantined rather than applied blind. */
const REVIEW_CONFIDENCE = new Set(["low", "medium"]);
/** Where "Replace existing" keeps replaced files. Must match `BACKUP_FOLDER` in ./backups. */
const BACKUP_FOLDER_NAME = ".Tidy Undo";

const pathIdentity = (value: string) => (process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value));

let fileJobActive = false;
let undoGuard: ((operations: Operation[]) => string | undefined) | null = null;

export function setUndoGuard(guard: (operations: Operation[]) => string | undefined): void {
  undoGuard = guard;
}

/** Called with the paths Undo put back, so the watched folder can ignore them. */
let restoreListener: ((paths: string[]) => void) | null = null;
export function setRestoreListener(listener: ((paths: string[]) => void) | null): void {
  restoreListener = listener;
}

/** True while a run, Undo, or backup cleanup is touching files. */
export function isFileJobActive(): boolean {
  return fileJobActive;
}

/**
 * Run `task` while holding the file lock, or return `null` without running it
 * when another job holds it.
 */
export async function withFileLock<T>(task: () => Promise<T>): Promise<T | null> {
  if (fileJobActive) return null;
  fileJobActive = true;
  try { return await task(); }
  finally { fileJobActive = false; }
}

/** Manual runs, schedules, and Undo must never move the same files concurrently. */
export async function runOrganizeJob(request: OrganizeRequest, callbacks: RunCallbacks = {}): Promise<RunResult> {
  return (await withFileLock(() => organizeFiles(request, callbacks)))
    ?? { success: false, error: "Tidy is already moving or restoring files. Wait for it to finish." };
}

/** Accept both the object form and a bare replacement string. */
function readRename(entry: AcceptedRename | string | undefined) {
  if (!entry) return null;
  if (typeof entry === "string") return { suggested: entry, confidence: undefined, subfolder: undefined };
  return { suggested: entry.suggested, confidence: entry.confidence, subfolder: entry.subfolder };
}

/**
 * Move every matching file from the source folder into the destination,
 * filing it by category and, optionally, by content type.
 *
 * @param request   Source, destination, rules, filters, and accepted renames.
 * @param callbacks Progress and log sinks. Omitted for scheduled runs, which
 *                  have no window to report to.
 */
async function organizeFiles(
  request: OrganizeRequest,
  { onProgress, onLog }: RunCallbacks = {},
): Promise<RunResult> {
  const { sourcePath, destPath, categories, filters, conflictResolution, renames } = request;
  const log = (level: Parameters<NonNullable<RunCallbacks["onLog"]>>[0], message: string) =>
    onLog?.(level, message);

  if (!sourcePath || !destPath) {
    log("error", "Source or destination path missing");
    return { success: false, error: "Source or destination path missing" };
  }

  try {
    log("info", `Scan started — ${sourcePath}`);
    // Finish enumeration before moving anything. An unreadable subtree cannot
    // leave an unreported partial traversal or include freshly produced output.
    const files: SourceFile[] = [];
    for await (const file of walkSourceFiles(sourcePath, { includeSubfolders: request.includeSubfolders === true, selectedSourceFolders: request.selectedSourceFolders, selectedFileExtensions: request.selectedFileExtensions, destPath, excludeHidden: filters.excludeHidden })) files.push(file);
    if (request.onlyPaths) {
      const wanted = new Set(request.onlyPaths.map(pathIdentity));
      const selected = files.filter((file) => wanted.has(pathIdentity(file.path)));
      files.length = 0;
      files.push(...selected);
    }
    log("info", "Found " + files.length + " source files to process");

    const extensionMap = buildExtensionMap(categories, { enabledOnly: true });
    const seenFingerprints = new Set<string>();
    // Only files that share a size with another candidate can be duplicates, so
    // only those are read and hashed. Counted before anything moves.
    const sizeCounts = new Map<number, number>();
    for (const file of files) {
      const rule = extensionMap.get(path.extname(file.name).toLowerCase());
      if (!rule?.duplicateDetection || !passesFilters(file.stats, file.name, filters)) continue;
      sizeCounts.set(file.stats.size, (sizeCounts.get(file.stats.size) ?? 0) + 1);
    }
    const operations: Operation[] = [];
    const backupDirectory = path.join(destPath, BACKUP_FOLDER_NAME, randomUUID());

    let moved = 0;
    let renamed = 0;
    let duplicates = 0;
    let errors = 0;

    for (const [index, file] of files.entries()) {
      const { name: filename, path: sourceFile, relativePath } = file;

      try {
        const stats = await fsp.lstat(sourceFile);
        if (!stats.isFile()) continue;
        if (!passesFilters(stats, filename, filters)) continue;

        const extension = path.extname(filename).toLowerCase();
        const rule = extensionMap.get(extension);
        if (!rule) continue;

        let isDuplicate = false;
        if (rule.duplicateDetection && (sizeCounts.get(stats.size) ?? 0) > 1) {
          try {
            const fingerprint = await fingerprintFile(sourceFile, stats.size);
            isDuplicate = seenFingerprints.has(fingerprint);
            if (isDuplicate) duplicates += 1;
            else seenFingerprints.add(fingerprint);
          } catch (error) {
            console.warn(`Could not fingerprint ${filename}; treating it as unique.`, error);
          }
        }

        if (isDuplicate && conflictResolution === "skip") {
          log("warn", `Skipped duplicate: ${filename}`);
          continue;
        }

        let targetFilename = filename;
        let targetDirectory: string;

        if (isDuplicate && conflictResolution === "archive") {
          targetDirectory = path.join(destPath, DUPLICATES_FOLDER);
          log("warn", `${filename} is a duplicate, moving to ${DUPLICATES_FOLDER}`);
        } else {
          const rename = readRename(renames?.[relativePath]);
          let needsReview = false;

          if (rename) {
            targetFilename = validatePathSegment(rename.suggested);
            needsReview = REVIEW_CONFIDENCE.has(String(rename.confidence));
          }

          if (needsReview) {
            targetDirectory = path.join(destPath, REVIEW_FOLDER);
          } else {
            targetDirectory = path.join(destPath, validatePathSegment(rule.name));
            if (rule.subfolders || rule.smartCategorization) {
              const semantic = rule.smartCategorization ? rename?.subfolder : undefined;
              targetDirectory = path.join(
                targetDirectory,
                validatePathSegment(semantic || extension.slice(1) || "no_extension"),
              );
            }
            targetDirectory = path.join(targetDirectory, ...dateFolderSegments(stats.mtimeMs, rule.dateFolders));
          }
        }

        await fsp.mkdir(targetDirectory, { recursive: true });

        // Resolve a name collision at the destination according to the policy:
        // "rename" finds a free name, "skip" leaves the file where it is, and
        // "overwrite" preserves the replaced file so Undo can restore it.
        let targetPath = path.join(targetDirectory, targetFilename);
        if (path.resolve(sourceFile).toLowerCase() === path.resolve(targetPath).toLowerCase()) continue;
        if (fs.existsSync(targetPath)) {
          if (conflictResolution === "skip") {
            log("warn", `Skipped ${filename} — a file of that name is already filed`);
            continue;
          }
          if (conflictResolution === "rename" || conflictResolution === "archive") {
            targetPath = findAvailablePath(targetDirectory, targetFilename);
          } else if (conflictResolution === "overwrite") {
            const existing = await fsp.lstat(targetPath);
            if (!existing.isFile()) throw new Error("The destination name belongs to a folder or link.");
            await fsp.mkdir(backupDirectory, { recursive: true });
            const backupPath = findAvailablePath(backupDirectory, targetFilename);
            await moveFile(targetPath, backupPath);
            operations.push({ id: randomUUID(), originalPath: targetPath, newPath: backupPath, originalName: targetFilename, newName: path.basename(backupPath) });
            log("info", `Preserved replaced file in .Tidy Undo: ${targetFilename}`);
          }
        }

        if (path.resolve(sourceFile).toLowerCase() === path.resolve(targetPath).toLowerCase()) continue;
        await moveFile(sourceFile, targetPath);

        operations.push({
          id: randomUUID(),
          originalPath: sourceFile,
          newPath: targetPath,
          originalName: filename,
          newName: path.basename(targetPath),
        });
        moved += 1;
        if (targetFilename !== filename) renamed += 1;

        log(
          "info",
          targetFilename === filename
            ? `Moved ${filename} → ${rule.name}/`
            : `Renamed ${filename} → ${targetFilename} and moved to ${rule.name}/`,
        );
      } catch (error) {
        log("error", `Failed to process ${filename}`);
        console.error(`Failed to process ${filename}:`, error);
        errors += 1;
      }

      if (index % PROGRESS_INTERVAL === 0 || index === files.length - 1) {
        onProgress?.(Math.floor(((index + 1) / files.length) * 100));
      }
    }

    onProgress?.(100);
    log(errors ? "warn" : "success", errors ? `Run finished with ${errors} error(s). Review the log.` : "Run completed — changes recorded for undo");
    return { success: true, moved, renamed, duplicates, errors, operations };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log("error", `Organization error: ${message}`);
    console.error("Organization run failed.", error);
    return { success: false, error: message };
  }
}

/**
 * Reverse a run by moving each file back to where it came from.
 *
 * Operations are replayed newest-first so a file moved twice lands back at its
 * true origin. A file the user has since deleted or moved themselves is skipped
 * rather than treated as a failure.
 */
export async function undoOperations(operations: Operation[]) {
  return (await withFileLock(() => restoreOperations(operations)))
    ?? { success: false, reverted: 0, errors: operations.length, remainingOperations: operations, error: "Tidy is already moving or restoring files. Wait for it to finish." };
}

async function restoreOperations(operations: Operation[]) {
  const blocked = undoGuard?.(operations);
  if (blocked) return { success: false, reverted: 0, errors: operations.length, remainingOperations: operations, error: blocked };
  let reverted = 0;
  let errors = 0;
  const remainingOperations: Operation[] = [];
  const restored: string[] = [];
  const blockedPaths = new Set<string>();
  const identity = (filePath: string) => process.platform === "win32" ? path.resolve(filePath).toLowerCase() : path.resolve(filePath);
  const defer = (operation: Operation) => {
    errors += 1;
    remainingOperations.unshift(operation);
    blockedPaths.add(identity(operation.originalPath));
    blockedPaths.add(identity(operation.newPath));
  };

  for (const operation of [...operations].reverse()) {
    try {
      // Replacement backups can share paths with older moves. If a newer
      // reversal is blocked, do not restore the wrong version through that path.
      if (!fs.existsSync(operation.newPath)) continue;
      if (blockedPaths.has(identity(operation.originalPath)) || blockedPaths.has(identity(operation.newPath))) { defer(operation); continue; }
      if (fs.existsSync(operation.originalPath)) {
        defer(operation);
        continue;
      }
      await moveFile(operation.newPath, operation.originalPath);
      restored.push(operation.originalPath);
      reverted += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && !fs.existsSync(operation.newPath)) continue;
      console.error(`Could not revert ${operation.newPath}:`, error);
      defer(operation);
    }
  }

  if (restored.length) restoreListener?.(restored);
  return { success: errors === 0, reverted, errors, remainingOperations };
}
