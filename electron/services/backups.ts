/**
 * The `.Tidy Undo` folders where "Replace existing" keeps the files it
 * replaced. They are never removed automatically; the user cleans them up from
 * the Activity Log, and they go to the Recycle Bin rather than being deleted.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";
import { shell } from "electron";
import { forgetPathsUnder, historyDestinations } from "./history";
import { withFileLock } from "./organizer";

export const BACKUP_FOLDER = ".Tidy Undo";

export interface BackupStatus {
  bytes: number;
  files: number;
  /** Full paths of the `.Tidy Undo` folders found. */
  folders: string[];
}

async function folderSize(folder: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  for (const entry of await fsp.readdir(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      const nested = await folderSize(full);
      bytes += nested.bytes;
      files += nested.files;
    } else if (entry.isFile()) {
      bytes += (await fsp.lstat(full)).size;
      files += 1;
    }
  }
  return { bytes, files };
}

/** Backup folders inside the given destinations and every destination in the history. */
export async function backupStatus(destinations: unknown[] = []): Promise<BackupStatus> {
  const candidates = new Set([...historyDestinations(), ...destinations.filter((value): value is string => typeof value === "string" && !!value)]);
  const status: BackupStatus = { bytes: 0, files: 0, folders: [] };
  for (const destination of candidates) {
    const folder = path.join(destination, BACKUP_FOLDER);
    try {
      if (!(await fsp.lstat(folder)).isDirectory()) continue;
      const size = await folderSize(folder);
      status.bytes += size.bytes;
      status.files += size.files;
      status.folders.push(folder);
    } catch {
      // No backups in this destination, or it is no longer reachable.
    }
  }
  return status;
}

/** Move every backup folder found to the Recycle Bin. */
export async function cleanUpBackups(destinations: unknown[] = []): Promise<{ success: boolean; error?: string; status: BackupStatus }> {
  const outcome = await withFileLock(async () => {
    const found = await backupStatus(destinations);
    const removed: string[] = [];
    let failed = 0;
    for (const folder of found.folders) {
      try {
        await shell.trashItem(folder);
        removed.push(folder);
      } catch (error) {
        console.error(`Could not move ${folder} to the Recycle Bin.`, error);
        failed += 1;
      }
    }
    forgetPathsUnder(removed);
    return failed;
  });
  const status = await backupStatus(destinations);
  if (outcome === null) return { success: false, error: "Tidy is moving or restoring files. Try again when it finishes.", status };
  return outcome
    ? { success: false, error: `${outcome} backup folder(s) could not be moved to the Recycle Bin. Folders on network drives may need to be removed by hand.`, status }
    : { success: true, status };
}
