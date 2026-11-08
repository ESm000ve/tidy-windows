# Tidy: Windows release QA and diagnosis

**Historical initial review.** The two reproduced blockers and several related issues were subsequently fixed in source. See [the follow-up verification](WINDOWS-CORE-VERIFICATION.md) for current results and remaining native Windows release gates. Findings below describe the pre-fix code unless explicitly covered by that follow-up.

Version 1.1.1 removes the optional Explorer context menu at the user's request, so the Explorer-specific checks below no longer apply. Current results are in [Windows verification](WINDOWS-NATIVE-VERIFICATION.md).

Review date: November 6, 2026. Source version: 1.0.2 with the new Pass 2/3 changes present. This review does not certify the old 1.0.2 installer as containing these changes.

## Release decision

**Hold release and keep automatic watching away from personal folders until the two reproduced issues below are fixed.** The supplied suites pass but miss these cases. This review changes no application code, registry entries, startup settings, installed application, or user files.

Executed on Windows for this review:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:duplicates`: passed.
- `npm.cmd run test:features`: all six groups passed.
- Two additional service-level reproductions using synthetic files: both exposed defects. Evidence: `.test-artifacts/qa-review-U31EGK/findings.json`.

Not executed in this review: reinstall/uninstall, sign-out, real downloads, actual Recycle Bin operations, notifications, live Gemini requests, network/OneDrive tests, and the full desktop suites. Earlier 1.0.2 verification predates these source changes and cannot certify them.

### Confirmed blockers and repair directions

1. **Older-run Undo can restore the wrong version.** Move `same.txt` containing VERSION A in run A. Create VERSION B under the same original name and move it with Replace existing in run B. Undo run A first. Observed: source receives VERSION B, destination becomes empty, and Undo reports success. Run A's file is actually in run B's replacement backup. `restoreOperations` identifies a move only by paths; it does not verify that the current file belongs to that operation. Inspect `electron/services/organizer.ts:274` and `electron/services/history.ts:44`. The smallest safe initial fix is to refuse an older Undo when a newer outstanding operation touches either path; require newer runs to be undone first. Track unique operation IDs rather than removing history entries solely by an original/new path pair. Also verify file identity/content before restoring a file changed outside Tidy. Add regressions for overlapping replacement runs, repeated path pairs, edited destinations, and partial Undo. A global file lock prevents simultaneous operations; it does not solve dependencies between completed runs.

2. **Watch does not enforce “new files only.”** Create `existing.txt` before enabling Watch, then edit it after enabling. Observed: it moves after settling. `fs.watch` events go directly to `consider` without a baseline of existing files (`electron/services/watch.ts:89`, `:107`). Track the initial eligible file identities and distinguish new arrivals from modifications. Define how deletions/re-creations and renames count. Add a test that edits a baseline file, not just one that leaves it untouched. Persist enough Undo suppression state if “not re-moved” must survive restart. Until fixed, turn Watch off.

### Other source-level concerns requiring a test or repair

- Watch permits equal source/destination with recursion off, then excludes every candidate under that destination (`watch.ts:102`). Reject that configuration clearly or limit exclusion to generated output. Use a separator-aware containment check; the current bare prefix can also exclude a sibling whose name starts with the destination's name.
- A five-second pause in size/mtime is a heuristic, not a download-completion guarantee. A writer may pause for longer, keep a handle open, or resume later. Never treat this as proof of completion. Prefer completed-download renames, revalidate immediately before moving, and retain failed candidates for bounded retries. Current Watch drops ready candidates after a non-busy result, including per-file move errors (`watch.ts:155`).
- Watch errors stop the watcher in the main process, but there is no status-change event back to the renderer. The UI can continue to say it is watching. Add a watch-status event and a clear retry path.
- Undo history is written directly to its only JSON file, after a run completes (`history.ts:71`). An interrupted write can lose history; a crash mid-run has no durable journal. Use a temporary file plus atomic replacement and retain a known-good copy; an actual recovery guarantee also needs per-operation durable intent/completion records. Do not advertise crash recovery before implementing it.
- Cross-volume moves copy directly to the final destination and then unlink the source (`electron/lib/files.ts:149`). A failed copy, disk-full condition, interrupted process, or failed unlink can leave partial/orphan output with no completed operation recorded. Use an exclusive temporary destination, verify the completed copy, publish without clobbering an unrelated file, then unlink and record recoverable state. Test Windows metadata, timestamps, and alternate streams if their preservation is promised.
- `fromImportFile` exports a version but does not validate it; the 50-set limit is applied when loading saved settings, not inside the importer (`src/app/lib/ruleSets.ts:117`). Reject unsupported versions and enforce a consistent capacity during save/import. An import must not appear successful and then silently lose sets after restart.
- Schedule-save results are ignored in `src/app/App.tsx:169`. Watch and scheduled runs do not provide the manual run's log callbacks. An error notification or aggregate count is not a durable per-file diagnostic log. Surface scheduler failures and keep a small, redacted diagnostic file with run IDs, kinds, operation paths, error codes and counts, excluding keys and file contents.
- The feature test replaces `shell.trashItem` with a fake. The desktop feature test also replaces trash behavior and native file dialogs. Passing them verifies application wiring, not Windows recycling or dialog behavior.

## Ordered test checklist

Check each item off and record build version/hash, Windows version, expected/observed result, and evidence. For any wrong-file move, unexplained overwrite, or hash mismatch, stop automatic tests and preserve the entire sandbox. Do not keep retrying destructive actions.

### 0. Prepare safe fixtures

- [ ] Use a Windows Sandbox/VM for installation, upgrade, uninstall and sign-in tests. Use a separate Windows test account if Sandbox is unavailable. Do not sign out the working desktop or uninstall its app during an automated test run.
- [ ] Create a disposable source such as `%LOCALAPPDATA%\Tidy-QA\Source`, an **outside-source** destination `...\Organized`, and an untouched `...\Originals` copy. Begin with Watch off, schedule Manual, Smart Rename off, and Keep both names. Do not point any of these at personal Downloads.
- [ ] Include TXT/PDF, JPG, EPUB/MOBI, ZIP, two same-name files in different subfolders, identical-content files with different names, and equal-sized different-content files. Make original/replacement copies have visibly different contents. Include `Family & Friends\Café 日本語` and a deep path.
- [ ] Save a manifest of original relative paths, byte counts, SHA-256 values and last-write times. `Get-FileHash -LiteralPath '<file>' -Algorithm SHA256` checks content. After every Undo compare against this manifest; file counts alone are insufficient.
- [ ] For an upgrade test, save the old installer outside build/cleanup output and capture settings/key-configured status in the test account. Do not copy a real key into fixtures or the report. Keep source backups outside OneDrive and outside both watched and destination trees.

### 1. Verify source and build

Run from the project folder, one command at a time; stop at the first failure:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build:app
npm.cmd run test:files
npm.cmd run test:duplicates
npm.cmd run test:features
npm.cmd run test:subfolders
npm.cmd run test:desktop
npm.cmd run test:features:desktop
npm.cmd run test:subfolders:desktop
npm.cmd run test:source-choices
npm.cmd run test:books
npm.cmd run test:key
npx.cmd playwright install chromium
npm.cmd test
npm.cmd run test:a11y
npm.cmd run test:fluent
```

