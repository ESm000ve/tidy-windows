/**
 * Validation for settings restored from `localStorage`.
 *
 * Stored values may come from an older version of Tidy or be hand-edited, so
 * each reader checks the shape and returns `undefined` to fall back to the
 * default rather than letting a bad value reach the organizer.
 */
import { BUILT_IN_CATEGORY_IDS, createInitialCategories } from "../constants";
import type { Category, ConflictResolution, Filters, ScheduleType } from "../types";
import { normalizeDateFolders } from "../../shared/dateFolders";

const DATE_FILTERS = ["any", "today", "week", "month", "year"] as const;
const SIZE_FILTERS = ["any", "small", "medium", "large"] as const;
const CONFLICTS = ["rename", "overwrite", "skip", "archive"] as const;
const SCHEDULE_TYPES = ["manual", "daily", "weekly", "monthly"] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

function readCategory(value: unknown): Category | undefined {
  if (!isObject(value)) return undefined;
  const { id, name, enabled, extensions, subfolders, smartCategorization, duplicateDetection, dateFolders } = value;
  if (typeof id !== "string" || !id || typeof name !== "string" || !name.trim()) return undefined;
  if (typeof enabled !== "boolean" || typeof subfolders !== "boolean") return undefined;
  if (!Array.isArray(extensions) || !extensions.every((extension) => typeof extension === "string")) return undefined;
  if (!optionalBoolean(smartCategorization) || !optionalBoolean(duplicateDetection)) return undefined;
  return {
    id,
    name,
    enabled,
    subfolders,
    extensions: [...extensions],
    smartCategorization: smartCategorization === true,
    duplicateDetection: duplicateDetection === true,
    dateFolders: normalizeDateFolders(dateFolders),
  };
}

/**
 * Restore the rule list. A built-in category missing from an older save (for
 * example one added in a later release) is appended with its defaults.
 */
export function readCategories(value: unknown): Category[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const categories: Category[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const category = readCategory(item);
    if (!category || seen.has(category.id)) return undefined;
    seen.add(category.id);
    categories.push(category);
  }
  const defaults = createInitialCategories();
  for (const id of BUILT_IN_CATEGORY_IDS) {
    if (!seen.has(id)) categories.push(defaults.find((category) => category.id === id)!);
  }
  return categories;
}

export function readFilters(value: unknown): Filters | undefined {
  if (!isObject(value)) return undefined;
  const { dateModified, fileSize, excludeHidden } = value;
  if (!isOneOf(DATE_FILTERS, dateModified) || !isOneOf(SIZE_FILTERS, fileSize) || typeof excludeHidden !== "boolean") return undefined;
  return { dateModified, fileSize, excludeHidden };
}

export function readConflictResolution(value: unknown): ConflictResolution | undefined {
  return isOneOf(CONFLICTS, value) ? value : undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** The schedule as stored: the date is kept as an ISO string. */
export interface SavedSchedule {
  type: ScheduleType;
  /** 24-hour "HH:MM". */
  time: string;
  /** ISO date string, or null when no start date is set. */
  date: string | null;
}

export function readSchedule(value: unknown): SavedSchedule | undefined {
  if (!isObject(value)) return undefined;
  const { type, time, date } = value;
  if (!isOneOf(SCHEDULE_TYPES, type)) return undefined;
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  if (date !== null && (typeof date !== "string" || Number.isNaN(new Date(date).getTime()))) return undefined;
  return { type, time, date };
}
