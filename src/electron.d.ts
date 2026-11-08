/**
 * The contract between the renderer and the Electron main process.
 *
 * `electron/preload.ts` exposes exactly this surface on `window.electron`; the
 * main process implements it in `electron/ipc/`. Keeping the shape in one file
 * means a change to any handler shows up as a type error on both sides.
 */
import type { Category, OrganizerConfig } from "./app/types";
import type { Filters, InsightData, LogEvent, Operation } from "./app/types";
import type { NamingStyle } from "./shared/naming";

/** An AI-proposed rename for one file, shown for approval in the preview sheet. */
export interface SmartRenameInfo {
  source?: "ai" | "local";
  suggested: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  /** Semantic destination subfolder, e.g. "Screenshots" or "Invoices". */
  subfolder?: string;
}

/** One file as it appears in the preview sheet, before anything has moved. */
export interface PreviewFile {
  /** Path relative to the selected source; unique even for repeated filenames. */
  relativePath?: string;
  id: string;
  name: string;
  /** Extension without the leading dot. */
  ext: string;
  /** Human-readable size, e.g. "1.4 MB". */
  size: string;
  /** Size in bytes, for sorting and thresholds. */
  sizeBytes: number;
  /** Source folder, with the user's home directory abbreviated to `~`. */
  from: string;
  path?: string;
  to?: string;
  category: string;
  categoryId?: string;
  /** What decided this file's category. */
  classSource?: "extension" | "metadata" | "ai";
  confidence?: "high" | "medium" | "low";
  rename?: { from: string; to: string };
  smartRename?: SmartRenameInfo;
  needsReview: boolean;
  isDuplicate?: boolean;
  /** Name of the earlier file this one duplicates. */
  duplicateOf?: string;
  /** Last-modified time in milliseconds, used for date folders. */
  modifiedMs?: number;
}

/** Summary of a completed run. */
export interface OrganizeResult {
  success: boolean;
  moved?: number;
  renamed?: number;
  duplicates?: number;
  errors?: number;
  error?: string;
  /** Every move performed, in order, so the run can be reversed. */
  operations?: Operation[];
  /** Id of this run in the run history, when it moved anything. */
  runId?: string;
}

/** One run in the history, without its move list. */
export interface RunSummary {
  id: string;
  kind: "manual" | "scheduled" | "watch";
  /** ISO timestamp. */
  finishedAt: string;
  sourcePath: string;
  destPath: string;
  moved: number;
  renamed: number;
  duplicates: number;
  errors: number;
  /** Moves that can still be undone. */
  remaining: number;
  undone: boolean;
}

/** `.Tidy Undo` backups of replaced files. */
export interface BackupStatus {
  bytes: number;
  files: number;
  folders: string[];
}

export interface UndoResult {
  error?: string;
  success: boolean;
  reverted?: number;
  errors?: number;
  remainingOperations?: Operation[];
}

export interface ScheduleResult {
  success: boolean;
  message?: string;
  error?: string;
}

/** Result of parsing a natural-language rule. `data` is an `AiRulePatch`. */
export interface ParseRuleResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Live progress reported while a run is in flight. */
export interface OrganizeProgress {
  status: "scanning" | "running" | "completed" | "error";
  progress: number;
}

/** Configuration sent to `organizeFiles`: the UI config plus per-run overrides. */
export type OrganizeRequest = OrganizerConfig & {
  renames?: Record<string, { suggested: string; confidence: string }>;
};

/** Whether Tidy keeps running in the notification area and starts with Windows. */
export interface BackgroundSettings {
  keepRunningInTray: boolean;
  startWithWindows: boolean;
  /** False in development builds, where a startup entry would point at Electron itself. */
  startupAvailable: boolean;
}

/**
 * Everything the renderer may ask the main process to do.
 *
 * Subscription methods return an unsubscribe function; call it when the
 * component that registered the listener goes away.
 */
export interface ElectronAPI {
  getApiKeyStatus: () => Promise<{ configured: boolean; saved: boolean; environment: boolean; unreadable: boolean }>;
  saveApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  removeApiKey: () => Promise<{ success: boolean; error?: string }>;
  testApiKey: () => Promise<{ success: boolean; error?: string }>;
  getSourceChoices: (sourcePath: string, scope?: { includeSubfolders?: boolean; destPath?: string; excludeHidden?: boolean }) => Promise<string[]>;
  getPathForFile: (file: File) => string;
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  organizeFiles: (config: OrganizeRequest) => Promise<OrganizeResult>;
  openDirectory: () => Promise<string | null>;
  previewFile: (path: string) => Promise<void>;
  getFolderPreview: (
    sourcePath: string,
    categories: Category[],
    smartRenameEnabled?: boolean,
    filters?: Filters,
    namingStyle?: NamingStyle,
    scope?: { includeSubfolders?: boolean; destPath?: string; selectedSourceFolders?: string[] | null; selectedFileExtensions?: string[] | null },
  ) => Promise<PreviewFile[]>;
  getFolderInsights: (sourcePath: string, scope?: { includeSubfolders?: boolean; destPath?: string; selectedSourceFolders?: string[] | null; selectedFileExtensions?: string[] | null }) => Promise<InsightData>;
  onOrganizeProgress: (callback: (data: OrganizeProgress) => void) => () => void;
  onOrganizeLog: (callback: (event: LogEvent) => void) => () => void;
  parseRule: (rule: string, currentConfig: unknown) => Promise<ParseRuleResult>;
  openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  undoOrganize: (operations: Operation[]) => Promise<UndoResult>;
  saveSchedule: (config: OrganizerConfig) => Promise<ScheduleResult>;
  /** The Windows system accent colour as a hex string, or null if unavailable. */
  getAccentColor: () => Promise<string | null>;
  getBackgroundSettings: () => Promise<BackgroundSettings>;
  setBackgroundSettings: (settings: { keepRunningInTray: boolean; startWithWindows: boolean }) => Promise<{ success: boolean; error?: string; settings: BackgroundSettings }>;
  listRunHistory: () => Promise<RunSummary[]>;
  undoRun: (id: string) => Promise<UndoResult>;
  onHistoryChanged: (callback: () => void) => () => void;
  onWatchStatus: (callback: (status: { watching: boolean; error?: string }) => void) => () => void;
  getBackupStatus: (destinations: string[]) => Promise<BackupStatus>;
  cleanUpBackups: (destinations: string[]) => Promise<{ success: boolean; error?: string; status: BackupStatus }>;
  saveWatch: (config: OrganizerConfig, enabled: boolean) => Promise<{ success: boolean; watching: boolean; error?: string }>;
  exportRuleSets: (data: unknown, suggestedName: string) => Promise<{ success: boolean; canceled?: boolean; error?: string; filePath?: string }>;
  importRuleSets: () => Promise<{ success: boolean; canceled?: boolean; error?: string; data?: unknown }>;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => () => void;
}

declare global {
  interface Window {
    /**
     * Undefined when the renderer runs in a plain browser (`npm run dev` in a
     * tab, tests). Every caller must handle its absence.
     */
    electron?: ElectronAPI;
  }
}