- [ ] Use the project's Node version (`.nvmrc`: 22). The audit command in this checkout is **`test:a11y`**, not `audit`. Preserve each console transcript and `.test-artifacts` folder if a test fails. Fresh `build:app` output is required before desktop tests; otherwise they may test an old bundle.
- [ ] Add `test:duplicates`, `test:features`, and **`test:features:desktop`** to CI in the appropriate service/desktop stages. They are absent from the inspected workflow. Do not count a skipped suite as passed.
- [ ] After fixes, bump both package files with `npm.cmd version 1.1.0 --no-git-tag-version` (proposed version), then `npm.cmd run build:win`. Verify the installer and installed About/version match. Keep appId/product identity stable for upgrades. The current changes still say 1.0.2, so filename/version alone cannot distinguish the old release.
- [ ] Record the new installer's SHA-256 and signing status. An unsigned-build warning is expected for an unsigned installer; do not disable Defender to get a test to pass.

### 2. Install, Explorer, tray and startup

| Check | Exact action | Expected result / failure evidence |
|---|---|---|
| Clean install | In the test VM/account, install the newly built installer as the current user. Open from desktop and Start. | Correct version; one app instance; renderer loads; shortcuts target the installed EXE. Failure: blank window, old version, missing shortcuts, unexpected elevation. Save installer error and EXE path. |
| Explorer folder | With Tidy fully exited, right-click `Family & Friends\Café 日本語`, choose Show more options → Tidy this folder. | Correct complete source path; preview opens; nothing moves without confirmation. Repeat while Tidy is visible, minimized and in the tray. One instance handles all cases. |
| Explorer background/drive | Repeat on empty folder background and a disposable drive root; also a UNC share when available. | Correct source, including trailing root separator. Merely selecting a real system drive for preview must not run an organization. Cancel immediately. |
| Automation interaction | With sandbox Watch/schedule enabled, invoke Explorer on another sandbox folder and cancel preview. Add a file there and wait. | No unreviewed retargeting of automatic work. Current code changes the source while automation is active; treat an unexpected move as a safety failure and require pausing/reconfirmation on source changes. |
| Tray close | Enable Keep running in background; click X, then Alt+F4 after reopening. Check Task Manager and the hidden-icons overflow. | Window hides; tray icon remains; process remains; tray Open restores it; tray Run opens the usual preview. No duplicate icons. |
| Real Quit | Use tray Exit Tidy and File → Exit separately. With background off, click X. | All app processes/tray icon exit and no watch/scheduled moves occur afterwards. During a long run, quitting must not silently interrupt file moves; test this only with duplicate fixtures. |
| Startup | Enable background and Start with Windows in the **installed** build. Check Windows Settings → Apps → Startup. Sign out/in in the VM/account. | Exactly one hidden instance, reachable from the tray; saved rules load; schedule/watch rearm once. Disable startup and repeat: no launch. Disable background: startup also turns off. |
| External disable | Disable Tidy in Windows Startup settings, then reopen its Settings. | UI should distinguish requested startup from effective OS startup state. Current getter reports saved settings rather than querying the actual registration; record any mismatch. |

