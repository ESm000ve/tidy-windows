/**
 * Types shared across the renderer.
 *
 * Types that describe the main-process contract (`PreviewFile`, `ElectronAPI`,
 * …) live in `src/electron.d.ts`; this module covers UI-level shapes only.
 */
import type { Icon } from "./components/icons";
import type { DateFolders } from "../shared/dateFolders";

/** How far back a file's modification time may be for it to be included. */
export type DateFilter = "any" | "today" | "week" | "month" | "year";

/** Coarse size buckets offered in the filter row. */
export type SizeFilter = "any" | "small" | "medium" | "large";

/** What to do when a file already exists at the destination path. */
export type ConflictResolution = "rename" | "overwrite" | "skip" | "archive";

/** How often an unattended run should fire. `manual` means "never". */
export type ScheduleType = "manual" | "daily" | "weekly" | "monthly";

/** The filter set applied to a folder scan. */
export interface Filters {
  dateModified: DateFilter;
  fileSize: SizeFilter;
  excludeHidden: boolean;
}

/**
 * One file move, recorded so the run can be reversed. Written by the main
 * process during a run and replayed in reverse by `undoOrganize`.
 */
export interface Operation {
  id?: string;
  originalPath: string;
  newPath: string;
  originalName: string;
  newName: string;
}

/** A line in the run log shown in the status bar. */
export interface LogEvent {
  level: "info" | "warn" | "error" | "success";
  message: string;
  /** Wall-clock time, pre-formatted by the main process. */
  time: string;
}

/** Raw per-heuristic counts returned by the folder-insights scan. */
export interface InsightData {
  counts: Record<string, number>;
  total: number;
}

/** A single actionable row inside an insight group. */
export interface InsightItem {
  label: string;
  count: number;
  action: { label: string; onClick: () => void };
}

/** A titled group of insights rendered in the Insights sidebar. */
export interface InsightGroup {
  title: string;
  icon: Icon;
  accentColor: string;
  items: InsightItem[];
}

/** Inline success/failure feedback for the AI command bar. */
export interface AiFeedback {
  type: "success" | "error";
  message: string;
}

/** A category rule as configured in the UI. */
export interface Category {
  id: string;
  name: string;
  enabled: boolean;
  extensions: string[];
  subfolders: boolean;
  smartCategorization?: boolean;
  duplicateDetection?: boolean;
  /** Year or year/month folders under the category, from the modified date. */
  dateFolders?: DateFolders;
}

/** Everything a preview or run needs, composed by `App` from its settings. */
export interface OrganizerConfig {
  includeSubfolders?: boolean;
  selectedSourceFolders?: string[] | null;
  selectedFileExtensions?: string[] | null;
  sourcePath: string;
  destPath: string;
  categories: Category[];
  filters: Filters;
  conflictResolution: ConflictResolution;
  schedule: {
    enabled: boolean;
    frequency: ScheduleType;
    date: Date | null;
    /** 24-hour "HH:MM". */
    time: string;
  };
}
