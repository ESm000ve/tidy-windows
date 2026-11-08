/**
 * Previewing, running, and reversing an organize job.
 */
import { walkSourceFiles, type SourceScanOptions } from "../lib/files";
import { ipcMain } from "electron";
import { CHANNELS } from "../channels";
import { scanFolderInsights } from "../services/insights";
import { runOrganizeJob, undoOperations } from "../services/organizer";
import { buildPreview } from "../services/preview";
import { applyUndo, recordRun } from "../services/history";
import type { CategoryRule, LogLevel, Operation, OrganizeRequest, RunFilters } from "../types";
import type { NamingStyle } from "../../src/shared/naming";

/** Wall-clock time for a log line, in the 24-hour format the status bar shows. */
function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function registerOrganizeHandlers(): void {
  ipcMain.handle(CHANNELS.getSourceChoices, async (_event, sourcePath: string, scope: SourceScanOptions = {}) => {
    const folders: string[] = [];
    for await (const _file of walkSourceFiles(sourcePath, { includeSubfolders: scope.includeSubfolders, destPath: scope.destPath, excludeHidden: scope.excludeHidden, directoriesOnly: true, onDirectory: folder => folders.push(folder) })) { /* inventory only */ }
    return folders;
  });
  ipcMain.handle(CHANNELS.getFolderInsights, (_event, sourcePath: string, scope?: SourceScanOptions) =>
    scanFolderInsights(sourcePath, scope),
  );

  ipcMain.handle(
    CHANNELS.getFolderPreview,
    (_event, sourcePath: string, categories: CategoryRule[], smartRenameEnabled?: boolean, filters?: RunFilters, namingStyle?: NamingStyle, scope?: SourceScanOptions) =>
      buildPreview(sourcePath, categories, smartRenameEnabled, filters, namingStyle, scope),
  );

  /**
   * Run the job, streaming progress and log lines back to the window that
   * started it so the UI can update while files are still moving.
   */
  ipcMain.handle(CHANNELS.organizeRun, async (event, request: OrganizeRequest) => {
    const result = await runOrganizeJob(request, {
      onProgress: (progress) =>
        event.sender.send(CHANNELS.organizeProgress, { status: "running", progress }),
      onLog: (level: LogLevel, message: string) =>
        event.sender.send(CHANNELS.organizeLog, { level, message, time: timestamp() }),
    });
    return { ...result, runId: recordRun("manual", request, result) };
  });

  ipcMain.handle(CHANNELS.organizeUndo, async (_event, operations: Operation[]) => {
    if (!Array.isArray(operations)) return { success: false, reverted: 0, errors: 0, remainingOperations: [], error: "Nothing to undo." };
    const result = await undoOperations(operations);
    // Keep the run history in step, whichever screen Undo came from.
    if (!("error" in result)) applyUndo(operations, result.remainingOperations);
    return result;
  });
}