The classic menu is expected under **Show more options**, not necessarily the Windows 11 top-level menu. Do not diagnose that placement alone as failure. Inspect these read-only registry values when the menu fails:

```powershell
reg.exe query "HKCU\Software\Classes\Directory\shell\Tidy" /s
reg.exe query "HKCU\Software\Classes\Directory\Background\shell\Tidy" /s
reg.exe query "HKCU\Software\Classes\Drive\shell\Tidy" /s
reg.exe query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
```

Expected menu commands quote the full EXE path and the entire `--tidy-folder=...` argument. Redact unrelated registry entries before sharing. Inspect `installer/explorer-menu.nsh`, `electron/ipc/system.ts`, `electron/main.ts`, and the Explorer effect in `src/app/App.tsx`. Do not route folder strings through `cmd /c` to fix quoting.

### 3. Core organization, history and unattended work

| Check | Exact action | Expected result / failure evidence |
|---|---|---|
| Manual baseline | Preview fixture files, cancel, verify manifest; preview again, confirm. | Cancel changes nothing. Confirm moves only eligible files. Hashes match. Test each conflict policy using a fresh fixture copy. |
| Manual Undo | Undo via Activity Log, restart and repeat with a separate run, then test preview/shortcut Undo. | Exact original contents and locations; no double reversal between interfaces. Existing unrelated files are preserved. |
| History overlap — blocker | Reproduce run A/run B replacement sequence described above; also move the same file twice and undo the older run first. | Block unsafe older Undo or correctly resolve dependencies. Current reproduction fails. Do not accept a success label without version/hash checks. |
| Partial Undo | Recreate an original path with unrelated content; lock another moved file. Undo, remove blockers, retry. | No clobbering. Blocked operations remain retryable and other safe operations are restored. An edited/replaced destination must not be mistaken for the original moved file. |
| History retention | Make 11 small runs; restart. | Only 10 visible, newest first; each kind labeled; correct remaining operations. Losing the oldest UI entry must not delete its backups. Explain retention clearly. |
| Scheduled hidden run | Add fresh fixtures; set a daily run 2–3 minutes ahead; enable background; click X; keep PC awake. | Exactly one run at local time; expected files move; Activity Log marks Scheduled; a notification appears if Windows permits it. Undo from history restores the manifest. |
| Schedule changes | Change scheduled time once; disable it; test invalid/unavailable source and destination. | Old schedule canceled; disabled schedule does not fire; failures visible. Inspect saveSchedule response if the UI claims success without a run. |
| Sleep/restart | Schedule near sleep/resume and sign-in. | Record actual behavior. An in-process scheduler cannot run with PC off or app exited; do not promise catch-up. Require a documented policy for missed runs and daylight-saving/time-zone changes. |
| Concurrency | While a large fixture run is active, trigger Watch, a scheduled run, Undo and backup cleanup. | File lock prevents overlap and partial cleanup. A busy Watch batch is retried; a busy scheduled run currently reports failure rather than queueing—make that policy explicit. |
| Run Log | Run >300 and >5,000 log events; include an error at the end. Reopen the log. | Capped UI stays responsive; final totals and failure state are reliable. Old lines may fall out by design. Do not assume these UI logs are a durable diagnostic archive. |

