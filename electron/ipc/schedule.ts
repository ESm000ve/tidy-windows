/**
 * Unattended runs.
 *
 * The renderer pushes its whole config whenever anything changes, so this
 * always cancels the existing job before deciding whether to schedule a new
 * one — otherwise editing the schedule would stack duplicate jobs.
 */
import { ipcMain } from "electron";
import schedule from "node-schedule";
import { CHANNELS } from "../channels";
import { runOrganizeJob } from "../services/organizer";
import { notify } from "../services/background";
import { recordRun } from "../services/history";
import type { OrganizeRequest, ScheduleSettings } from "../types";

/** Day-of-week for weekly runs (Monday) and day-of-month for monthly runs. */
const WEEKLY_DAY = 1;
const MONTHLY_DAY = 1;

let currentJob: schedule.Job | null = null;

/** Translate the UI's frequency and time into a cron expression. */
function toCronExpression({ frequency, time }: ScheduleSettings): string | null {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  switch (frequency) {
    case "daily":
      return `${minutes} ${hours} * * *`;
    case "weekly":
      return `${minutes} ${hours} * * ${WEEKLY_DAY}`;
    case "monthly":
      return `${minutes} ${hours} ${MONTHLY_DAY} * *`;
    default:
      return null;
  }
}

export function registerScheduleHandlers(): void {
  ipcMain.handle(
    CHANNELS.scheduleSave,
    (_event, config: OrganizeRequest & { schedule?: ScheduleSettings }) => {
      currentJob?.cancel();
      currentJob = null;

      const settings = config.schedule;
      if (!settings?.enabled || settings.frequency === "manual") {
        return { success: true, message: "Schedule disabled" };
      }

      const cronExpression = toCronExpression(settings);
      if (!cronExpression) {
        return { success: false, error: `Could not schedule "${settings.frequency}" at "${settings.time}".` };
      }

      const { schedule: _schedule, ...runConfig } = config;
      const start = settings.date ? new Date(settings.date) : new Date();
      if (Number.isNaN(start.getTime())) return { success: false, error: "Invalid schedule start date." };
      currentJob = schedule.scheduleJob({ rule: cronExpression, start }, async () => {
        // A scheduled run has no window to report to, so it runs without
        // callbacks and reports through a Windows notification instead.
        const result = await runOrganizeJob(runConfig);
        recordRun("scheduled", runConfig, result);
        if (!result.success) {
          console.error("Scheduled run failed:", result.error);
          notify("Scheduled Tidy run failed", result.error ?? "Open Tidy and run it manually to see what went wrong.");
        } else if (result.errors) {
          notify("Scheduled Tidy run finished with problems", `Moved ${result.moved ?? 0} file(s); ${result.errors} could not be moved.`);
        } else if (result.moved) {
          notify("Scheduled Tidy run finished", `Moved ${result.moved} file(s)${result.renamed ? `, renamed ${result.renamed}` : ""}.`);
        }
      });

      if (!currentJob) {
        return { success: false, error: "The scheduler rejected that time." };
      }
      return { success: true, message: "Scheduled successfully" };
    },
  );
}
