# Native features pass — November 6, 2026

Adds the remaining native features. No new dependencies.

- **Activity Log run history.** The last 10 runs (manual, scheduled, and watched-folder) are kept in the main process (`run-history.json` in the user profile), each with its own Undo. Undo from the preview, the Last Run section, or the history updates every record, so a move is never reversed twice. Scheduled runs can now be undone.
- **Clean up backups.** The Activity Log shows how much `.Tidy Undo` holds across every destination in the history and sends those folders to the Recycle Bin after a confirmation. Moves that pointed into them are dropped from the history; the rest of each run can still be undone.
- **Watched folder.** "Tidy new files automatically" under Schedule watches the source folder. A file moves once it has been unchanged for about five seconds and doesn't have an in-progress download name. Only files that arrive after watching starts are moved, files without a matching rule stay, and files Undo puts back are not moved again unless they change. Each batch is recorded in the history and shows a notification. It runs while Tidy is open, or in the notification area with the Background setting.
- **Year/month folders.** Each category has a Date folders setting: none, year, or year and month, from the last-modified date. The preview shows the date folder, the AI rule parser can set it, and the review summary lists it.
- **Rule sets.** Choose, save, delete, import, and export named rule sets from the Automated rules section. "Downloads cleanup" and "Photos by month" are built in. Folders are not part of a set. Imports are validated, and names already in use get "(imported)".
- **Tidy this folder.** `installer/explorer-menu.nsh` (wired through `nsis.include`) adds the item to the right-click menu for folders, folder backgrounds, and drives for the current user, and removes it on uninstall. Tidy opens (or comes to the front, from the tray too) with that folder as the source and shows the preview. The `--tidy-folder` argument is validated as an existing folder, and Explorer's `"C:\"` quoting quirk for drives is handled.
- **Fixes found while testing.** The Activity Log's "Last Run" label failed color contrast, the last-run list is capped at 200 rows, and the watched-folder and schedule note under Schedule now mentions the Background setting.

## Verification

- New `npm run test:features` (6 groups): date folders, `onlyPaths`, history record/undo/persist/limit, backup measure/recycle/undo, watched folder (download settling, new files only, no rule, Undo respected), rule set import/export and validation.
- New `npm run test:features:desktop` against the Electron app: Explorer launch argument, rule sets (apply, save, export, delete, import), date folders in preview and run, history Undo syncing the last-run record, backup cleanup, and the watched folder.
- All existing suites still pass (`test:files` with the Windows-only name check skipped on Linux, `test:subfolders`, `test:duplicates`, smoke 12/12, `test:desktop`, `test:subfolders:desktop`, `test:source-choices`, `test:books`, `test:a11y` 0 violations, `test:fluent`). An extra axe scan of the rule-set form and Activity Log found one existing contrast problem, now fixed.
- `installer/explorer-menu.nsh` compiles with NSIS 3. The full installer build needs Windows (it runs Wine on Linux), so the registry entries and the Windows 11 menu were not tried here.

Please run on Windows: `npm run test:features`, `npm run test:features:desktop`, `npm run build:win`, then install, right-click a folder › Show more options › Tidy this folder, and try the watched folder with a real browser download.

# Final cleanup pass — November 6, 2026

This pass fixes bugs that show up on large runs, speeds up duplicate checks and Smart Rename, removes unused code, and adds two features: remembered settings and running in the background. No new dependencies were added; one unused one (`sonner`) was removed.

## Bug fixes