For notifications, first check Windows Settings → System → Notifications, Do not disturb, and Notification Center. A missing toast does not prove the run failed; verify history and files independently. Confirm the installed Start-menu shortcut identity agrees with `com.ericauzenne.tidy`. This source sets that AppUserModelId, but the real installed shortcut/toast path still needs testing. See [Electron notifications](https://www.electronjs.org/docs/latest/tutorial/notifications) and [electron-builder NSIS guidance](https://www.electron.build/docs/nsis/).

### 4. Watch a disposable Downloads folder

Configure Chrome/Edge to ask for a save location, then choose the sandbox source for an actual download. Do not select personal Downloads yet. After each scenario compare hashes with a separately downloaded/copied original.

- [ ] Place an existing eligible file in source **before** enabling Watch. Leave it untouched, then edit it. Both should stay if the feature promises new files only. The edit case currently fails.
- [ ] Start a real download. Observe `.crdownload` while active; pause for at least 10 seconds. Partial file stays. Resume to completion; final eligible name moves once after settling. Repeat with a large file.
- [ ] Test `.part`, `.partial`, `.download`, `.opdownload`, `.tmp`, `.temp`, dotfiles and `~$` names. None moves while using the temporary name. Rename one to a normal eligible extension: it becomes eligible once complete.
- [ ] Have another app write a normal eligible filename in chunks, with a pause longer than five seconds. Tidy must not move a still-in-progress file. Current implementation cannot guarantee this; require a conservative supported workflow or stronger readiness policy.
- [ ] Copy many small files and a large file into source; create a subfolder containing files; test recursion on/off and source/type selections. Eligible arrivals move once, unrelated files stay, existing folder contents are not accidentally swept.
- [ ] Undo a watched batch, wait at least 10 seconds, then restart Tidy and wait again. Restored files stay put. Test their first modification after restart too; current suppression is memory-only.
- [ ] Lock a ready file, wait for attempted processing, release it. Require visible failure and an explicit or bounded retry; current code drops failed ready candidates.
- [ ] Rename/delete the watched folder, disconnect/reconnect its drive/share, and change rules while files are pending. UI must reflect a stopped watcher and allow recovery; no stale “Watching” claim or abandoned pending file without explanation.
- [ ] Test source equal to destination with recursion off, and destination nested inside source. Expect clear rejection of unsafe/unsupported configuration or correct processing without output loops. Current equal-folder flat Watch silently excludes all candidates.

[Node documents Windows watcher deletion/rename behavior and network unreliability](https://nodejs.org/api/fs.html#caveats). `fs.watch` is a trigger for reconciliation, not a guaranteed inventory of new files.

### 5. Backups, date folders and rule sets

- [ ] Replace an existing fixture with different contents. Confirm both versions exist (new destination, old `.Tidy Undo` backup), and full Undo restores both. Repeat for manual, scheduled and watched runs with fresh fixtures.
- [ ] Open Clean up backups: verify size/count against the actual backup tree. Cancel first: nothing changes. Confirm on a **local test destination**: check the real Recycle Bin and original backup path; unrelated folders are untouched. Undo can return the new file to source, but can no longer restore the recycled prior version automatically. Test the warning and remaining history count.
- [ ] Repeat cleanup with an unreachable destination or a volume/share that cannot recycle. Expect an explicit failure, backups retained, and history still usable; never silently fall back to permanent deletion. Read `backups.ts` and `history.ts` if counts/Undo diverge. [Electron's trash API](https://www.electronjs.org/docs/latest/api/shell#shelltrashitempath) returns a promise that rejects on errors; the test fake cannot establish real Recycle Bin behavior.
- [ ] Set a JPG's last-write time to July 4, 2024 and another to January 15, 2023. Test none, year, year/month, extension subfolders on/off. Expected year/month path with extension off: `Images\2024\07\...`; with it on: `Images\jpg\2024\07\...`. Preview and actual paths agree; EXIF is irrelevant. Test near local midnight/month/year boundaries and date-first rename too. Compare mtime after cross-volume moves and Undo.
- [ ] Save a custom rule set; change settings; apply it. Source/destination stay fixed. Test both built-ins, delete a custom set, restart and export/import it. Valid settings survive; built-ins cannot be deleted; importing a same-name set creates a distinct name.
- [ ] Import invalid JSON, `{}`, unsupported `version`, invalid category names/extension values, duplicate category IDs, 51+ valid sets, and JSON larger than **1,048,576 bytes**. Cancel native dialogs too. No crash, file moves, silent reset or lost sets after restart. Inspect `electron/ipc/ruleSets.ts`, `src/app/lib/ruleSets.ts`, `savedSettings.ts`, and the rule-set UI for failures. The importer currently checks size and file type, but not export version or total capacity consistently.
- [ ] With Watch/schedule enabled in the sandbox, apply a different rule set. Confirm and document whether automatic behavior changes immediately; nothing should masquerade as an inactive preview-only change.

### 6. Windows filesystem and AI edge cases

- [ ] OneDrive: use a dedicated **test** subtree. Test fully local files first, then online-only placeholders while online/offline and sync paused. Watch for hydration, sync conflicts and access errors. Reconcile both local/cloud copies; disable automatic watching for unsupported configurations rather than claiming success.
- [ ] Network: dedicated SMB share, both mapped drive and UNC paths; test reachable, disconnected mid-copy, reconnect, and login before drive mapping exists. No unreported missing file or partial final output. Unsupported recycling is a handled error. Saved drive letters may be unavailable at startup.
- [ ] Cross-volume: local test volume → different test volume, then Undo. Interrupt one large copy and simulate full/read-only destination using a disposable volume. Preserve at least one verified original; neither a partial output nor failed source deletion counts as a successful move.
- [ ] In-use file: hold a sandbox file open without delete sharing, attempt organization/Undo/cleanup, then release it. Other files proceed safely, failure is specific, retry is possible. Check Defender Protection History/Controlled Folder Access for blocked access; do not bypass protection as the default fix.
- [ ] Names: long/deep paths, Unicode, spaces and `&`, same names with different casing, and Windows reserved names from AI/imported rules. A rejected name should yield a clear error before any unrelated overwrite; do not assume a long-path system setting alone fixes every shell/installer/API limit.
- [ ] Key storage: run `test:key` in its isolated profile. In the installed **test account**, save a valid key in Settings, test connection, fully Quit/reopen, and test again with no environment key. The input is masked and clears after saving; no secret appears in localStorage, logs, exported rule sets or app bundles.
- [ ] Replace/remove key, test offline, invalid key, quota exhaustion, and an unreadable encrypted-key file in an isolated profile. Preserve a recoverable copy first; do not corrupt the working user's key. Expect a useful error/local fallback, not a crash or plaintext fallback. A key encrypted for one Windows account is not a portable credential. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) documents DPAPI semantics; same-account applications are outside its protection boundary.
- [ ] Optional: `npm.cmd run test:ai` with an authorized test key and non-sensitive fixtures. Test Smart Rename and rule-builder review separately. No file moves before final confirmation. Check filename extension/name validation and partial/malformed AI responses.
- [ ] Use a mocked provider response to verify 404 fallback and 401/403/429/no-network handling; arbitrary invalid model IDs are not a reliable substitute for asserting the actual 404 path. The env override is tried first but may fall back on 404. A rolling alias can change capabilities; verify JSON-schema/thinking configuration compatibility without sending raw provider errors or keys to logs.

### 7. Upgrade, uninstall and cleanup — last

- [ ] Install original 1.0.2 in the VM/test account, configure representative settings/key, and make a reversible run. Upgrade with the newly versioned installer while background mode/startup have been used. Quit the old instance or test the installer's close/restart handling deliberately. Verify new version, retained settings/key/history, working Undo, updated Explorer commands and startup path, and no duplicate tray instance.
- [ ] Uninstall that new test build. All three Tidy Explorer registry branches, shortcuts and startup registration should disappear; no background process remains. Source, destination and backup files must remain. Define whether user settings are retained; reinstallation must match that policy. The custom uninstall macro shown only explicitly removes Explorer keys, so startup removal needs a real check.
- [ ] Run `Cleanup-Tidy.ps1` **without `-Apply`** and preserve the list. Review that it names only project-generated leftovers, not active source files or release evidence you still need. Its `_to_delete` destination stays on disk: moving files there does **not** reclaim space. Only apply cleanup after the release evidence and rollback installers are archived elsewhere, all test processes are stopped, and the old contents are no longer required. Do not delete `_to_delete` as part of QA.
- [ ] After every required gate passes, perform one small manual run on **copies** of family files before enabling personal Downloads automation. Begin with Keep both names, no replacement/backup cleanup, and an independent backup.

## Ten highest-priority Windows failure areas

| Rank | Failure area and why | Diagnosis / fix direction |
|---|---|---|
| 1 | Undo of overlapping runs uses paths without version identity; wrong file can be restored. Confirmed. | Preserve source/destination/backups/history; compare hashes. Block dependent older Undo; unique operation IDs and identity validation. |
| 2 | Watch mistakes edits for arrivals and readiness for completion. Confirmed existing-file behavior. | Log event type, candidate identity/size/mtime/settle times and outcomes. Baseline existing files, reconcile, handle retries and status events. |
| 3 | Interrupted/cross-volume moves, disk full and source unlink failure can strand partial or unrecorded output. | Capture error code, operation phase, original/temp/final hashes; inspect `files.ts`. Exclusive staged copy, verification and durable recovery state. |
| 4 | Persistent history/backup cleanup can lose recoverability; Recycle Bin varies by storage target. | Compare `run-history.json` and `.Tidy Undo`; test actual `trashItem`. Atomic history persistence; preserve records on recycle failure; dependency-aware cleanup. |
| 5 | Explorer quoting, drive roots, Unicode and second-instance delivery differ from Linux argument tests. | Three HKCU command values, EXE path, sanitized argv, correct source shown. Repair quoted direct-EXE command/launch buffering; no shell interpolation. |
| 6 | Tray, true Quit and login startup can disagree with saved settings or survive an upgrade/uninstall incorrectly. | Background JSON, actual Run key/Startup state, process paths, login args. Use installed NSIS executable; query effective OS state and reconcile/remove entries. Do not copy Squirrel stub-path recipes into this NSIS app. [Electron login item API](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows). |
| 7 | Hidden schedules may not rearm, fire twice, fail silently, or finish without a visible toast. | Saved schedule/config, registration response, local time/time zone, run history, Notification Center and shortcut identity. Surface arm failures, log run IDs; test installed AUMID, not only development notifications. |
| 8 | OneDrive placeholders, SMB watcher gaps, startup-unavailable drive mappings and disconnects. | Hydration/sync state, UNC vs drive path, connectivity, watch errors. Support manual mode or explicitly pause unsupported automation; no blind retry of file mutations. |
| 9 | Windows handle locks, antivirus, long paths, junctions and reserved names. | Error code/path, Defender history, `lstat`/realpath containment and hash manifest. Keep original safe, reject invalid names, skip unsafe links, report retryable access errors. |
| 10 | Credentials/provider fallback and persisted/imported settings behave differently after restart/upgrade. | Redacted key-status booleans, schema/version, model/status code, localStorage settings and API errors. Preserve account-bound encryption; validate imports/capacity; test provider fallback separately from storage. |

## What to capture and paste when a check fails

The UI Run Log is capped and not a complete persistent file log. In the inspected schedule/watch calls, individual log callbacks are not supplied. Do not search for a promised `tidy.log` that this code never creates.

For a controlled reproduction, fully Quit Tidy first, then launch the test build from PowerShell with Electron diagnostics directed to a disposable file:

```powershell
$env:ELECTRON_ENABLE_LOGGING = '1'
& 'C:\Users\TESTACCOUNT\AppData\Local\Programs\Tidy\Tidy.exe' --enable-logging=stderr 2>&1 |
  Tee-Object -FilePath "$env:TEMP\tidy-qa-console.txt"
```

Replace the executable path with the real test install location. Electron/console output may help but is not a substitute for application-level logging. If a running instance takes the launch, output from that other process may be absent. Redact private paths before sharing.

Capture:

1. Exact steps, expected result, actual result, Windows build (`winver`), installed EXE path, app version, source revision/build timestamp and installer hash. State whether test ran in development, unpacked or installed form.
2. Screenshot of relevant UI; selected conflict policy, category/type scope, schedule, Watch/background state and time zone.
3. Console/test failure with stack and native error code; relevant `.test-artifacts` results. For file failures include fixture-relative paths, before/after sizes and hashes, and whether storage was local/OneDrive/SMB.
4. The actual `app.getPath('userData')` location (typically `%APPDATA%\Tidy`; verify instead of assuming), redacted `run-history.json`, and `background-settings.json`. Chromium settings live in the profile's Local Storage; export only named Tidy settings, not the whole profile. Do **not** paste `gemini-key.bin`, `.env`, API keys, complete Local Storage, private file contents or raw provider request/response dumps.
5. Source files matching the symptom:

| Symptom | Files to provide with the evidence |
|---|---|
| Installer/menu/upgrade/uninstall | `package.json`, `scripts/prepare-windows.mjs`, `installer/explorer-menu.nsh`, `electron/main.ts`, `electron/ipc/system.ts` |
| Tray/login/notifications | `electron/services/background.ts`, `electron/main.ts`, `electron/window.ts`, triggering IPC handler |
| Watch/partial downloads | `electron/services/watch.ts`, `electron/ipc/history.ts`, `electron/lib/files.ts`, `electron/services/organizer.ts` |
| Undo/replacement/cleanup | `electron/services/history.ts`, `organizer.ts`, `backups.ts`, `electron/ipc/history.ts`, redacted history and fixture manifest |
| Rule sets/persistence/date paths | `src/app/lib/ruleSets.ts`, `savedSettings.ts`, `src/app/hooks/usePersistentState.ts`, rule-set component, `electron/ipc/ruleSets.ts`, `src/shared/dateFolders.ts` |
| Key/Gemini/AI | `electron/services/apiKey.ts`, `gemini.ts`, `smartRename.ts`, `electron/ipc/apiKey.ts`, `electron/ipc/rules.ts`; sanitized status/error only |

Suggested repair handoff: “On Windows [build], Tidy [version/hash] fails test [ID]. Expected [...]; actual [...]. Reproduction uses synthetic files at [...]. Attached are the manifest, sanitized history/log, and listed source files. Preserve all originals, fix the smallest responsible path, add a regression reproducing this failure, then rerun the affected desktop and packaged checks. Do not treat a mocked OS API as verification of the native integration.”
