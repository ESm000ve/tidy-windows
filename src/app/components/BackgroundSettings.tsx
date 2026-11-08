import { useEffect, useState } from "react";
import type { BackgroundSettings as Settings } from "../../electron";
import { FluentToggle } from "./controls/FluentToggle";
import { Clock, Play } from "./icons";

/**
 * Settings for running in the background: keep Tidy in the notification area
 * when its window is closed (so schedules keep running), and start it with
 * Windows. Stored by the main process, which owns the tray and startup entry.
 */
export function BackgroundSettings() {
  const available = typeof window.electron?.getBackgroundSettings === "function";
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!available) return;
    void window.electron!.getBackgroundSettings().then(setSettings).catch(() => setError("Could not read background settings."));
  }, [available]);

  async function save(next: { keepRunningInTray: boolean; startWithWindows: boolean }) {
    if (!window.electron) return;
    setBusy(true);
    setError("");
    try {
      const result = await window.electron.setBackgroundSettings(next);
      setSettings(result.settings);
      if (!result.success) setError(result.error || "Please try again.");
    } catch {
      setError("Could not save this setting. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const keep = settings?.keepRunningInTray ?? false;
  const startup = settings?.startWithWindows ?? false;
  const startupAvailable = settings?.startupAvailable ?? false;

  return (
    <section className="fluent-settings-group" aria-labelledby="settings-background">
      <h3 id="settings-background">Background</h3>
      <div className="fluent-settings-rows">
        <div className="fluent-settings-row">
          <Clock className="w-5 h-5" aria-hidden="true" />
          <div>
            <p id="background-tray-label">Keep running in the notification area</p>
            <p id="background-tray-help">Closing the window hides Tidy so scheduled runs continue. Exit from the Tidy icon near the clock.</p>
          </div>
          <FluentToggle
            checked={keep}
            disabled={!available || busy || !settings}
            onCheckedChange={(checked) => void save({ keepRunningInTray: checked, startWithWindows: checked && startup })}
            aria-labelledby="background-tray-label"
            aria-describedby="background-tray-help"
          />
        </div>
        <div className="fluent-settings-row">
          <Play className="w-5 h-5" aria-hidden="true" />
          <div>
            <p id="background-startup-label">Start Tidy when I sign in</p>
            <p id="background-startup-help">
              {startupAvailable
                ? "Tidy opens hidden in the notification area so your schedule is ready."
                : "Available in the installed app."}
            </p>
          </div>
          <FluentToggle
            checked={startup}
            disabled={!available || busy || !settings || !keep || !startupAvailable}
            onCheckedChange={(checked) => void save({ keepRunningInTray: keep, startWithWindows: checked })}
            aria-labelledby="background-startup-label"
            aria-describedby="background-startup-help"
          />
        </div>
      </div>
      {error && <p role="alert" className="fluent-settings-note">{error}</p>}
    </section>
  );
}
