import { clsx } from "clsx";
import { format } from "date-fns";



import { FluentTimePicker } from "./FluentTimePicker";
import { FluentToggle } from "./controls/FluentToggle";

interface BottomPanelProps {
  scheduleType: "manual" | "daily" | "weekly" | "monthly";
  onScheduleTypeChange: (type: "manual" | "daily" | "weekly" | "monthly") => void;
  scheduleTime: string;
  onScheduleTimeChange: (time: string) => void;
  scheduleDate: Date | null;
  onScheduleDateChange: (date: Date | undefined) => void;
  conflictResolution: "rename" | "overwrite" | "skip" | "archive";
  onConflictResolutionChange: (res: "rename" | "overwrite" | "skip" | "archive") => void;
  watchEnabled: boolean;
  onWatchEnabledChange: (enabled: boolean) => void;
  watchStatus: { watching: boolean; error?: string };
  /** False until both a source and a destination are chosen. */
  canWatch: boolean;
}

// ─── Design tokens — match App-wide spec ──────────────────────────────────────
const CARD_CLS = "fluent-surface";

/** Windows 11 Fluent Dropdown Selector */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

function FluentSelect({
  value,
  onValueChange,
  options,
  label,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="w-full bg-black/5 dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-[14px] h-9 px-3 hover:bg-black/10 dark:hover:bg-white/[0.08] transition-colors"
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border-black/10 dark:border-white/15">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-[14px] focus:bg-blue-500/10 focus:text-foreground">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SEGMENTS = ["manual", "daily", "weekly", "monthly"] as const;

export function BottomPanel({
  scheduleType, onScheduleTypeChange,
  scheduleTime, onScheduleTimeChange,
  scheduleDate, onScheduleDateChange,
  conflictResolution, onConflictResolutionChange,
  watchEnabled, onWatchEnabledChange, watchStatus, canWatch,
}: BottomPanelProps) {
  return (
    <section className="space-y-3" aria-label="Schedule and Conflict Resolution">
      <h2 className="text-[20px] font-semibold text-foreground pl-0.5">Schedule and conflicts</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Schedule Card — no blur, no shadow ── */}
        <div className={`rounded-lg p-5 ${CARD_CLS}`}>
          <label className="text-[14px] text-muted-foreground block mb-3" id="frequency-label">Frequency</label>

          <div className="flex flex-col gap-4">

            {/* Segmented Control — recessed pill track */}
            <div
              role="radiogroup"
              aria-labelledby="frequency-label"
              className="fluent-frequency flex items-center gap-2 w-fit select-none"
            >
              {SEGMENTS.map((type) => (
                <button
                  key={type}
                  role="radio"
                  tabIndex={scheduleType === type ? 0 : -1}
                  onKeyDown={event => {
                      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                      const index = event.key === "Home" ? 0 : event.key === "End" ? SEGMENTS.length - 1 : (SEGMENTS.indexOf(type) + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + SEGMENTS.length) % SEGMENTS.length;
                    onScheduleTypeChange(SEGMENTS[index]);
                    (event.currentTarget.parentElement?.children[index] as HTMLElement)?.focus();
                  }}
                  onClick={() => onScheduleTypeChange(type)}
                  aria-checked={scheduleType === type}
                  className={clsx(
                    "px-3.5 py-[5px] text-[14px] rounded-[4px] transition-all capitalize",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fluent-focus-ring)]",
                    scheduleType === type ? "text-foreground dark:text-white bg-white shadow-sm dark:bg-white/[0.12] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.14)]" : "text-muted-foreground hover:text-foreground dark:hover:text-[var(--fluent-secondary-label)]"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Time + Date */}
            {scheduleType !== "manual" && (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <FluentTimePicker value={scheduleTime} onChange={onScheduleTimeChange} />

                <input type="date" className="fluent-time" aria-label="Schedule start date"
                  value={scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : ""}
                  onChange={event => onScheduleDateChange(event.target.value ? new Date(event.target.value + "T00:00:00") : undefined)} />
              </div>
            )}

            {/* Watched folder */}
            <div className="flex items-start justify-between gap-4 pt-3 border-t border-black/5 dark:border-white/[0.08]">
              <div className="flex flex-col gap-0.5">
                <span id="watch-label" className="text-[14px] text-foreground">Tidy new files automatically</span>
                <span id="watch-help" className="text-[12px] text-muted-foreground">
                  {!canWatch
                    ? "Choose a source and destination first."
                    : watchStatus.error
                      ? watchStatus.error
                      : watchEnabled && watchStatus.watching
                        ? "Watching the source folder. New files move once they finish downloading; Undo is in the Activity Log."
                        : "Watch the source folder and file new arrivals with these rules, without a preview."}
                </span>
              </div>
              <FluentToggle
                checked={watchEnabled}
                onCheckedChange={onWatchEnabledChange}
                disabled={!canWatch && !watchEnabled}
                aria-labelledby="watch-label"
                aria-describedby="watch-help"
              />
            </div>
          </div>
        </div>

        {/* ── Conflict Resolution Card — no blur, no shadow ── */}
        <div className={`rounded-lg p-5 ${CARD_CLS}`}>
          <label className="text-[14px] text-muted-foreground block mb-3" id="conflict-label">If a file already exists</label>
          <div className="space-y-3">
            <FluentSelect
              value={conflictResolution}
              onValueChange={(v) => onConflictResolutionChange(v as any)}
              label="Conflict resolution strategy"
              options={[
                { value: "rename", label: "Keep both (append a number)" },
                { value: "archive", label: "Archive duplicates" },
                { value: "skip", label: "Skip the file" },
                { value: "overwrite", label: "Replace existing (keep backup)" },
              ]}
            />
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              {conflictResolution === "overwrite" ? "Replaced files are kept in .Tidy Undo inside the destination, so Undo can restore them." : "Archive puts duplicates in Duplicates_Archive. Tidy never deletes duplicates automatically."}
            </p>
          </div>
        </div>

      </div>
      <p className="text-[12px] text-muted-foreground">Schedules and the watched folder run while Tidy is open. To keep them running after you close the window, turn on Keep running in the notification area in Settings. Weekly runs occur on Monday; monthly runs on the first day.</p>
    </section>
  );
}
