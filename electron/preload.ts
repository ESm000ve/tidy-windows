/**
 * The renderer's only bridge to the main process.
 *
 * Nothing here does work: every method forwards to an IPC channel. The renderer
 * runs with `contextIsolation` on and `nodeIntegration` off, so this exposed
 * object is the complete list of privileged operations available to it — which
 * is why it stays a thin, explicit allowlist rather than a generic `invoke`.
 *
 * The shape must match `ElectronAPI` in `src/electron.d.ts`.
 */
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { CHANNELS } from "./channels";

/**
 * Subscribe to a main-process event, returning an unsubscribe function.
 *
 * Callers must invoke it on unmount; without this the listener would outlive
 * the component and fire against stale state.
 */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * Strip anything the structured clone algorithm cannot carry across the bridge.
 *
 * React state can hold `Date` objects and other non-clonable values; sending
 * one raises an opaque "object could not be cloned" error, so config objects
 * are normalised to plain JSON first.
 */
function toPlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

contextBridge.exposeInMainWorld("electron", {
  getApiKeyStatus: () => ipcRenderer.invoke(CHANNELS.apiKeyStatus),
  saveApiKey: (key: string) => ipcRenderer.invoke(CHANNELS.apiKeySave, key),
  removeApiKey: () => ipcRenderer.invoke(CHANNELS.apiKeyRemove),
  testApiKey: () => ipcRenderer.invoke(CHANNELS.apiKeyTest),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  setTheme: (theme: string) => ipcRenderer.invoke(CHANNELS.setTheme, theme),
  openDirectory: () => ipcRenderer.invoke(CHANNELS.openDirectory),
  previewFile: (filePath: string) => ipcRenderer.invoke(CHANNELS.previewFile, filePath),
  openFolder: (folderPath: string) => ipcRenderer.invoke(CHANNELS.openFolder, folderPath),
  getAccentColor: () => ipcRenderer.invoke(CHANNELS.getAccentColor),
  getBackgroundSettings: () => ipcRenderer.invoke(CHANNELS.getBackgroundSettings),
  setBackgroundSettings: (settings: unknown) =>
    ipcRenderer.invoke(CHANNELS.setBackgroundSettings, toPlainObject(settings)),

  getSourceChoices: (sourcePath: string, scope?: unknown) => ipcRenderer.invoke(CHANNELS.getSourceChoices, sourcePath, scope == null ? undefined : toPlainObject(scope)),
  getFolderInsights: (sourcePath: string, scope?: unknown) =>
    ipcRenderer.invoke(CHANNELS.getFolderInsights, sourcePath, scope == null ? undefined : toPlainObject(scope)),
  getFolderPreview: (sourcePath: string, categories: unknown[], smartRenameEnabled?: boolean, filters?: unknown, namingStyle?: string, scope?: unknown) =>
    ipcRenderer.invoke(
      CHANNELS.getFolderPreview,
      sourcePath,
      toPlainObject(categories),
      smartRenameEnabled,
      filters == null ? undefined : toPlainObject(filters),
      namingStyle,
      scope == null ? undefined : toPlainObject(scope),
    ),

  organizeFiles: (config: unknown) =>
    ipcRenderer.invoke(CHANNELS.organizeRun, toPlainObject(config)),
  undoOrganize: (operations: unknown[]) =>
    ipcRenderer.invoke(CHANNELS.organizeUndo, toPlainObject(operations)),
  saveSchedule: (config: unknown) =>
    ipcRenderer.invoke(CHANNELS.scheduleSave, toPlainObject(config)),
  parseRule: (rule: string, currentConfig: unknown) =>
    ipcRenderer.invoke(CHANNELS.parseRule, rule, toPlainObject(currentConfig)),

  onOrganizeProgress: (callback: (data: unknown) => void) =>
    subscribe(CHANNELS.organizeProgress, callback),
  onOrganizeLog: (callback: (data: unknown) => void) => subscribe(CHANNELS.organizeLog, callback),
  listRunHistory: () => ipcRenderer.invoke(CHANNELS.historyList),
  undoRun: (id: string) => ipcRenderer.invoke(CHANNELS.historyUndo, id),
  onHistoryChanged: (callback: () => void) => subscribe(CHANNELS.historyChanged, callback),
  onWatchStatus: (callback: (status: unknown) => void) => subscribe(CHANNELS.watchStatus, callback),
  getBackupStatus: (destinations: string[]) => ipcRenderer.invoke(CHANNELS.backupStatus, toPlainObject(destinations)),
  cleanUpBackups: (destinations: string[]) => ipcRenderer.invoke(CHANNELS.backupCleanup, toPlainObject(destinations)),
  saveWatch: (config: unknown, enabled: boolean) => ipcRenderer.invoke(CHANNELS.watchSave, toPlainObject(config), enabled),
  exportRuleSets: (data: unknown, suggestedName: string) => ipcRenderer.invoke(CHANNELS.ruleSetExport, toPlainObject(data), suggestedName),
  importRuleSets: () => ipcRenderer.invoke(CHANNELS.ruleSetImport),
  onMenuAction: (callback: (action: string) => void) => subscribe(CHANNELS.menuAction, callback),
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) =>
    subscribe(CHANNELS.fullScreenChange, callback),
});