- **Run Log on large runs.** Each line used to fade in slightly after the one before it, so on a 1,000-file run the last lines appeared about 30 seconds late. The drawer now shows the newest 300 lines immediately, with a note about how many earlier lines are hidden. The footer shows the total.
- **Run Log lines going missing.** The last lines of a run, including "Run completed", could arrive after the app had stopped listening and were dropped. A 400-file run showed 373 of 403 lines. The log listener now stays attached, and lines are rendered in batches a few times a second instead of once per file.
- **Run Log text in light mode.** Info lines used white text, which was invisible on the light theme.
- **Post-run recap.** The preview's "Operations Recap" lists the first 200 moves, plus a pointer to the Audit Log for the rest.
- **Audit Log folder label.** "from …" now shows the parent folder name. It used to show the full path, because it split on `/` instead of the Windows `\`.
- **Settings now survive a restart.** Rules, filters, the conflict setting, Smart Rename, and the schedule are saved. Previously they reset to defaults, and the schedule went back to Manual. Saved values are validated on load, and a corrupt or old value falls back to the default. A built-in category added in a later version is appended to saved rules.
- **Open-folder safety.** The "open folder" request only opens real folders. It can no longer be used to open (run) a file.
- **Gemini model retirement.** Requests go to `gemini-2.5-flash`. If Google answers that the model doesn't exist, Tidy switches to Google's rolling `gemini-flash-latest` alias, and remembers the switch until restart. Set `TIDY_GEMINI_MODEL` to pin another model.

## Optimizations

- **Duplicate detection** only reads and hashes files whose size matches another candidate. Files with a unique size are never read. Preview and run still agree, and the result is the same as hashing everything.
- **Smart Rename** asks Gemini for a fixed response format keyed by file, and turns off extended "thinking". This makes it faster and cheaper, and malformed replies are rarer. The existing validation still runs.
- **Listing source folders** for the folder picker no longer checks every file.
- The file-type list in Locations is computed once per rule change instead of on every render.

## Removed

- The Python script generator. It was only used when the app ran in a plain browser, and it had a broken default path and a destructive "overwrite" mode. Shared types moved to `src/app/types.ts`. Run `Cleanup-Tidy.ps1` to move the now-unused `src/app/lib/generateScript.ts` out of the project.
- The `sonner` toast library. It was loaded but never displayed anything.
- Four unused icon exports.
- `Run Tidy.cmd` now launches `release\win-unpacked\Tidy.exe`, or the installed copy. It no longer searches old test-build folders.

## New: running in the background

Settings has a new **Background** section:

- **Keep running in the notification area.** Closing the window hides Tidy next to the clock, so schedules keep running. The tray icon has Open Tidy, Run Tidy…, and Exit Tidy. File › Exit, signing out, and shutting down still quit normally. The first time Tidy hides, a notification explains where it went.
- **Start Tidy when I sign in.** This registers a Windows startup entry that launches Tidy hidden in the notification area, so a saved schedule is armed after a restart. It needs the setting above and only works in the installed app, because a development build would register Electron itself.
- **Scheduled runs report through Windows notifications**: when they move files, finish with problems, or fail.

## Disk cleanup

`Cleanup-Tidy.ps1` moves old installers (1.0.0 and 1.0.1), intermediate test builds in `release\`, `.test-artifacts\`, `capture.mjs`, and the unused generator file into `_to_delete\`. Nothing is deleted. Run it once to see what would move, then again with `-Apply`:

```powershell
powershell -ExecutionPolicy Bypass -File .\Cleanup-Tidy.ps1
powershell -ExecutionPolicy Bypass -File .\Cleanup-Tidy.ps1 -Apply
```

The current 1.0.2 installer, `release\latest.yml`, and `release\win-unpacked` are kept. Note that the review documents link to evidence files in `.test-artifacts`; running the test suites recreates that folder.

## Verification

Run in a Linux build of the same code, using Electron under a virtual display:

- TypeScript check and production build passed.
- `test:files` passed all 11 groups, with one Windows-only reserved-name assertion skipped (Linux allows those names). `test:subfolders` passed 11 groups. The new `test:duplicates` passed (also added to CI).
- Browser smoke test: 12/12.
- Desktop suites against the Electron app: `test:desktop`, `test:subfolders:desktop`, `test:source-choices`, `test:books`, `test:a11y` (0 WCAG violations), and `test:fluent` all passed. `desktop-test.mjs` was updated because Smart Rename is now remembered after a reload.
- `test:key` could not run here, because this Linux sandbox has no secure-storage keyring. The key code is unchanged apart from a larger output limit on the connection test.
- Ad hoc checks: a 1,500-file run (log cap, recap cap, every file moved), settings persisting across reload and recovering from corrupt values, close-to-tray keeping the window alive, hidden launch loading the app without showing it, background settings saved, and the Gemini fallback (404 → alias, other errors not retried).

Not verified here: live Gemini calls (no key in this environment), the actual Windows tray icon and notifications, and the Windows startup entry. Please run on Windows:

```powershell
npm ci
npm run typecheck
npm run test:files
npm run test:duplicates
npm run test:key
npm run test:desktop
npm run test:ai        # optional, uses your key
npm run build:win:unpacked
```

Then in the built app, turn on both Background settings, close the window, confirm the tray icon works, and sign out and back in once. Consider bumping the version in `package.json` before building an installer.
