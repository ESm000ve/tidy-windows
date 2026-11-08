/**
 * The application window and the paths the renderer is loaded from.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, nativeTheme } from "electron";
import { CHANNELS } from "./channels";

/** Set by Vite in development; absent in a packaged build. */
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** Window background colours, matched to the renderer's theme tokens so there
 *  is no light/dark flash between the window appearing and React painting. */
const BACKGROUND = { dark: "#202020", light: "#F3F3F3" } as const;

const WINDOW_SIZE = { width: 1024, height: 768, minWidth: 800, minHeight: 600 } as const;

/** Directory of the bundled main process, used to locate the preload script. */
const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function backgroundForAppearance(): string {
  return nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light;
}

/** The main window, or `null` if it has been closed. */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** Send a one-way event to the renderer, if a window is open. */
export function sendToRenderer(channel: string, ...args: unknown[]): void {
  mainWindow?.webContents.send(channel, ...args);
}

/** The app icon on disk, for the window and the notification-area icon. */
export function appIconPath(): string {
  return path.join(MAIN_DIR, VITE_DEV_SERVER_URL ? "../assets/icon.png" : "../build/icon.png");
}

/** Bring the window to the front, restoring it from the tray or taskbar. */
export function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Create the application window and load the renderer into it.
 *
 * With `show: false` the page still loads (and arms any saved schedule) while
 * the window stays hidden in the notification area.
 */
export function createWindow(rendererDist: string, { show = true }: { show?: boolean } = {}): BrowserWindow {
  mainWindow = new BrowserWindow({
    ...WINDOW_SIZE,
    show,
    title: "Tidy",
    titleBarStyle: "default",
    autoHideMenuBar: process.platform === "win32",
    icon: appIconPath(),
    backgroundColor: backgroundForAppearance(),
    webPreferences: {
      preload: path.join(MAIN_DIR, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // App content never needs to navigate to an external page or open popups.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", event => event.preventDefault());

  const updateAppearance = () => mainWindow?.setBackgroundColor(backgroundForAppearance());
  nativeTheme.on("updated", updateAppearance);

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(rendererDist, "index.html"));
  }

  // The renderer insets its top bar for full screen changes
  // when the window enters full screen.
  mainWindow.on("enter-full-screen", () => sendToRenderer(CHANNELS.fullScreenChange, true));
  mainWindow.on("leave-full-screen", () => sendToRenderer(CHANNELS.fullScreenChange, false));
  mainWindow.on("closed", () => {
    nativeTheme.removeListener("updated", updateAppearance);
    mainWindow = null;
  });

  return mainWindow;
}
