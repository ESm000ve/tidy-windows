/**
 * Saved rule sets: named snapshots of rules, filters, and tools that can be
 * applied in one step, plus the file format used to share them.
 *
 * Folders are not part of a rule set, so a set made on one computer works on
 * another and applying one never changes where files come from or go.
 */
import { createInitialCategories } from "../constants";
import type { Category, ConflictResolution, Filters } from "../types";
import { normalizeNamingStyle, type NamingStyle } from "../../shared/naming";
import { readBoolean, readCategories, readConflictResolution, readFilters } from "./savedSettings";

export interface RuleSet {
  id: string;
  name: string;
  categories: Category[];
  filters: Filters;
  conflictResolution: ConflictResolution;
  smartRenameEnabled: boolean;
  namingStyle: NamingStyle;
  includeSubfolders: boolean;
  /** Built-in sets ship with Tidy and cannot be deleted. */
  builtIn?: boolean;
}

/** Identifies an exported file. */
const FILE_TYPE = "tidy-rule-sets";
const FILE_VERSION = 1;
const MAX_NAME_LENGTH = 60;
const MAX_SETS = 50;

const ANY_FILTERS: Filters = { dateModified: "any", fileSize: "any", excludeHidden: true };

/** Rule sets Tidy ships with. Recreated on each launch, so defaults stay current. */
export function builtInRuleSets(): RuleSet[] {
  const downloads = createInitialCategories().map((category) => ({ ...category, duplicateDetection: true }));
  const photos = createInitialCategories().map((category) =>
    category.id === "images"
      ? { ...category, enabled: true, subfolders: false, duplicateDetection: true, dateFolders: "month" as const }
      : { ...category, enabled: false },
  );
  return [
    {
      id: "builtin-downloads",
      name: "Downloads cleanup",
      categories: downloads,
      filters: ANY_FILTERS,
      conflictResolution: "archive",
      smartRenameEnabled: false,
      namingStyle: "descriptive",
      includeSubfolders: false,
      builtIn: true,
    },
    {
      id: "builtin-photos",
      name: "Photos by month",
      categories: photos,
      filters: ANY_FILTERS,
      conflictResolution: "rename",
      smartRenameEnabled: false,
      namingStyle: "descriptive",
      includeSubfolders: true,
      builtIn: true,
    },
  ];
}

export function newRuleSetId(): string {
  return `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function cleanRuleSetName(value: string): string {
  return value.replace(/[\x00-\x1f]/g, "").trim().slice(0, MAX_NAME_LENGTH);
}

/** Validate one stored or imported rule set. Returns undefined when unusable. */
export function readRuleSet(value: unknown): RuleSet | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? cleanRuleSetName(raw.name) : "";
  const categories = readCategories(raw.categories);
  const filters = readFilters(raw.filters);
  const conflictResolution = readConflictResolution(raw.conflictResolution);
  if (!name || !categories || !filters || !conflictResolution) return undefined;
  return {
    id: typeof raw.id === "string" && raw.id.startsWith("set_") ? raw.id : newRuleSetId(),
    name,
    categories,
    filters,
    conflictResolution,
    smartRenameEnabled: readBoolean(raw.smartRenameEnabled) ?? false,
    namingStyle: normalizeNamingStyle(raw.namingStyle),
    includeSubfolders: readBoolean(raw.includeSubfolders) ?? false,
  };
}

/** Validate the saved list. Invalid entries are dropped rather than failing the whole list. */
export function readRuleSets(value: unknown): RuleSet[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(readRuleSet).filter((set): set is RuleSet => !!set).slice(0, MAX_SETS);
}

/** The contents of an exported file. */
export function toExportFile(sets: RuleSet[]) {
  return {
    type: FILE_TYPE,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    ruleSets: sets.map(({ builtIn: _builtIn, ...set }) => set),
  };
}

/**
 * Read an exported file. Imported sets get new ids, and a name already in use
 * gets " (imported)" so nothing the user saved is overwritten.
 */
export function fromImportFile(value: unknown, existing: RuleSet[]): RuleSet[] | string {
  const file = value as { type?: unknown; version?: unknown; ruleSets?: unknown } | null;
  if (!file || file.type !== FILE_TYPE || !Array.isArray(file.ruleSets)) return "That file isn't a Tidy rule set export.";
  if (file.version !== FILE_VERSION) return "That rule set version is not supported. Export it again from a compatible version of Tidy.";
  const taken = new Set(existing.map((set) => set.name.toLowerCase()));
  const imported: RuleSet[] = [];
  for (const candidate of file.ruleSets) {
    const set = readRuleSet(candidate);
    if (!set) continue;
    let name = set.name;
    for (let copy = 1; taken.has(name.toLowerCase()); copy += 1) {
      name = cleanRuleSetName(`${set.name.slice(0, MAX_NAME_LENGTH - 16)} (imported${copy > 1 ? ` ${copy}` : ""})`);
    }
    taken.add(name.toLowerCase());
    imported.push({ ...set, id: newRuleSetId(), name });
  }
  if (existing.filter(set => !set.builtIn).length + imported.length > MAX_SETS) return "You can save up to 50 rule sets. Delete some before importing more.";
  return imported.length ? imported : "No usable rule sets were found in that file.";
}
