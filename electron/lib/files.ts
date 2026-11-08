/**
 * Filesystem helpers shared by the preview scan and the organize run.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CategoryRule, RunFilters } from "../types";

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Age limits, in days, for each `dateModified` filter. */
const MAX_AGE_DAYS: Record<Exclude<RunFilters["dateModified"], "any">, number> = {
  today: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** Hash the complete file in bounded chunks; shared headers are not duplicates. */
export async function fingerprintFile(filePath: string, sizeInBytes: number): Promise<string> {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return `${sizeInBytes}:${hash.digest("hex")}`;
}

/**
 * Finds files whose complete contents match an earlier file.
 *
 * Files can only be identical if their sizes match, so a file is hashed only
 * once a second file of the same size turns up. Most files in a typical folder
 * have a unique size and are never read. Earlier files must still be at the
 * path they were checked with, which holds for the preview (nothing moves).
 */
export class DuplicateFinder<T> {
  private readonly unhashed = new Map<number, { path: string; value: T }[]>();
  private readonly hashedSizes = new Set<number>();
  private readonly originals = new Map<string, T>();

  /** Return the earlier identical file's value, or `undefined` if this file is the first. */
  async check(filePath: string, sizeInBytes: number, value: T): Promise<T | undefined> {
    const waiting = this.unhashed.get(sizeInBytes);
    if (!waiting && !this.hashedSizes.has(sizeInBytes)) {
      this.unhashed.set(sizeInBytes, [{ path: filePath, value }]);
      return undefined;
    }
    if (waiting) {
      this.unhashed.delete(sizeInBytes);
      this.hashedSizes.add(sizeInBytes);
      for (const earlier of waiting) {
        try {
          const fingerprint = await fingerprintFile(earlier.path, sizeInBytes);
          if (!this.originals.has(fingerprint)) this.originals.set(fingerprint, earlier.value);
        } catch (error) {
          // An unreadable file is simply not compared.
          console.warn(`Could not fingerprint ${earlier.path}.`, error);
        }
      }
    }
    const fingerprint = await fingerprintFile(filePath, sizeInBytes);
    const original = this.originals.get(fingerprint);
    if (original !== undefined) return original;
    this.originals.set(fingerprint, value);
    return undefined;
  }
}

/** Format a byte count the way the preview sheet displays it. */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/** Replace the user's home directory with `~` for display. */
export function abbreviateHome(fullPath: string): string {
  const home = os.homedir();
  return home && fullPath.startsWith(home) ? `~${fullPath.slice(home.length)}` : fullPath;
}

/**
 * Build a lookup from `.ext` to the rule that claims it.
 *
 * When two rules list the same extension the later one wins, matching the
 * order the user sees in the rules grid.
 */
export function buildExtensionMap(
  categories: CategoryRule[],
  { enabledOnly = false } = {},
): Map<string, CategoryRule> {
  const map = new Map<string, CategoryRule>();
  for (const category of categories) {
    if (enabledOnly && !category.enabled) continue;
    for (const extension of category.extensions) {
      const normalized = (extension.startsWith(".") ? extension : `.${extension}`).toLowerCase();
      map.set(normalized, category);
    }
  }
  return map;
}

/** True when a file passes the run's date and size filters. */
export function passesFilters(stats: fs.Stats, filename: string, filters: RunFilters): boolean {
  if (filters.excludeHidden && filename.startsWith(".")) return false;

  if (filters.dateModified !== "any") {
    const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (ageInDays > MAX_AGE_DAYS[filters.dateModified]) return false;
  }

  if (filters.fileSize !== "any") {
    const { size } = stats;
    if (filters.fileSize === "small" && size >= BYTES_PER_MB) return false;
    if (filters.fileSize === "medium" && (size < BYTES_PER_MB || size > 100 * BYTES_PER_MB)) {
      return false;
    }
    if (filters.fileSize === "large" && size <= 100 * BYTES_PER_MB) return false;
  }

  return true;
}

/**
 * Find a free path in `directory` for `filename`, appending " (1)", " (2)", …
 * until nothing is in the way.
 */
export function findAvailablePath(directory: string, filename: string): string {
  let candidate = path.join(directory, filename);
  if (!fs.existsSync(candidate)) return candidate;

  const extension = path.extname(filename);
  const base = path.basename(filename, extension);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${base} (${counter})${extension}`);
    counter += 1;
  }
  return candidate;
}

/**
 * Move a file, falling back to copy-then-delete across filesystem boundaries.
 *
 * `rename(2)` fails with `EXDEV` when the source and destination live on
 * different volumes, which is common when organizing from an external drive.
 */
export async function moveFile(from: string, to: string): Promise<void> {
  try {
    await fsp.rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await fsp.copyFile(from, to);
    await fsp.unlink(from);
  }
}

/** Validate a single user/AI-supplied name before joining it to a directory. */
export function validatePathSegment(name: string, platform: NodeJS.Platform = process.platform): string {
  if (!name || name === "." || name === ".." || /[\\/\x00]/.test(name)) throw new Error("Invalid file or folder name");
  if (platform === "win32" && (/[<>:"|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name))) {
    throw new Error("This file or folder name is not supported by Windows: " + name);
  }
  return name;
}

/** A stable source-relative identity keeps same-named nested files separate. */
export interface SourceFile {
  path: string;
  relativePath: string;
  name: string;
  stats: fs.Stats;
}
export interface SourceScanOptions {
  includeSubfolders?: boolean;
  selectedSourceFolders?: string[] | null;
  selectedFileExtensions?: string[] | null;
  destPath?: string;
  excludeHidden?: boolean;
  onDirectory?: (relativePath: string) => void;
  /** Visit folders only; files are not examined or yielded. */
  directoriesOnly?: boolean;
}

/** Enumerate files without following links or revisiting the destination/Undo backups. */
export async function* walkSourceFiles(sourcePath: string, options: SourceScanOptions = {}): AsyncGenerator<SourceFile> {
  const source = await fsp.realpath(sourcePath);
  const identity = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  let destination: string | undefined;
  if (options.destPath) {
    try { destination = await fsp.realpath(options.destPath); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; destination = path.resolve(options.destPath); }
  }
  if (options.includeSubfolders && destination && identity(source) === identity(destination)) {
    throw new Error("When including subfolders, choose a destination different from the source folder.");
  }
  const selected = options.includeSubfolders && options.selectedSourceFolders != null
    ? new Set(options.selectedSourceFolders.map(folder => identity(path.resolve(source, folder)))) : null;
  const extensions = !options.includeSubfolders || options.selectedFileExtensions == null ? null : new Set(options.selectedFileExtensions.map(ext => ext.replace(/^\./, "").toLowerCase()));
  async function* walk(directory: string): AsyncGenerator<SourceFile> {
    options.onDirectory?.(path.relative(source, directory) || ".");
    const entries = (await fsp.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (destination && identity(fullPath) === identity(destination)) continue;
      if (entry.isDirectory()) {
        if (!options.includeSubfolders || entry.name.toLowerCase() === ".tidy undo" || (options.excludeHidden && entry.name.startsWith("."))) continue;
        const stats = await fsp.lstat(fullPath);
        if (!stats.isDirectory() || stats.isSymbolicLink()) continue;
        if (selected && ![...selected].some(folder => folder === identity(fullPath) || folder.startsWith(identity(fullPath) + path.sep))) continue;
        yield* walk(fullPath);
      } else if (entry.isFile()) {
        if (options.directoriesOnly) continue;
        if (selected && !selected.has(identity(directory))) continue;
        if (extensions && !extensions.has(path.extname(entry.name).slice(1).toLowerCase())) continue;
        const stats = await fsp.lstat(fullPath);
        if (stats.isFile() && !stats.isSymbolicLink()) yield { path: fullPath, relativePath: path.relative(source, fullPath), name: entry.name, stats };
      }
    }
  }
  yield* walk(source);
}
