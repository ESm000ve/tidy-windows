/**
 * Saving rule sets to a file and loading them back. The renderer validates the
 * contents; this side only reads and writes the JSON the user picked.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";
import { app, dialog, ipcMain } from "electron";
import { CHANNELS } from "../channels";
import { getMainWindow } from "../window";

/** Rule-set files are small; anything larger is not one. */
const MAX_IMPORT_BYTES = 1024 * 1024;

const FILTERS = [{ name: "Tidy rule sets", extensions: ["json"] }];

export function registerRuleSetHandlers(): void {
  ipcMain.handle(CHANNELS.ruleSetExport, async (_event, data: unknown, suggestedName: unknown) => {
    const window = getMainWindow();
    if (!window || !data || typeof data !== "object") return { success: false, error: "Nothing to export." };
    const base = typeof suggestedName === "string" && suggestedName.trim()
      ? suggestedName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 80)
      : "Tidy rule sets";
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: "Export rule sets",
      defaultPath: path.join(app.getPath("documents"), `${base}.json`),
      filters: FILTERS,
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    try {
      await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
      return { success: true, filePath };
    } catch {
      return { success: false, error: "Could not write that file. Choose another folder and try again." };
    }
  });

  ipcMain.handle(CHANNELS.ruleSetImport, async () => {
    const window = getMainWindow();
    if (!window) return { success: false, error: "No window is open." };
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: "Import rule sets",
      properties: ["openFile"],
      filters: FILTERS,
    });
    if (canceled || !filePaths[0]) return { success: false, canceled: true };
    try {
      const stats = await fsp.stat(filePaths[0]);
      if (stats.size > MAX_IMPORT_BYTES) return { success: false, error: "That file is too large to be a Tidy rule set." };
      return { success: true, data: JSON.parse(await fsp.readFile(filePaths[0], "utf-8")) as unknown };
    } catch {
      return { success: false, error: "That file isn't a readable Tidy rule set." };
    }
  });
}
