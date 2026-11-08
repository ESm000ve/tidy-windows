# Tidy core fixes and verification

**Subsequent update:** version 1.1.1 has now been installed and tested against native Windows APIs. The optional Explorer menu was removed at the user's request. See [native Windows verification](WINDOWS-NATIVE-VERIFICATION.md). The candidate-only delivery statements below describe the earlier core-verification stage.

November 6, 2026. Follow-up to `WINDOWS-RELEASE-QA.md`.

## Scope and delivery status

Undo history and automatic folder watching were already implemented. They have been retained and repaired; no new feature or dependency was added in this pass. This is a source/candidate verification pass, not an update to the installed application. Version remains 1.0.2 in source; the existing 1.0.2 installer predates these fixes and is not the candidate tested here. Assign a new release version before distributing a new installer.

All organization tests used disposable synthetic files and isolated profiles. The working user's folders, installed app and saved key were not modified. The live AI suite saved an encrypted key in its isolated test profile, exercised it, and removed that test copy afterwards.

## Fixes

- **Older-run Undo:** refuses to reverse an older run when a newer outstanding run touches the same paths. The message tells the user to undo the newer run first. No files change on refusal. New move records have unique IDs, so Undo does not erase another run's history merely because it reused the same original/destination paths. Legacy or stale last-run records receive a safe error directing the user to Activity Log.
- **History persistence:** writes to a temporary JSON file before replacing the saved history. This reduces interrupted-write exposure; it does not add a crash-recovery journal.
- **Existing watched files:** builds a baseline before watching. Edits to existing files and files restored by Undo do not make them new arrivals. A genuinely new download can reuse the filename of a file Tidy already moved.
- **Watch configuration:** rejects identical source/destination paths, uses separator-aware destination exclusion, and guards asynchronous initialization/processing against configuration changes. A batch already moving files is still recorded if settings change during the run. Runtime watcher errors now update the UI.
- **Explorer source selection:** pauses Watch and changes the schedule to Manual before opening a preview for another source, preventing unattended work from silently switching folders.
- **Rule sets:** rejects unsupported export versions and enforces a 50-custom-set limit on both saving and importing. Malformed/oversized native imports preserve existing sets.
- **Schedule feedback:** surfaces registration errors rather than ignoring them.
- **CI:** includes duplicate, feature-service, and feature-desktop regression suites.

## Verification completed

| Check | Result and scope |
|---|---|
| TypeScript checking | Passed on final source. |
| File engine | Passed: moves, collision policies, replacement backups, Undo conflicts, complete-content duplicates, AI suggestion validation, naming styles, all 21 ebook formats. |
| Size-first duplicates | Passed: preview/run agreement, distinct equal-sized files preserved, Undo restores files. |
| Recursive engine | All 11 groups passed, including exact folder/type scope, destination exclusion, junction avoidance, unreadable subtree abort, nested replacements and partial Undo. |
| Expanded feature services | All 6 groups passed, including the new overlapping same-path A/B Undo case across history reload, stale IDs, existing-file edits, edited Undo-restored files, repeated download filenames, same-folder rejection, import version and capacity. Retained result: `.test-artifacts/features-JgaRXP/results.json`. |
| Existing desktop workflows | Passed: persistent Undo, staged/cancelled/confirmed AI rules, clarification and advanced review, naming preference. |
| Feature desktop UI | Passed: rule-set application/save/export/delete/import; malformed, oversized and unsupported-version imports; preview/date folders; Activity Log Undo; backup-cleanup confirmation; Watch arrival and existing-file edit; Explorer source change pauses Watch and schedule. Development result: `.test-artifacts/features-desktop-Id219n/results.json`. |
| Subfolder/selection desktop | Passed: root-only/default behavior, recursive moves, original locations, Undo, accepted suggestions, persisted scope and minimum window layout; explicit folder/type choices and empty selections. |
| Books desktop | Passed: category/types, exact selection, nested files, moves, Undo and light/dark accessibility. |
| Encrypted-key desktop | Passed: masked entry, encrypted storage, no key in localStorage, restart, removal, missing-key handling and Settings accessibility. |
| Accessibility audit | All 18 selected states had zero detected WCAG rule violations. Filter menus retain three best-practice advisories per theme. This is automated coverage, not a full conformance certificate. |
| Fluent checks | Passed: selected color-role contrast, populated previews, focus restoration, Settings, AI review/question states, contrast theme and 200% zoom/reflow. |
| Browser smoke | All 12 checks passed; no console errors. |
| Live Gemini | Passed in development with a saved encrypted key after restart and no environment-key fallback: connection, structured rules, clarification, date-first Smart Rename and semantic folder suggestion. Invalid-key handling was also checked. Only synthetic instructions and one synthetic text document were sent. |

The complete UI suite passed before the last small additions to schedule feedback and stale-record protection. The final feature-desktop and service suites were rerun for those additions. Other suites were not repeated without a relevant change.

## Packaged candidate

The final unpacked Windows build passed, as did `test:features:desktop` and `test:ai` against that executable. The packaged feature suite includes rejected malformed/oversized/versioned imports, existing-file edits while watching, and pausing automation on an Explorer source change. Result: `.test-artifacts/features-desktop-3h2bMs/results.json`.

The live packaged AI test used a saved encrypted key after an independent restart with no environment-key fallback. Connection, rule building, clarification, date-first Smart Rename, semantic folder suggestions and invalid-key error handling passed with synthetic content.

The candidate lives at `release/win-unpacked/Tidy.exe`; it is not the installed application or the old installer. Its `resources/app.asar` SHA-256 is `2DCB1A9D2B760E4FF8ED52BD11A7F3E91708ABD4C4292B66E785619E2A161F92`.

## Limits and remaining Windows release gates

The tests establish the listed behaviors; they cannot prove every filesystem or OS state. Native dialogs and Recycle Bin calls are replaced in the feature-desktop suite, so a passing cleanup test is not proof of real Windows recycling.

Still required before release:

1. Actual NSIS install/upgrade/uninstall and all three Explorer menu registrations; real process argument handling for folder backgrounds, drive roots, spaces, ampersands and Unicode.
2. Tray visibility, close versus true Quit, and startup after sign-out/sign-in (hidden launch); verify startup removal on uninstall and OS-disabled startup feedback.
3. Scheduled run with the window hidden and the actual Windows notification, including sleep/missed-run policy.
4. Actual browser downloads, in-use files, long paths, OneDrive placeholders, network shares and cross-volume/disk-full/interrupted moves.
5. Real Recycle Bin cleanup, including failure behavior on unsupported storage.

Use the ordered steps in `WINDOWS-RELEASE-QA.md` for these checks, taking its initial defect list as historical where superseded above.

Known boundaries remain: a five-second size/mtime pause does not prove a writer is finished; a failed watched file stays for manual handling rather than indefinite retries; Undo is not external version control or crash recovery; histories retain 10 runs; schedules require the app to remain running. Cross-volume copy interruption and edits made by other applications still need the fault tests above. Do not describe the entire application as release-certified based only on these passing suites.
