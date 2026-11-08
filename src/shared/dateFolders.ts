/**
 * Year and month folders, shared by the organizer and the preview so both
 * describe the same destination.
 *
 * Dates come from the file's last-modified time in the computer's local time
 * zone. Photo capture dates (EXIF) are not read.
 */
export type DateFolders = "none" | "year" | "month";

export const DATE_FOLDER_OPTIONS: { value: DateFolders; label: string }[] = [
  { value: "none", label: "No date folders" },
  { value: "year", label: "Year (2026)" },
  { value: "month", label: "Year and month (2026\\03)" },
];

export function normalizeDateFolders(value: unknown): DateFolders {
  return value === "year" || value === "month" ? value : "none";
}

/** Folder names to append for a file modified at `modifiedMs`, e.g. ["2026", "03"]. */
export function dateFolderSegments(modifiedMs: number, mode: unknown): string[] {
  const style = normalizeDateFolders(mode);
  if (style === "none" || !Number.isFinite(modifiedMs)) return [];
  const date = new Date(modifiedMs);
  const year = String(date.getFullYear());
  return style === "year" ? [year] : [year, String(date.getMonth() + 1).padStart(2, "0")];
}
