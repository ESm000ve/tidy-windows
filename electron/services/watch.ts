/**
 * The watched folder: tidy new files in the source folder as they arrive.
 *
 * Only files that appear after watching starts are considered. A file is moved
 * once it has stopped changing for a few seconds and no longer has a
 * browser's in-progress download name, so half-finished downloads stay put.
 * Each batch runs through the normal organizer with the current rules and is
 * recorded in the run history, so it can be undone.
 */
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import type { OrganizeRequest, RunResult } from "../types";
import { runOrganizeJob, setRestoreListener } from "./organizer";
import { walkSourceFiles } from "../lib/files";

/** How long a file must stay unchanged before it is moved. */
const SETTLE_MS = 5000;

/** How often pending files are checked. */
const POLL_MS = 1500;

/** In-progress download and temporary-file names used by browsers and Office. */
const TEMPORARY_NAME = /\.(crdownload|part|partial|download|opdownload|tmp|temp)$|^~\$|^\./i;

const identity = (value: string) => (process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value));

interface Pending {
  size: number;
  mtimeMs: number;
  /** When the size and modified time last changed. */
  stableSince: number;
}

let watcher: fs.FSWatcher | null = null;
let timer: NodeJS.Timeout | null = null;
let config: OrganizeRequest | null = null;
let excluded: string[] = [];
const pending = new Map<string, Pending>();
const known = new Set<string>();
let generation = 0;
let onStopped: (() => void) | null = null;

export function setWatchStoppedListener(listener: () => void): void { onStopped = listener; }

let onBatch: ((request: OrganizeRequest, result: RunResult) => void) | null = null;

/** Register what happens after each watched batch (history, notification). */
export function setWatchBatchListener(listener: (request: OrganizeRequest, result: RunResult) => void): void {
  onBatch = listener;
}

setRestoreListener((paths) => {
  for (const filePath of paths) {
    known.add(identity(filePath));
  }
});

export function isWatching(): boolean {
  return watcher !== null;
}

/** Stop watching and forget pending files. */
export function stopWatching(): void {
  generation += 1;
  watcher?.close();
  watcher = null;
  if (timer) clearInterval(timer);
  timer = null;
  pending.clear();
  known.clear();
  config = null;
}

/**
 * Start (or restart) watching with the given settings. Returns an error
 * message when the folder cannot be watched.
 */
export async function startWatching(request: OrganizeRequest): Promise<string | null> {
  stopWatching();
  const currentGeneration = generation;
  if (!request.sourcePath || !request.destPath) return "Choose a source and destination folder to watch.";
  const source = path.resolve(request.sourcePath);
  if (identity(source) === identity(request.destPath)) {
    return "Choose a destination different from the watched source folder.";
  }
  try {
    excluded = [identity(request.destPath)];
    // Establish the baseline before accepting events: editing an existing file
    // must never turn it into a new arrival. Links and output are excluded.
    for await (const file of walkSourceFiles(source, { includeSubfolders: request.includeSubfolders === true, destPath: request.destPath, excludeHidden: true })) {
      if (currentGeneration !== generation) return null;
      known.add(identity(file.path));
    }
    if (currentGeneration !== generation) return null;
    watcher = fs.watch(source, { recursive: request.includeSubfolders === true }, (_event, filename) => {
      if (filename && currentGeneration === generation) consider(path.join(source, filename.toString()));
    });
  } catch (error) {
    console.error("Could not watch the source folder.", error);
    watcher = null;
    return "Tidy could not watch the source folder. Check that it still exists.";
  }
  watcher.on("error", (error) => {
    if (currentGeneration !== generation) return;
    console.error("Watched folder stopped.", error);
    stopWatching();
    onStopped?.();
  });
  config = { ...request, sourcePath: source };
  timer = setInterval(() => void checkPending(), POLL_MS);
  return null;
}

function consider(filePath: string): void {
  const name = path.basename(filePath);
  if (TEMPORARY_NAME.test(name)) return;
  const id = identity(filePath);
  if (excluded.some((prefix) => id === prefix || id.startsWith(prefix + path.sep))) return;
  if (id.split(path.sep).includes(".tidy undo")) return;
  if (known.has(id)) return;
  if (!pending.has(filePath)) pending.set(filePath, { size: -1, mtimeMs: -1, stableSince: Date.now() });
}

let checking = false;

async function checkPending(): Promise<void> {
  if (checking || !config || pending.size === 0) return;
  checking = true;
  const currentGeneration = generation;
  const currentConfig = config;
  try {
    const now = Date.now();
    const ready: string[] = [];
    for (const [filePath, state] of pending) {
      let stats: fs.Stats;
      try {
        stats = await fsp.lstat(filePath);
      } catch {
        pending.delete(filePath); // Renamed or removed.
        continue;
      }
      if (!stats.isFile()) {
        pending.delete(filePath);
        continue;
      }
      if (known.has(identity(filePath))) { pending.delete(filePath); continue; }
      if (stats.size !== state.size || stats.mtimeMs !== state.mtimeMs) {
        pending.set(filePath, { size: stats.size, mtimeMs: stats.mtimeMs, stableSince: now });
      } else if (now - state.stableSince >= SETTLE_MS) {
        ready.push(filePath);
      }
    }
    if (ready.length === 0 || currentGeneration !== generation) return;
    const request: OrganizeRequest = { ...currentConfig, renames: undefined, onlyPaths: ready };
    const result = await runOrganizeJob(request);
    // A busy organizer leaves the files pending for the next check.
    if (!result.success && result.error?.startsWith("Tidy is already")) return;
    if (currentGeneration === generation) {
      for (const filePath of ready) {
        pending.delete(filePath);
        // Failed/ineligible files remain for explicit manual handling. A file
        // moved successfully may arrive again under the same name later.
        if (fs.existsSync(filePath)) known.add(identity(filePath));
      }
    }
    // A run already in flight still needs history if settings changed meanwhile.
    onBatch?.(request, result);
  } finally {
    checking = false;
  }
}
