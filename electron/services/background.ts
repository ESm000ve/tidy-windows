/**
 * Running in the background: the notification-area (tray) icon, starting with
 * Windows, and closing to the tray instead of quitting.
 *
 * Schedules are armed by the renderer, so "background" means the window is
 * hidden, not destroyed — the page keeps running and its schedule stays live.
 */
import fs from "node:fs";
import path from "node:path";
import { app, Menu, Notification, Tray, nativeImage, type BrowserWindow } from "electron";

/** Command-line flag passed by the Windows startup entry. */
export const HIDDEN_LAUNCH_FLAG = "--hidden";
const STARTUP_NAME = "com.ericauzenne.tidy";

export interface BackgroundSettings {
  /** Closing the window hides Tidy in the notification area instead of quitting. */
  keepRunningInTray: boolean;
  /** Start Tidy, hidden in the notification area, when the user signs in. */
  startWithWindows: boolean;
}

const DEFAULTS: BackgroundSettings = { keepRunningInTray: false, startWithWindows: false };

let settings: BackgroundSettings = { ...DEFAULTS };
let tray: Tray | null = null;
let quitting = false;
let trayHintShown = false;

const settingsPath = () => path.join(app.getPath("userData"), "background-settings.json");

/** Read the saved settings. Call once, after `app.whenReady`. */
export function loadBackgroundSettings(): BackgroundSettings {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath(), "utf-8")) as Partial<BackgroundSettings>;
    settings = {
      keepRunningInTray: parsed.keepRunningInTray === true,
      startWithWindows: parsed.startWithWindows === true,
    };
  } catch {
    settings = { ...DEFAULTS };
  }
  return settings;
}

export function getBackgroundSettings(): BackgroundSettings & { startupAvailable: boolean } {
  // The startup entry points at the installed Tidy.exe; a development build
  // would register the bare Electron runtime instead.
  const startupAvailable = app.isPackaged && process.platform === "win32";
  const startup = startupAvailable ? app.getLoginItemSettings({ path: process.execPath, args: [HIDDEN_LAUNCH_FLAG] }) : null;
  return { ...settings, startWithWindows: startup ? startup.openAtLogin && startup.executableWillLaunchAtLogin : settings.startWithWindows, startupAvailable };
}

/** Save new settings and apply them (tray icon and Windows startup entry). */
export function updateBackgroundSettings(next: unknown, icon: string, onOpen: () => void, onRun: () => void): BackgroundSettings {
  const value = (next ?? {}) as Partial<BackgroundSettings>;
  const previousStartup = settings.startWithWindows;
  const previousEffectiveStartup = getBackgroundSettings().startWithWindows;
  settings = {
    keepRunningInTray: value.keepRunningInTray === true,
    // Starting hidden without a tray icon would leave Tidy unreachable.
    startWithWindows: value.startWithWindows === true && value.keepRunningInTray === true,
  };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  if (previousStartup !== settings.startWithWindows || previousEffectiveStartup !== settings.startWithWindows) applyStartupEntry();
  syncTray(icon, onOpen, onRun);
  return settings;
}

function applyStartupEntry(): void {
  if (!getBackgroundSettings().startupAvailable) return;
  app.setLoginItemSettings({ name: STARTUP_NAME, path: process.execPath, openAtLogin: settings.startWithWindows, args: [HIDDEN_LAUNCH_FLAG] });
}

/** True when this launch came from the Windows startup entry and should stay hidden. */
export function shouldStartHidden(): boolean {
  return settings.keepRunningInTray && process.argv.includes(HIDDEN_LAUNCH_FLAG);
}

/** Show the tray icon when background running is on; remove it when off. */
export function syncTray(icon: string, onOpen: () => void, onRun: () => void): void {
  if (!settings.keepRunningInTray) {
    tray?.destroy();
    tray = null;
    return;
  }
  if (tray) return;
  const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip("Tidy");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Tidy", click: onOpen },
      { label: "Run Tidy…", click: onRun },
      { type: "separator" },
      { label: "Exit Tidy", click: () => quitFromTray() },
    ]),
  );
  tray.on("click", onOpen);
}

function quitFromTray(): void {
  quitting = true;
  app.quit();
}

/**
 * Hide instead of closing when background running is on. Exit from the tray
 * menu, File › Exit, or Windows shutdown still quits.
 */
export function attachCloseToTray(window: BrowserWindow): void {
  app.on("before-quit", () => {
    quitting = true;
  });
  // Signing out or shutting down must not be blocked by close-to-tray.
  window.on("query-session-end", () => {
    quitting = true;
  });
  window.on("session-end", () => {
    quitting = true;
  });
  window.on("close", (event) => {
    if (quitting || !settings.keepRunningInTray || !tray) return;
    event.preventDefault();
    window.hide();
    if (!trayHintShown) {
      trayHintShown = true;
      notify("Tidy is still running", "Scheduled runs continue in the background. Right-click the Tidy icon in the notification area to exit.");
    }
  });
}

/** Show a Windows notification, if notifications are available. */
export function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, silent: true }).show();
}
