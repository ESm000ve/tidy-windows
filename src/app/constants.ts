/**
 * Static configuration for the organizer's built-in categories.
 *
 * These describe Tidy's default behaviour before the user (or the AI rule
 * parser) changes anything. Nothing here depends on runtime state, so it lives
 * outside the component tree.
 */
import type { Category } from "./types";
import { EBOOK_EXTENSIONS } from "../shared/ebookFormats";
import {
  Archive,
  Book,
  Document,
  Film,
  MusicList,
  PhotoFill,
  type Icon,
} from "./components/icons";

/** Identifiers of the categories Tidy ships with. */
export const BUILT_IN_CATEGORY_IDS = [
  "documents",
  "books",
  "images",
  "audio",
  "video",
  "archives",
] as const;

export type BuiltInCategoryId = (typeof BUILT_IN_CATEGORY_IDS)[number];

/**
 * Every extension Tidy offers per category. A category's *selected* extensions
 * are a subset of these; the full list is what the extension picker renders.
 */
export const AVAILABLE_EXTENSIONS: Record<BuiltInCategoryId, string[]> = {
  documents: ["pdf", "docx", "txt", "xlsx", "pptx", "pages", "numbers", "key", "csv", "md", "rtf", "odt"],
  books: [...EBOOK_EXTENSIONS],
  images: ["jpg", "jpeg", "png", "gif", "svg", "tiff", "raw", "heic", "webp", "bmp", "ico", "psd"],
  audio: ["mp3", "wav", "aac", "flac", "ogg", "m4a", "wma", "alac", "aiff"],
  video: ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v", "mpg", "3gp"],
  archives: ["zip", "tar", "gz", "rar", "7z", "dmg", "pkg", "iso", "bz2", "xz", "tgz", "cab"],
};

export const CATEGORY_ICONS: Record<string, Icon> = {
  documents: Document,
  books: Book,
  images: PhotoFill,
  audio: MusicList,
  video: Film,
  archives: Archive,
};

export const CATEGORY_COLORS: Record<string, string> = {
  documents: "blue",
  books: "blue",
  images: "purple",
  audio: "orange",
  video: "green",
  archives: "yellow",
};

/**
 * Subfolders Tidy creates when Smart Categorization is on. With it off, files
 * are filed by extension instead.
 */
export const SMART_SUBFOLDERS: Record<string, string[]> = {
  documents: ["Invoices", "Receipts", "Contracts", "Reports", "Presentations", "Other"],
  books: ["Fiction", "Nonfiction", "Comics", "Reference", "Other"],
  images: ["Screenshots", "Photos", "Scans", "Designs", "Other"],
  audio: ["Music", "Podcasts", "Voice Memos", "Sound Effects", "Other"],
  video: ["Recordings", "Movies", "Clips", "Tutorials", "Other"],
  archives: ["Backups", "Downloads", "Projects", "Other"],
};

const CATEGORY_LABELS: Record<BuiltInCategoryId, string> = {
  documents: "Documents",
  books: "Books",
  images: "Images",
  audio: "Audio",
  video: "Video",
  archives: "Archives",
};

/** A fresh set of default rules — also what "Reset All Rules" restores. */
export function createInitialCategories(): Category[] {
  return BUILT_IN_CATEGORY_IDS.map((id) => ({
    id,
    name: CATEGORY_LABELS[id],
    enabled: true,
    subfolders: true,
    smartCategorization: false,
    duplicateDetection: false,
    extensions: [...AVAILABLE_EXTENSIONS[id]],
  }));
}

/**
 * Windows 11 Fluent surface token:
 * a flat fill with a hairline inside stroke and no shadow, so cards sit flush
 * against the window background instead of floating above it.
 */
export const GLASS_SURFACE = "fluent-surface";

/** localStorage keys. Namespaced so they don't collide with anything else. */
export const STORAGE_KEYS = {
  includeSubfolders: "tidy_include_subfolders",
  namingStyle: "tidy_naming_style",
  metrics: "tidy_metrics",
  sourcePath: "tidy_source_path",
  destPath: "tidy_dest_path",
  categories: "tidy_categories",
  filters: "tidy_filters",
  conflictResolution: "tidy_conflict_resolution",
  smartRename: "tidy_smart_rename",
  schedule: "tidy_schedule",
  ruleSets: "tidy_rule_sets",
  watch: "tidy_watch_source",
} as const;
