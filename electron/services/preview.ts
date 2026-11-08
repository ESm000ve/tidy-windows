/**
 * Building the preview: what a run *would* do, without touching anything.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  abbreviateHome,
  buildExtensionMap,
  DuplicateFinder,
  formatBytes,
  passesFilters,
  walkSourceFiles,
  type SourceScanOptions,
} from "../lib/files";
import { cacheKey, getCachedRename, saveRenameCache, setCachedRename } from "./renameCache";
import { suggestRenames } from "./smartRename";
import { getApiKey } from "./gemini";
import { normalizeNamingStyle, type NamingStyle } from "../../src/shared/naming";
import type { CategoryRule, FileForRename, PreviewEntry, RenameSuggestion, RunFilters } from "../types";

/**
 * Preview is capped so a folder with thousands of files still opens promptly.
 * The run itself is not capped — it processes everything.
 */
const PREVIEW_FILE_LIMIT = 50;

/** Files per Smart Rename request. Batches are sent concurrently. */
const RENAME_BATCH_SIZE = 10;

/** Enumerate the files in `sourcePath` and describe what would happen to each. */
async function collectEntries(
  sourcePath: string,
  categories: CategoryRule[],
  filters: RunFilters,
  scope: SourceScanOptions,
): Promise<PreviewEntry[]> {
  const extensionMap = buildExtensionMap(categories, { enabledOnly: true });
  const duplicates = new DuplicateFinder<string>();
  const entries: PreviewEntry[] = [];

  for await (const file of walkSourceFiles(sourcePath, { ...scope, excludeHidden: filters.excludeHidden })) {
    const { name: filename, path: fullPath, stats } = file;
    const extension = path.extname(filename).toLowerCase();
    const category = extensionMap.get(extension);
    if (!category || !passesFilters(stats, filename, filters)) continue;

    let isDuplicate = false;
    let duplicateOf: string | undefined;

    if (category.duplicateDetection) {
      try {
        duplicateOf = await duplicates.check(fullPath, stats.size, file.relativePath);
        isDuplicate = duplicateOf !== undefined;
      } catch (error) {
        // An unreadable file is simply not compared; it still appears in the list.
        console.warn(`Could not fingerprint ${filename}.`, error);
      }
    }

    entries.push({
      id: crypto.randomUUID(),
      name: filename,
      relativePath: file.relativePath,
      ext: extension.slice(1),
      size: formatBytes(stats.size),
      sizeBytes: stats.size,
      from: abbreviateHome(path.dirname(fullPath)),
      path: fullPath,
      category: (category?.name ?? "Other").toLowerCase(),
      categoryId: category.id,
      modifiedMs: stats.mtimeMs,
      needsReview: false,
      isDuplicate,
      duplicateOf,
    });

    if (entries.length >= PREVIEW_FILE_LIMIT) break;
  }

  return entries;
}

/**
 * Attach AI rename suggestions to the entries, reusing cached results and
 * requesting the rest in concurrent batches.
 */
async function attachRenameSuggestions(entries: PreviewEntry[], style: NamingStyle): Promise<void> {
  const suggestions: Record<string, RenameSuggestion> = {};
  const pending: (FileForRename & { key: string })[] = [];
  const online = !!getApiKey();

  for (const entry of entries) {
    const key = cacheKey(entry.path, entry.sizeBytes, entry.modifiedMs, style);
    const cached = getCachedRename(key);
    if (cached && (!online || cached.source === "ai")) {
      suggestions[entry.id] = cached;
    } else {
      pending.push({ id: entry.id, name: entry.name, path: entry.path, size: entry.sizeBytes, modifiedMs: entry.modifiedMs, key });
    }
  }

  if (pending.length > 0) {
    const batches: Promise<void>[] = [];
    for (let index = 0; index < pending.length; index += RENAME_BATCH_SIZE) {
      const batch = pending.slice(index, index + RENAME_BATCH_SIZE);
      batches.push(
        suggestRenames(batch, style).then((batchSuggestions) => {
          for (const [fileId, suggestion] of Object.entries(batchSuggestions)) {
            suggestions[fileId] = suggestion;
            const source = batch.find((file) => file.id === fileId);
            if (source) setCachedRename(source.key, suggestion);
          }
        }),
      );
    }
    await Promise.all(batches);
    saveRenameCache();
  }

  for (const entry of entries) {
    const suggestion = suggestions[entry.id];
    // A suggestion identical to the current name is not worth showing.
    if (!suggestion || (suggestion.suggested === entry.name && !suggestion.subfolder)) continue;
    entry.smartRename = {
      source: suggestion.source,
      suggested: suggestion.suggested,
      reason: suggestion.reason || "AI generated suggestion",
      confidence: suggestion.confidence || "medium",
      subfolder: suggestion.subfolder,
    };
    entry.classSource = suggestion.source === "local" ? "metadata" : "ai";
  }
}

/**
 * Scan a folder and return what the preview sheet should show.
 *
 * Missing or unreadable folders throw so the UI can distinguish an error from
 * an empty folder. Only matching rules and filters enter the preview or AI call.
 */
export async function buildPreview(
  sourcePath: string,
  categories: CategoryRule[],
  smartRenameEnabled = false,
  filters: RunFilters = { dateModified: "any", fileSize: "any", excludeHidden: false },
  namingStyle: NamingStyle = "descriptive",
  scope: SourceScanOptions = {},
): Promise<PreviewEntry[]> {
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("The source folder no longer exists. Choose it again.");
    const entries = await collectEntries(sourcePath, categories, filters, scope);
    const aiEntries = entries.filter(entry => !entry.isDuplicate && (smartRenameEnabled || categories.some(category => category.id === entry.categoryId && category.smartCategorization)));
    if (aiEntries.length > 0) {
      await attachRenameSuggestions(aiEntries, normalizeNamingStyle(namingStyle));
    }
    return entries;
}
