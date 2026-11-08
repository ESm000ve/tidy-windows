/**
 * Main process entry point.
 *
 * This file does bootstrap only — environment, lifecycle, and wiring. The work
 * lives in `./services` (what the app does), `./ipc` (what the renderer may
 * ask for), `./menu`, and `./window`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import * as dotenv from "dotenv";
import { registerIpcHandlers } from "./ipc";
import { setupMenu } from "./menu";
import { loadRenameCache } from "./services/renameCache";
import { attachCloseToTray, loadBackgroundSettings, shouldStartHidden, syncTray } from "./services/background";
import { VITE_DEV_SERVER_URL, appIconPath, createWindow, sendToRenderer, showMainWindow } from "./window";
import { openFromTray, runFromTray } from "./ipc/system";
import { loadHistory } from "./services/history";
import { CHANNELS } from "./channels";

// Loads GEMINI_API_KEY from .env in development. In a packaged build the key
// comes from the real environment; a missing key is handled, not fatal.
if (!app.isPackaged) dotenv.config({ quiet: true });

const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Project root at runtime: one level above the bundled main process. */
const APP_ROOT = path.join(MAIN_DIR, "..");

/** Built renderer assets, loaded directly from disk in a packaged build. */
const RENDERER_DIST = path.join(APP_ROOT, "dist");

const REPOSITORY_URL = "https://github.com/ESm000ve/tidy-windows";

process.env.APP_ROOT = APP_ROOT;
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(APP_ROOT, "public") : RENDERER_DIST;

// Prevent separate launches from racing file operations in the same profile.
if (!app.requestSingleInstanceLock()) app.quit();
else void app.whenReady().then(() => {
  // Lets Windows attribute notifications to Tidy; matches the installer's appId.
  app.setAppUserModelId("com.ericauzenne.tidy");
  loadRenameCache();
  loadBackgroundSettings();
  loadHistory(() => sendToRenderer(CHANNELS.historyChanged));
  registerIpcHandlers();
  const window = createWindow(RENDERER_DIST, { show: !shouldStartHidden() });
  attachCloseToTray(window);
  syncTray(appIconPath(), openFromTray, runFromTray);
  setupMenu({ repositoryUrl: REPOSITORY_URL });
});

app.on("second-instance", () => showMainWindow());

// Closing the last window exits the Windows app. With background running on,
// closing only hides the window, so this fires on a real exit.
app.on("window-all-closed", () => {
  app.quit();
});
