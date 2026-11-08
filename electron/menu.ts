/**
 * The native Windows menu bar (hidden until Alt is pressed).
 *
 * Menu items do not act directly: each sends a {@link MenuAction} to the
 * renderer, which owns the state the action affects. That keeps one
 * implementation of "run Tidy" rather than a menu copy and a button copy.
 */
import { app, Menu, shell, type MenuItemConstructorOptions } from "electron";
import { CHANNELS } from "./channels";
import { sendToRenderer } from "./window";

/** Actions the renderer knows how to handle. Mirrors `MenuAction` there. */
type MenuAction =
  | "open-preferences"
  | "run-tidy"
  | "reset-rules"
  | "open-source"
  | "open-destination"
  | "toggle-insights"
  | "toggle-audit"
  | "clear-search"
  | "undo-organize";

interface MenuOptions {
  /** Repository URL used by the Help menu. */
  repositoryUrl: string;
}

function dispatch(action: MenuAction) {
  return () => sendToRenderer(CHANNELS.menuAction, action);
}

function buildTemplate({ repositoryUrl }: MenuOptions): MenuItemConstructorOptions[] {
  // Developer tools are gated on the packaged flag so they never ship.
  const developerItems: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
      ];

  return [
    {
      label: "File",
      submenu: [
        { label: "Select Source Folder…", accelerator: "Ctrl+O", click: dispatch("open-source") },
        {
          label: "Select Destination Folder…",
          accelerator: "Ctrl+Shift+O",
          click: dispatch("open-destination"),
        },
        { type: "separator" },
        { label: "Settings…", accelerator: "Ctrl+,", click: dispatch("open-preferences") },
        { type: "separator" },
        { role: "quit", label: "Exit" },
      ],
    },
    {
      label: "Actions",
      submenu: [
        { label: "Run Tidy", accelerator: "Ctrl+Enter", click: dispatch("run-tidy") },
        // Deliberately without a shortcut: it discards the user's whole rule set.
        { label: "Reset All Rules…", click: dispatch("reset-rules") },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { label: "Undo Last Organize", accelerator: "Ctrl+Alt+Z", click: dispatch("undo-organize") },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Show Insights", accelerator: "Ctrl+I", click: dispatch("toggle-insights") },
        { label: "Show Audit Log", accelerator: "Ctrl+L", click: dispatch("toggle-audit") },
        { type: "separator" },
        { label: "Clear Search", accelerator: "Ctrl+K", click: dispatch("clear-search") },
        { type: "separator" },
        ...developerItems,
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
    {
      role: "help",
      submenu: [
        { label: "Learn More", click: () => void shell.openExternal(repositoryUrl) },
        { label: "Documentation", click: () => void shell.openExternal(`${repositoryUrl}#readme`) },
        { type: "separator" },
        { label: "Report an Issue", click: () => void shell.openExternal(`${repositoryUrl}/issues`) },
      ],
    },
  ];
}

/** Install the application menu. */
export function setupMenu(options: MenuOptions): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate(options)));
}
