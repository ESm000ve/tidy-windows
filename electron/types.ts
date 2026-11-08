/**
 * Types used inside the main process.
 *
 * The renderer-facing contract lives in `src/electron.d.ts`; these are the
 * shapes the handlers and services pass among themselves.
 */

/** A category rule as configured in the UI. */
export interface CategoryRule {
  id: string;
  name: string;
  enabled: boolean;
  extensions: string[];
  subfolders: boolean;
  smartCategorization?: boolean;
  duplicateDetection?: boolean;
  /** Year or year/month folders under the category, from the modified date. */
  dateFolders?: "none" | "year" | "month";
}

export interface RunFilters {
  dateModified: "any" | "today" | "week" | "month" | "year";
  fileSize: "any" | "small" | "medium" | "large";
  excludeHidden: boolean;
}

export type ConflictResolution = "rename" | "overwrite" | "skip" | "archive";

export interface ScheduleSettings {
  enabled: boolean;
  frequency: "manual" | "daily" | "weekly" | "monthly";
  date: string | Date | null;
  /** 24-hour "HH:MM". */
  time: string;
}

/** An AI rename the user accepted in the preview sheet, keyed by original name. */
export interface AcceptedRename {
  suggested: string;
  confidence?: string;
  subfolder?: string;
}

/** The full request for a run, as sent from the renderer. */
export interface OrganizeRequest {
  includeSubfolders?: boolean;
  selectedSourceFolders?: string[] | null;
  selectedFileExtensions?: string[] | null;
  sourcePath: string;
  destPath: string;
  categories: CategoryRule[];
  filters: RunFilters;
  conflictResolution: ConflictResolution;
  schedule?: ScheduleSettings;
  renames?: Record<string, AcceptedRename>;
  /**
   * Limit the run to these files (absolute paths). Used by the watched folder
   * so only newly arrived files move. Scope and filters still apply.
   */
  onlyPaths?: string[];
}

/** One completed move, recorded so the run can be reversed. */
export interface Operation {
  /** Stable identity, including when two runs reuse the same paths. */
  id?: string;
  originalPath: string;
  newPath: string;
  originalName: string;
  newName: string;
}

export type LogLevel = "info" | "warn" | "error" | "success";

export interface RunCallbacks {
  onProgress?: (percent: number) => void;
  onLog?: (level: LogLevel, message: string) => void;
}

export interface RunResult {
  success: boolean;
  moved?: number;
  renamed?: number;
  duplicates?: number;
  errors?: number;
  error?: string;
  operations?: Operation[];
}

/** An AI rename suggestion for one file. */
export interface RenameSuggestion {
  source?: "ai" | "local";
  suggested: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  subfolder?: string;
}

/** The subset of file metadata the rename service needs. */
export interface FileForRename {
  id: string;
  name: string;
  path: string;
  /** Size in bytes. */
  size: number;
  modifiedMs?: number;
}

/** One row in the preview sheet. */
export interface PreviewEntry {
  relativePath: string;
  id: string;
  name: string;
  ext: string;
  size: string;
  sizeBytes: number;
  from: string;
  path: string;
  category: string;
  categoryId: string;
  modifiedMs: number;
  needsReview: boolean;
  isDuplicate: boolean;
  duplicateOf?: string;
  smartRename?: RenameSuggestion;
  classSource?: "extension" | "metadata" | "ai";
}
