/**
 * System appearance queries and background-running settings.
 */
import { ipcMain, systemPreferences, nativeTheme } from "electron";
import { CHANNELS } from "../channels";
import { getBackgroundSettings, updateBackgroundSettings } from "../services/background";
import { appIconPath, sendToRenderer, showMainWindow } from "../window";

/** Tray "Open Tidy": restore the window. */
export function openFromTray(): void {
  showMainWindow();
}

/** Tray "Run Tidy…": restore the window and start the usual preview. */
export function runFromTray(): void {
  showMainWindow();
  sendToRenderer(CHANNELS.menuAction, "run-tidy");
}

export function registerSystemHandlers(): void {
  ipcMain.handle(CHANNELS.setTheme, (_event, theme: unknown) => {
    if (theme === "light" || theme === "dark" || theme === "system") nativeTheme.themeSource = theme;
  });
  /**
   * The user's accent colour, so the app's controls match the rest of the
   * Windows system.
   */
  ipcMain.handle(CHANNELS.getAccentColor, () =>
    process.platform === "win32"
      ? systemPreferences.getAccentColor()
      : null,
  );
  ipcMain.handle(CHANNELS.getBackgroundSettings, () => getBackgroundSettings());
  ipcMain.handle(CHANNELS.setBackgroundSettings, (_event, next: unknown) => {
    try {
      updateBackgroundSettings(next, appIconPath(), openFromTray, runFromTray);
      return { success: true, settings: getBackgroundSettings() };
    } catch (error) {
      console.error("Could not save background settings.", error);
      return { success: false, error: "Could not save this setting. Please try again.", settings: getBackgroundSettings() };
    }
  });
}
