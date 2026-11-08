# Final Windows desktop review — October 29, 2026

## Delivered release

- Version: **1.0.1**, Windows x64.
- Installer: `release/Tidy-Windows-1.0.1-x64-Setup.exe` (104,014,733 bytes; approximately 99.2 MiB).
- Installed and tested: `C:\Users\Demo\AppData\Local\Programs\Tidy\Tidy.exe`.
- The per-user installer exited successfully and created the desktop shortcut. Its target was verified. The installed application archive matches the release archive byte-for-byte.
- SHA-256: `DA8E26A84DBAA3558D0A3E0BE31D3120F1902C0A2E82CEBF7C7534641D4CB554`.
- The installer is **unsigned**; Windows may display an unknown-publisher warning.

## Fixes and cleanup

- Added a compact AI connection section to existing Settings: masked key entry, Save, Test connection, and Remove. Keys use Windows DPAPI encryption in the user profile, never browser storage or the installer. A saved key takes priority over an environment key and changes apply without restarting.
- Configured and tested the existing local Gemini key in the installed user's profile. Installer copies shared with another computer do not contain this key; configure AI in Settings on that computer.
- Bounded AI requests with a 30-second transport timeout and replaced raw provider errors with safe, understandable messages.
- Fixed offline cached names persisting after AI becomes available; corrected their classification label and capped the cache at 2,000 entries.
- Fixed reviewed AI source changes retaining source-folder selections from the previous folder.
- Preserved the previous Undo record when a new run fails before moving files.
- Enabled the renderer sandbox, blocked unexpected page navigation/popups, and prevented a second instance in the same profile from racing file operations.
- Updated Electron to 45.1.0, Vite to 6.4.5, and patched affected dependencies. The final full dependency audit reported **zero known advisories**. This is a point-in-time dependency check, not a security certification.
- Package refresh removed 99 stale installed development packages. No new third-party dependency was added for the fixes. The app archive is 2,108,614 bytes; installed runtime files total 325,602,645 bytes. Electron accounts for most of the footprint. Only the English runtime language pack is included, matching the app's current UI.
- Verified the runtime archive excludes `.env`, keys, tests, and `node_modules`. The installed app needs neither Node.js nor this source folder.
- Moved the app icon into source assets so clean checkouts can package it. Updated README to describe actual Windows behavior, and expanded CI to include subfolder, selection, and key-storage tests.

## Verification

All tests used synthetic files and isolated profiles, except the final local setup of the installed user's API key. No personal documents were moved or submitted to Gemini.

- TypeScript checks and production/installer builds passed.
- Ten file-safety regression groups passed: Windows names, collisions, full-file duplicate hashes, filtered previews, cached names, replacement backups, Undo conflicts, concurrent jobs, naming style, and reviewed rule behavior.
- Eleven subfolder regression groups passed: arbitrary nesting, repeated filenames, destination exclusion, filters, 50-file preview versus full run, duplicates, partial Undo, junctions, unreadable folders, Insights, and explicit folder/type scope.
- All 12 browser smoke checks passed, with no page errors.
- The **installed executable** passed desktop workflow tests, actual synthetic moves and Undo, persisted state, reviewed/cancelled AI changes, clarification, Advanced editor, and naming preferences.
- The installed executable passed subfolder and source-selection tests, including empty selections, root-only behavior when subfolders are disabled, search, keyboard selection, 800×600 layout, and 200% zoom.
- Key tests verified masked/cleared inputs, encrypted bytes on disk, no localStorage secret, successful decryption after restart, removal, missing-key handling, and accessible Settings.
- Live Gemini tests passed on the installed executable after saving the key and restarting with an empty environment key: connection test, structured rules, clarification, date-first names, and semantic subfolder suggestions. A previously cached local suggestion was replaced by a real AI result. An invalid API key returned a safe failure message.
- Accessibility suites passed 18 screen states, 14 preview/review/zoom/contrast states, and 14 measured color pairs. Screenshots were inspected in light and dark themes. The existing filter-popup landmark advisories remain; there were no detected WCAG rule violations in exercised states. This does not establish complete WCAG conformance or replace manual assistive-technology testing.

Local evidence: `.test-artifacts/audit/report.json`, `.test-artifacts/fluent-validation/report.json`, `.test-artifacts/source-choices/`, and `.test-artifacts/dependency-audit-final.json`.

## Practical limits

AI uses Google's online service and API quota. The current account's `gemini-2.5-flash` access was verified live. Google currently limits these older models to previously active projects, so a new API project may require a future model update. A failed AI naming call uses local filename patterns and identifies them as local.

Preview shows at most 50 matching files; confirmed runs process all matches, with AI suggestions restricted to previewed files. Scheduled runs require Tidy to remain open and do not generate Smart Rename suggestions or expose their Undo record in the UI. Only the latest manual run's Undo record is retained. Replacement backups remain in `.Tidy Undo`; there is no crash recovery journal or automatic backup deletion. Hidden filtering concerns dot-prefixed names, not Windows Hidden attributes.

## References

- [Electron safeStorage and Windows DPAPI semantics](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Google model availability and lifecycle](https://ai.google.dev/gemini-api/docs/deprecations)

Windows encryption protects the saved secret from other Windows accounts; it does not isolate it from every application running as the same user.
