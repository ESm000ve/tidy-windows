import { useCallback, useEffect, useState } from "react";
import type { BackupStatus, RunSummary } from "../../electron";
import { Rotate as Undo } from "./icons";

const KIND_LABELS: Record<RunSummary["kind"], string> = {
  manual: "Manual run",
  scheduled: "Scheduled run",
  watch: "New files",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const folderName = (value: string) => value.split(/[\\/]/).filter(Boolean).pop() || value;

interface RunHistoryProps {
  /** The configured destination, so its backups are found even before a run is recorded. */
  destPath: string;
  /** Called after a run is undone from the history, with what could not be undone. */
  onRunUndone?: (id: string, remaining: number) => void;
}

/**
 * Recent runs from every source (manual, scheduled, watched folder), each with
 * its own Undo, plus cleanup for the backups "Replace existing" keeps.
 */
export function RunHistory({ destPath, onRunUndone }: RunHistoryProps) {
  const available = typeof window.electron?.listRunHistory === "function";
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [backups, setBackups] = useState<BackupStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const refresh = useCallback(async () => {
    if (!window.electron?.listRunHistory) return;
    try {
      const [history, status] = await Promise.all([
        window.electron.listRunHistory(),
        window.electron.getBackupStatus(destPath ? [destPath] : []),
      ]);
      setRuns(history);
      setBackups(status);
    } catch {
      setMessage({ text: "Could not read the run history.", failed: true });
    }
  }, [destPath]);

  useEffect(() => {
    if (!available) return;
    void refresh();
    return window.electron!.onHistoryChanged(() => void refresh());
  }, [available, refresh]);

  async function undo(run: RunSummary) {
    if (!window.electron) return;
    setBusyId(run.id);
    setMessage(null);
    try {
      const result = await window.electron.undoRun(run.id);
      const remaining = result.remainingOperations?.length ?? 0;
      onRunUndone?.(run.id, remaining);
      if (result.error) setMessage({ text: result.error, failed: true });
      else if (!result.success) setMessage({ text: `Restored ${result.reverted ?? 0} file(s). ${result.errors ?? 0} could not be restored because a file is in the way or missing.`, failed: true });
      else setMessage({ text: `Restored ${result.reverted ?? 0} file(s) to where they were.`, failed: false });
    } catch {
      setMessage({ text: "Undo failed. Please try again.", failed: true });
    } finally {
      setBusyId(null);
      void refresh();
    }
  }

  async function cleanUp() {
    if (!window.electron) return;
    setBusyId("backups");
    setMessage(null);
    try {
      const result = await window.electron.cleanUpBackups(destPath ? [destPath] : []);
      setBackups(result.status);
      setMessage(result.success ? { text: "Backups moved to the Recycle Bin.", failed: false } : { text: result.error ?? "Could not clean up backups.", failed: true });
    } catch {
      setMessage({ text: "Could not clean up backups. Please try again.", failed: true });
    } finally {
      setBusyId(null);
      setConfirmingCleanup(false);
      void refresh();
    }
  }

  if (!available) return null;

  return (
    <section aria-labelledby="run-history-title" className="flex flex-col gap-3">
      <h3 id="run-history-title" className="text-[12px] font-semibold text-muted-foreground">Recent runs</h3>
      {runs.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Runs that move files appear here, including scheduled runs and new files from a watched folder.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Recent runs">
          {runs.map((run) => (
            <li key={run.id} className="flex items-center gap-3 p-3 rounded-lg bg-black/5 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05]">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[14px] font-medium text-foreground truncate">
                  {KIND_LABELS[run.kind]} · {formatWhen(run.finishedAt)}
                </span>
                <span className="text-[12px] text-muted-foreground truncate" title={`${run.sourcePath} → ${run.destPath}`}>
                  Moved {run.moved}{run.renamed ? `, renamed ${run.renamed}` : ""}{run.errors ? `, ${run.errors} failed` : ""} · {folderName(run.sourcePath)} → {folderName(run.destPath)}
                </span>
              </div>
              {run.undone ? (
                <span className="text-[12px] text-muted-foreground shrink-0">Undone</span>
              ) : (
                <button
                  type="button"
                  className="fluent-button shrink-0"
                  disabled={busyId !== null || run.remaining === 0}
                  aria-label={`Undo ${KIND_LABELS[run.kind].toLowerCase()} from ${formatWhen(run.finishedAt)}`}
                  title={run.remaining === 0 ? "Nothing left to undo" : `Put back ${run.remaining} file move(s)`}
                  onClick={() => void undo(run)}
                >
                  <Undo className="w-3 h-3" aria-hidden="true" />
                  {busyId === run.id ? "Undoing…" : "Undo"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-muted-foreground">Tidy keeps the last 10 runs. Undo puts files back unless something else is now in their place.</p>

      <div className="flex flex-col gap-2 pt-3 border-t border-black/5 dark:border-white/[0.08]">
        <h3 className="text-[12px] font-semibold text-muted-foreground">Backups of replaced files</h3>
        <p className="text-[12px] text-muted-foreground">
          {!backups || backups.files === 0
            ? "No backups. They are created when “Replace existing” overwrites a file."
            : `${backups.files} file(s), ${formatBytes(backups.bytes)}, in ${backups.folders.length} “.Tidy Undo” folder(s).`}
        </p>
        {backups && backups.files > 0 && (confirmingCleanup ? (
          <div className="flex flex-col gap-2" role="group" aria-label="Confirm backup cleanup">
            <p className="text-[12px] text-foreground">Move these backups to the Recycle Bin? Undo will no longer bring back the files they replaced.</p>
            <div className="flex gap-2">
              <button type="button" className="fluent-button" disabled={busyId !== null} onClick={() => void cleanUp()}>
                {busyId === "backups" ? "Cleaning up…" : "Move to Recycle Bin"}
              </button>
              <button type="button" className="fluent-button" disabled={busyId !== null} onClick={() => setConfirmingCleanup(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="fluent-button w-fit" disabled={busyId !== null} onClick={() => setConfirmingCleanup(true)}>Clean up backups</button>
        ))}
      </div>

      {message && <p role={message.failed ? "alert" : "status"} className="text-[12px] text-foreground">{message.text}</p>}
    </section>
  );
}
