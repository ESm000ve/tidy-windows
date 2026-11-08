/**
 * Run history, multi-run Undo, backup cleanup, and the watched folder.
 */
import { ipcMain } from "electron";
import { CHANNELS } from "../channels";
import { backupStatus, cleanUpBackups } from "../services/backups";
import { applyUndo, getRunOperations, listRuns, recordRun } from "../services/history";
import { notify } from "../services/background";
import { undoOperations } from "../services/organizer";
import { setWatchBatchListener, setWatchStoppedListener, startWatching, stopWatching } from "../services/watch";
import { sendToRenderer } from "../window";
import type { OrganizeRequest } from "../types";

export function registerHistoryHandlers(): void {
  setWatchStoppedListener(() => sendToRenderer(CHANNELS.watchStatus, {
    watching: false, error: "Watching stopped. Check that the source folder is available, then turn automatic tidying off and on to retry.",
  }));
  ipcMain.handle(CHANNELS.historyList, () => listRuns());

  ipcMain.handle(CHANNELS.historyUndo, async (_event, id: unknown) => {
    const operations = typeof id === "string" ? getRunOperations(id) : undefined;
    if (!operations) return { success: false, reverted: 0, errors: 0, remainingOperations: [], error: "That run is no longer in the history." };
    if (operations.length === 0) return { success: true, reverted: 0, errors: 0, remainingOperations: [] };
    const result = await undoOperations(operations);
    if (!("error" in result)) applyUndo(operations, result.remainingOperations);
    return result;
  });

  ipcMain.handle(CHANNELS.backupStatus, (_event, destinations: unknown) =>
    backupStatus(Array.isArray(destinations) ? destinations : []),
  );
  ipcMain.handle(CHANNELS.backupCleanup, (_event, destinations: unknown) =>
    cleanUpBackups(Array.isArray(destinations) ? destinations : []),
  );

  setWatchBatchListener((request, result) => {
    recordRun("watch", request, result);
    if (!result.success) {
      notify("Tidy couldn't tidy new files", result.error ?? "Open Tidy to check the watched folder.");
    } else if (result.errors) {
      notify("Tidy tidied new files with problems", `Moved ${result.moved ?? 0} file(s); ${result.errors} could not be moved.`);
    } else if (result.moved) {
      notify("Tidy tidied new files", `Moved ${result.moved} new file(s). Undo is in the Activity Log.`);
    }
  });

  ipcMain.handle(CHANNELS.watchSave, async (_event, request: OrganizeRequest | undefined, enabled: unknown) => {
    if (enabled !== true || !request) {
      stopWatching();
      return { success: true, watching: false };
    }
    const { schedule: _schedule, ...runConfig } = request;
    const error = await startWatching(runConfig);
    return error ? { success: false, watching: false, error } : { success: true, watching: true };
  });
}
