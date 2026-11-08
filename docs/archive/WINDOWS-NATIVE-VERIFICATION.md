# Tidy 1.1.1 — Windows verification

November 6, 2026. Current installed app: `C:\Users\Demo\AppData\Local\Programs\Tidy\Tidy.exe`.

## Final scope

The optional File Explorer context menu has been removed at the user's request. Version 1.1.1 removes its installer registration, command-line folder-launch handler, bridge methods, renderer listeners and dedicated test. Upgrades remove the three legacy Tidy menu entries. Normal folder selection inside Tidy, Open folder and Show in File Explorer remain available. A second launch restores the existing window without changing folders or starting a run.

No new runtime dependency was added. The Windows installer remains unsigned. The earlier Undo and Watch repairs are retained.

## Verification of 1.1.1

- Type checking, production build and Windows NSIS installer build passed.
- File-engine, size-first duplicate and all six expanded feature-service groups passed. These cover file contents, collisions, replacement backups, filters, all 21 ebook formats, date folders, overlapping/stale Undo records, Watch baseline edits, edited restored files, repeated download names, rule-set version validation and capacity.
- Desktop workflows, feature controls, nested-folder organization, source/type choices, ebooks and encrypted-key settings passed.
- All 12 browser smoke checks passed, with no console errors.
- The selected light/dark accessibility states had zero detected WCAG rule violations. Filter menus retain best-practice advisories. Fluent contrast, focus restoration, contrast theme and 200% zoom checks passed. These automated checks do not constitute complete WCAG certification.
- Actual upgrade to 1.1.1 completed with exit code 0. The original saved encrypted-key hash was unchanged and all three retired menu registrations were absent. Evidence: `.test-artifacts/native-windows/1.1.1-upgrade.json`.

The final installed-app native suite passed all nine groups on 1.1.1, and the live AI suite passed after an independent encrypted-key restart. Evidence: `.test-artifacts/native-kDU0Xd/results.json`. The feature-desktop evidence is `.test-artifacts/features-desktop-5OIMbA/results.json`.

## Native test coverage

The installed-app native suite exercises real Windows APIs, not replacement filesystem/tray/notification implementations:

1. Real tray creation with Windows screen bounds; native close hides the live window; a real second executable launch and the tray Open callback restore the existing window.
2. Actual startup registration with the installed executable and `--hidden`; effective OS-disabled state; successful re-enable from Tidy; removal of the temporary registration.
3. Relaunch with `--hidden`, creating a live hidden window. This does not substitute for an actual sign-out/sign-in cycle.
4. Real next-minute scheduled run with the window hidden, its history entry, and exact-content Undo.
5. Actual Windows notification `show` events for background/scheduled/watched work, with no observed failed event. This establishes OS show callbacks, not complete visual branding or Do-not-disturb behavior.
6. A visible isolated Microsoft Edge download of an 8 MB synthetic file from a local HTTP server. The real `.crdownload` pauses for nine seconds, stays put past the settling delay, then the completed file is filed with matching SHA-256. Watched Undo restores its bytes and leaves it in place.
7. A real Windows exclusive file lock. Tidy preserves the source and reports the failure; retry after unlocking and Undo both work.
8. Actual C: to F: move and Undo with matching contents.
9. Real `shell.trashItem` recycling of synthetic replacement backups; the remaining Undo preserves the new file.
10. Tray Exit really ends the process with background enabled; closing the window exits with background off.

The suite invokes actual tray menu callbacks through native menu objects; a physical taskbar-icon mouse click is not separately certified. Startup mutations are refused when a pre-existing Tidy Run entry is found, so the suite cannot silently overwrite a user's existing startup registration. Tests use isolated app profiles and disposable files. Windows execution policy and security settings were not changed.

## Repairs retained

- Undo blocks an older run if a newer outstanding run uses the same paths. Unique move IDs prevent one run's Undo from clearing another run that reused those paths. History writes use temporary-file replacement.
- Watch establishes an existing-file baseline. Edits to existing or Undo-restored files do not make them new arrivals. Successfully moved filenames can be reused by subsequent downloads. Identical Watch source/destination is rejected; runtime watcher errors update the UI.
- Rule-set imports reject unsupported versions and oversized/malformed files, preserve existing sets on failure, and enforce the 50-custom-set limit. Schedule registration failures are surfaced.
- Startup status comes from the effective Windows login-item state. A reproduced re-enable failure was fixed by comparing both requested and effective prior state. True uninstall removes Tidy's stable Run/StartupApproved entries; upgrades preserve startup registration.

## Live AI and saved key

The AI suite uses a synthetic text file and synthetic instructions with an isolated encrypted key, restarts without an environment key, then checks connection, structured rules, clarification and date-first Smart Rename/semantic folders. Invalid-key error handling is also checked. It removes the test key afterwards. The working user's key is not replaced.

A separate check in the normal installed profile verifies the original saved key is recognized and can connect to Gemini with no environment-key fallback. No user file contents are sent for that connection check.

## Remaining manual/environment checks

- Actual Windows sign-out/sign-in. Registration and the hidden launch path are tested, but the working desktop was not signed out.
- OneDrive online-only files and a real SMB/network share, which were not used for these local tests.
- Disk-full/interrupted-copy fault injection and complete metadata/alternate-stream preservation across volumes. Successful cross-volume move/Undo does not certify crash recovery.

Watch's size/mtime settling interval cannot prove that a normal-named file's writer has finished; a long pause can make it eligible. Failed watched files stay for manual handling instead of indefinite retries. Undo is not external version control or crash recovery. The history retains ten runs, and schedules require the app to remain running.

## Repeatable verification

`npm run test:native:windows` requires Windows, the installed version matching `package.json`, Microsoft Edge and no existing Tidy startup Run entry. It temporarily tests actual startup registration, downloads to disposable folders and recycles only synthetic backups. Use a test account; it is not an unattended CI suite.

Core CI also includes duplicate, feature-service and feature-desktop suites. Native dialogs/recycling are mocked in the feature-desktop suite; actual OS recycling is covered separately by the native suite.

The earlier audit and core-stage records are historical; Explorer-specific steps no longer apply. No public publication, repository commit or cloud deployment was performed.

## Installed delivery record

The final 1.1.1 uninstall/reinstall completed with both exit codes 0. It removed the executable during uninstall, retained the original key, reinstalled successfully and left the retired menu registrations absent. A final normal-profile check reported version 1.1.1, saved key present, environment key absent and live Gemini connection successful. Evidence: `.test-artifacts/native-windows/1.1.1-install-lifecycle.json` and `1.1.1-installed-final.json` in that directory.

Installer: `release/Tidy-Windows-1.1.1-x64-Setup.exe`.

Installer SHA-256: `5F60A966EEE14D5CB750A5C9CA7DBFA3876F14289E611A8157F767CDC91404EA`.

Packaged and installed `resources/app.asar` SHA-256: `C5030F5D855EFE6F79115F90EE0C35D52E9EF1C64A973F937B0BBB2502959876`.
