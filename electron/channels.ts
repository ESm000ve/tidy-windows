/**
 * IPC channel names, in one place.
 *
 * The main process registers handlers for these and the preload script invokes
 * them; a typo on either side is a runtime no-op, so both import from here.
 */
export const CHANNELS = {
  /** Renderer → main, request/response. */
  openDirectory: "dialog:openDirectory",
  previewFile: "dialog:previewFile",
  getSourceChoices: "dialog:getSourceChoices",
  getFolderPreview: "dialog:getFolderPreview",
  getFolderInsights: "dialog:getFolderInsights",
  organizeRun: "organize:run",
  organizeUndo: "organize:undo",
  scheduleSave: "schedule:save",
  openFolder: "open:folder",
  parseRule: "ai:parseRule",
  apiKeyStatus: "ai:keyStatus",
  apiKeySave: "ai:keySave",
  apiKeyRemove: "ai:keyRemove",
  apiKeyTest: "ai:keyTest",
  setTheme: "system:setTheme",
  getAccentColor: "system:getAccentColor",
  getBackgroundSettings: "system:getBackgroundSettings",
  setBackgroundSettings: "system:setBackgroundSettings",
  historyList: "history:list",
  historyUndo: "history:undo",
  backupStatus: "backups:status",
  backupCleanup: "backups:cleanup",
  watchSave: "watch:save",
  ruleSetExport: "ruleSets:export",
  ruleSetImport: "ruleSets:import",

  /** Main → renderer, one-way events. */
  organizeProgress: "organize:progress",
  organizeLog: "organize:log",
  menuAction: "menu:action",
  fullScreenChange: "window:fullscreen-change",
  historyChanged: "history:changed",
  watchStatus: "watch:status",
} as const;
