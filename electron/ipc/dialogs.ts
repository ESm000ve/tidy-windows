/**
 * Folder pickers, file reveal in File Explorer, and opening folders.
 */
import { promises as fsp } from "node:fs";
import { dialog, ipcMain, shell } from "electron";
import { CHANNELS } from "../channels";
import { getMainWindow } from "../window";

export function registerDialogHandlers(): void {
  ipcMain.handle(CHANNELS.openDirectory, async () => {
    const window = getMainWindow();
    if (!window) return null;

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });
    return canceled ? null : (filePaths[0] ?? null);
  });

  /** Reveal a file in File Explorer. */
  ipcMain.handle(CHANNELS.previewFile, async (_event, filePath: unknown) => {
    // Reveal rather than execute: a preview must never launch an executable.
    if (typeof filePath === "string" && filePath) shell.showItemInFolder(filePath);
  });

  /** Open a folder in File Explorer. */
  ipcMain.handle(CHANNELS.openFolder, async (_event, folderPath: unknown) => {
    // `openPath` launches files as well as folders, so only a real directory is
    // accepted here: this channel must never run a program.
    if (typeof folderPath !== "string" || !folderPath) return { success: false, error: "No folder was given." };
    try {
      if (!(await fsp.stat(folderPath)).isDirectory()) return { success: false, error: "That location is not a folder." };
    } catch {
      return { success: false, error: "That folder no longer exists." };
    }
    // `openPath` resolves with an error *string*, not a rejection.
    const error = await shell.openPath(folderPath);
    if (error) {
      console.error(`Could not open ${folderPath}:`, error);
      return { success: false, error };
    }
    return { success: true };
  });
}
