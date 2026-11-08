/**
 * Recent runs, kept in the main process so manual, scheduled, and watched-
 * folder runs all share one Undo history.
 *
 * Each record holds the moves that can still be reversed. Undoing removes the
 * reversed moves from every record (Undo through the preview sheet and through
 * the history both pass through here), so no move is reversed twice.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { app } from "electron";
import type { Operation, OrganizeRequest, RunResult } from "../types";
import { setUndoGuard } from "./organizer";

/** Runs kept in the history. Older runs drop off and can no longer be undone here. */
const HISTORY_LIMIT = 10;

export type RunKind = "manual" | "scheduled" | "watch";

export interface RunRecord {
  id: string;
  kind: RunKind;
  /** ISO timestamp. */
  finishedAt: string;
  sourcePath: string;
  destPath: string;
  moved: number;
  renamed: number;
  duplicates: number;
  errors: number;
  /** Moves that have not been undone yet, oldest first. */
  operations: Operation[];
  /** True once every move in the run has been reversed. */
  undone: boolean;
}

/** What the renderer sees: a record without its (possibly long) move list. */
export type RunSummary = Omit<RunRecord, "operations"> & { remaining: number };

let records: RunRecord[] = [];
let historyPath = "";
let onChange: (() => void) | null = null;

const identity = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const operationKey = (operation: Operation) => operation.id ?? `${identity(operation.originalPath)}\u0000${identity(operation.newPath)}`;

/** An older run cannot reverse a path still used by a newer run. */
function undoConflict(operations: Operation[]): string | undefined {
  if (operations.some(operation => !operation.id && records.some(record => record.operations.some(saved =>
    identity(saved.originalPath) === identity(operation.originalPath) && identity(saved.newPath) === identity(operation.newPath))))) {
    return "Open the Activity Log to undo this saved run safely. No files were changed.";
  }
  const keys = new Set(operations.map(operationKey));
  const owners = records.map((record, index) => ({ record, index }))
    .filter(({ record }) => record.operations.some((operation) => keys.has(operationKey(operation))));
  if (!owners.length) {
    const paths = new Set(operations.flatMap(operation => [identity(operation.originalPath), identity(operation.newPath)]));
    if (records.some(record => record.operations.some(operation => paths.has(identity(operation.originalPath)) || paths.has(identity(operation.newPath))))) {
      return "This Undo record is out of date. Use the Activity Log to undo newer runs first. No files were changed.";
    }
  }
  for (const { record, index } of owners) {
    const paths = new Set(record.operations.filter(operation => keys.has(operationKey(operation)))
      .flatMap(operation => [identity(operation.originalPath), identity(operation.newPath)]));
    if (records.slice(0, index).some(newer => newer.operations.some(operation =>
      paths.has(identity(operation.originalPath)) || paths.has(identity(operation.newPath))))) {
      return "Undo the newer run that used these files first. No files were changed.";
    }
  }
  return undefined;
}

function isOperation(value: unknown): value is Operation {
  const candidate = value as Operation | null;
  return !!candidate && typeof candidate.originalPath === "string" && typeof candidate.newPath === "string"
    && typeof candidate.originalName === "string" && typeof candidate.newName === "string";
}

/** Load the history from the user-data folder. Call once, after `app.whenReady`. */
export function loadHistory(listener?: () => void): void {
  setUndoGuard(undoConflict);
  historyPath = path.join(app.getPath("userData"), "run-history.json");
  onChange = listener ?? null;
  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, "utf-8")) as unknown;
    if (!Array.isArray(parsed)) return;
    records = parsed
      .filter((record): record is RunRecord =>
        !!record && typeof record.id === "string" && Array.isArray(record.operations) && record.operations.every(isOperation))
      .slice(0, HISTORY_LIMIT)
      .map(record => ({ ...record, operations: record.operations.map(operation => ({ ...operation, id: operation.id ?? randomUUID() })) }));
  } catch {
    records = [];
  }
}

function save(): void {
  if (historyPath) {
    try {
      fs.writeFileSync(historyPath + ".tmp", JSON.stringify(records));
      fs.renameSync(historyPath + ".tmp", historyPath);
    } catch (error) {
      console.warn("Could not save the run history.", error);
    }
  }
  onChange?.();
}

/** Add a finished run to the history. Runs that moved nothing are not kept. */
export function recordRun(kind: RunKind, request: Pick<OrganizeRequest, "sourcePath" | "destPath">, result: RunResult): string | undefined {
  if (!result.success || !result.operations?.length) return undefined;
  const record: RunRecord = {
    id: randomUUID(),
    kind,
    finishedAt: new Date().toISOString(),
    sourcePath: request.sourcePath,
    destPath: request.destPath,
    moved: result.moved ?? 0,
    renamed: result.renamed ?? 0,
    duplicates: result.duplicates ?? 0,
    errors: result.errors ?? 0,
    operations: result.operations,
    undone: false,
  };
  records = [record, ...records].slice(0, HISTORY_LIMIT);
  save();
  return record.id;
}

export function listRuns(): RunSummary[] {
  return records.map(({ operations, ...summary }) => ({ ...summary, remaining: operations.length }));
}

export function getRunOperations(id: string): Operation[] | undefined {
  return records.find((record) => record.id === id)?.operations;
}

/**
 * Remove reversed moves from every record. `attempted` is what Undo was asked
 * to reverse; `remaining` is what it could not.
 */
export function applyUndo(attempted: Operation[], remaining: Operation[]): void {
  const kept = new Set(remaining.map(operationKey));
  const reversed = new Set(attempted.map(operationKey).filter((key) => !kept.has(key)));
  if (reversed.size === 0) return;
  let changed = false;
  for (const record of records) {
    const before = record.operations.length;
    record.operations = record.operations.filter((operation) => !reversed.has(operationKey(operation)));
    if (record.operations.length !== before) {
      changed = true;
      if (record.operations.length === 0) record.undone = true;
    }
  }
  if (changed) save();
}

/**
 * Drop moves whose files were inside deleted backup folders. Their Undo step
 * would only restore a replaced file that no longer exists.
 */
export function forgetPathsUnder(folders: string[]): void {
  const identity = (value: string) => (process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value));
  const roots = folders.map((folder) => identity(folder) + path.sep);
  let changed = false;
  for (const record of records) {
    const before = record.operations.length;
    record.operations = record.operations.filter((operation) => !roots.some((root) => identity(operation.newPath).startsWith(root)));
    if (record.operations.length !== before) changed = true;
  }
  if (changed) save();
}

/** Destination folders of every run in the history. */
export function historyDestinations(): string[] {
  return [...new Set(records.map((record) => record.destPath).filter(Boolean))];
}
