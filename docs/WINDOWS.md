# Tidy for Windows 11

**Source version: 1.1.1. Publication preparation: November 8, 2026.** Use `release/Tidy-Windows-1.1.1-x64-Setup.exe`. The optional Explorer context menu was removed at the user's request. See [native Windows verification](archive/WINDOWS-NATIVE-VERIFICATION.md) for completed tests and remaining manual checks. Earlier Books verification is in [Books release verification](archive/BOOKS-RELEASE-REVIEW.md); the older release's review remains in [the final review](archive/FINAL-WINDOWS-REVIEW.md).

This working copy is the dedicated Windows version of Tidy. It retains the Locations, Filters, Automated Rules, AI command bar, Schedule, Insights, Preview, and Audit Log layout and the existing Gemini features.

## Run and build

Use Node.js 22 or later on Windows 11 x64. Install dependencies directly on Windows.

```powershell
npm ci
npm run dev
npm run typecheck
npm run build:app
npm run test:files
npm run test:desktop
npm run build:win
```

The installer is written to `release/Tidy-Windows-1.1.1-x64-Setup.exe`. `release/win-unpacked/Tidy.exe` runs without installation. The installer is unsigned until a publisher signing certificate is configured.

`Run Tidy.cmd` opens the local unpacked build, falling back to the installed copy. It can optionally read a local `.env`; that file is excluded from Git. Close an older running Tidy window before opening an updated build.

For the browser smoke tests, install Chromium once with `npx playwright install chromium`, then run `npm test`. Alternatively set `CHROMIUM_PATH` to an installed Chromium browser executable. Tests use disposable files under `.test-artifacts`; they do not organize personal folders.

## AI configuration

In the installed app, open Settings (Ctrl+,), enter a Gemini API key, choose Save key, then Test connection. The key is encrypted with Windows DPAPI for the current account and stored outside the app; it is never packaged. Saved keys take priority over the Windows environment and apply immediately. Development also reads `GEMINI_API_KEY` from `.env`; changing that file or the environment requires a restart. Tidy uses `gemini-2.5-flash` and, if Google reports that model as unavailable, falls back to the rolling `gemini-flash-latest` alias. Set `TIDY_GEMINI_MODEL` to pin a different model for testing. The local naming fallback is retained. The connection test detects access and quota problems.

The natural-language parser receives symbolic names for known folders. The desktop app resolves these locally using Windows known folders, including redirected Documents/Desktop locations. Actual known-folder paths are not added to the model prompt. Smart Rename and Smart sort can send supported file contents to Gemini when enabled. Without a key, they use local filename patterns. Duplicate checking is local and does not use AI.

## Windows behavior

### Books and ebook files

The **Books** category offers 21 selectable extensions: EPUB, MOBI, AZW, AZW3, AZW4, KFX, KEPUB, FB2, FBZ, LIT, LRF, PDB, PRC, DJVU, DJV, CBZ, CBR, CB7, SNB, TCR, and RB. It works with the existing preview, filters, duplicate detection, subfolder collection, file-type selection, conflict handling, scheduling, and Undo. With extension subfolders enabled, books are filed under `Books/epub`, `Books/mobi`, and so on. Uppercase extensions also match. PDFs remain in Documents.

These are file-organization options, not a book reader, converter, or DRM tool. Smart suggestions for these formats use filenames; Tidy does not extract ebook text or embedded author/title metadata. File-format references: [calibre's supported ebook formats](https://manual.calibre-ebook.com/faq.html#what-formats-does-calibre-support-conversion-to-from).

`npm run test:books` exercises the real desktop Books controls, extension toggling, recursive EPUB selection, safe moves, exact Undo, and light/dark accessibility with synthetic files. `npm run test:files` verifies all 21 extensions through preview, filing and restoration.

### AI rule review and naming style

Both the inline AI box and Advanced editor now prepare a review before changing your settings. The review describes the validated file types, folders, filters, tools, conflict policy, and any active schedule. Cancel leaves the settings unchanged. Apply and preview opens the normal file preview for an immediate request; files still require Confirm & Run. The Advanced editor applies reviewed settings without starting a run.

For ambiguous wording, Tidy asks one focused question and uses your answer with the original instruction. Common vague date phrases are caught locally; other questions come from Gemini. It explains unsupported requests rather than translating older-than cutoffs into recent-date filters. Older-than selection, arbitrary date ranges, and automatic deletion remain unsupported. Category date folders are available through the manual controls.

Enable Smart rename to reveal **Naming style** under Automated rules:

- **Descriptive** uses a concise, meaningful name.
- **Date first** prefixes the suggestion with `YYYY-MM-DD_` from the file's last modified time in local time. This date is applied locally, not inferred by the model.

The preference is saved on this computer and works with both Gemini and the local filename fallback. Caches are separated by naming style. Suggestions remain in the manual file preview for review; scheduled runs do not generate Smart Rename suggestions.

### Desktop behavior

- Native Windows title bar, caption controls, system menu, and maximize/Snap behavior. Press Alt to show the application menu.
- Segoe UI Variable typography and bundled Microsoft Fluent SVG icons.
- Fluent card layers, 4-pixel control corners, 8-pixel container corners, accent switches, visible keyboard focus, and light/dark/system appearance.
- Settings opens with Ctrl+comma. Theme changes also update the native window appearance. The existing accessibility profiles remain available, including reduced motion; Windows contrast themes are supported.
- Native folder selection and Electron's supported file-drop path API. A file's reveal action opens File Explorer.
- Preview-before-move, collision handling, AI suggestions, progress, insights, and undo use the existing engine. Invalid Windows names and folder traversal are rejected. Archive collisions keep both files. Undo will not overwrite a file created at the original location after the run.
- Preview honors enabled categories, date/size filters, and the dot-file setting. It shows up to 50 matching files; a run processes all matching files. AI suggestions apply to the displayed files. Smart sort works independently of Smart Rename.
- Duplicate checking streams the whole file through SHA-256, rather than comparing only a shared header. It may take longer for large videos but keeps memory use bounded.
- Replace existing keeps the old version in `.Tidy Undo` inside the destination. Undo restores both versions. Backups are not deleted automatically; **Activity Log › Clean up backups** shows their size and sends them to the Recycle Bin after you confirm. Undo can no longer restore the replaced versions after that. The Activity Log keeps the last 10 runs, including scheduled and watched-folder runs, each with its own Undo; the history is stored in the user profile and survives restarts.
- Only one file-moving or Undo job runs at a time. A concurrent scheduled or manual run reports that the app is busy. Symbolic links and folders are not moved.
- Schedule start date is honored, and the schedule is saved with your other settings. Scheduled runs require Tidy to be running. With **Settings › Background › Keep running in the notification area** on, closing the window hides Tidy next to the clock and schedules continue; exit from the tray icon or File › Exit. **Start Tidy when I sign in** (installed app only) launches it hidden so the schedule is armed after a restart. Weekly runs occur on Monday and monthly runs on the first day, as in the original app. Scheduled runs report through Windows notifications.
- Exclude Hidden retains the original dot-file filter; it does not inspect the Windows Hidden file attribute.

The Electron interface follows Fluent conventions; it is not a conversion to WinUI 3, and does not claim a native Mica backdrop. An opaque layered background is used intentionally.

## Design and API references

- [Windows design principles](https://learn.microsoft.com/en-us/windows/apps/design/design-principles)
- [Windows motion](https://learn.microsoft.com/en-us/windows/apps/design/motion/)
- [Windows geometry](https://learn.microsoft.com/en-us/windows/apps/design/style/rounded-corner)
- [Segoe Fluent Icons](https://learn.microsoft.com/en-us/windows/apps/design/iconography/segoe-fluent-icons-font)
- [Electron file-drop API](https://www.electronjs.org/docs/latest/api/web-utils)
- [Gemini model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations)

## Fluent review

See [the design and accessibility review](archive/FLUENT-REVIEW.md) for captured screens, measured contrast, tested states, and verification limits.

See [the follow-up cleanup review](archive/CLEANUP-REVIEW.md) for reliability fixes and restrained AI feature ideas.

The AI feature pass also exercises rule review/cancellation, question-and-answer context, advanced-editor review, persisted naming styles, and date-first suggestions from actual file metadata. `node scripts/ai-test.mjs` is an optional live integration check using the configured Gemini key, generic synthetic instructions, and one generated synthetic text file. It skips when no key is configured and is not part of CI.

## Collect files from subfolders

In Locations, choose the main source folder and enable **Include subfolders**. Select the file types you want (for example, PDFs), choose a destination, and review the files before confirming. The switch is off by default and saved on this computer.

Tidy can search all levels below the source and shows each file’s source folder in the preview. Matching files follow your existing organization rules; the original folders and unmatched files stay in place. Same-named files use your conflict policy, and Undo restores their original locations. The destination, `.Tidy Undo` folders, and symbolic links/junctions are excluded. Recursive searches require a different destination from the source. Exclude Hidden also skips dot-named subfolders; Windows Hidden attributes are not inspected. Preview shows up to 50 matches, while a confirmed run processes all matches.

The subfolder build is under `release/subfolders/`. `Run Tidy.cmd` selects the newest available packaged build. Close the previous Tidy window before launching it.

Verification: `npm run test:subfolders` covers nested traversal, filters, collisions, independent rename suggestions, destination exclusion, junctions, unreadable folders, and partial Undo. `npm run test:subfolders:desktop` exercises the interface and real moves with disposable files; it also accepts `TIDY_EXECUTABLE` to check the packaged app.

### Choose file types and source folders

Below Locations, **File types to move** lists the extensions enabled in Automated rules. Use **Clear file types**, then select `.pdf` (or several types). Other date, size, category, and conflict rules still apply. These extra selection controls appear and apply only when Include subfolders is on.

With Include subfolders on, **Folders to take files from** lists the main folder and all eligible nested folders, including empty folders. Use **Clear folders**, then check only the folders you want. Each checkbox includes files directly in that folder; select deeper folders separately. The main folder has its own checkbox. An empty folder or type selection moves nothing.

All folders includes newly added folders. Once you make an individual selection, new folders remain unselected; use Refresh folders to list them. Selections persist for the current source and do not carry over to a different source. Preview, manual and scheduled moves, and Insights respect the scope; Undo restores original paths. Destination, Undo backups, links, and excluded dot folders remain omitted.

Run Tidy.cmd launches `release/win-unpacked/Tidy.exe`, or the installed copy when there is no local build. The packaged executable was exercised with disposable mixed-type, nested, sibling, and root files. `npm run test:source-choices` verifies persistence, exact folder/type matching, preview, real moves, Undo, empty selections, and minimum window layout. Screenshots and results are under `.test-artifacts/source-choices/`.

### Fluent selection controls

The file-type and source-folder selectors now use the existing Fluent surface, accent, typography, focus, and control tokens. The two labeled cards use aligned search fields, subtle Select all/Clear actions, selection counts, Fluent icons, 18-pixel checkboxes, and highlighted folder rows. They stack at narrower widths. Search only filters the displayed options; selection and run scope stay unchanged. Clear and Select all apply to the whole list. Native checkbox keyboard behavior and Windows contrast-theme rendering are retained.

The build is in `release/fluent-source-choices/`. Run Tidy.cmd includes this build. The source-choices desktop test also checks search, Space-key selection, light/dark accessibility scans, 200% layout, and contrast rendering with screenshots in `.test-artifacts/source-choices/`. Reference: [Microsoft check box guidance](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/checkbox).

### Subfolder controls are conditional

File types to move and Folders to take files from are shown only while Include subfolders is on. Turning it off restores the normal root-folder workflow using Automated rules; stored subfolder selections do not filter those runs. Turning it back on restores the selections for the same source. The updated build is in `release/scope-visibility/`, included by Run Tidy.cmd.

## Watched folder, date folders, and rule sets

- **Tidy new files automatically** (Schedule and conflicts) watches the source folder, including subfolders when Include subfolders is on. Files already there are left alone, including later edits. A new file becomes eligible after its size and modified time have been unchanged for about five seconds and it no longer has an in-progress download name (`.crdownload`, `.part`, `.partial`, `.download`, `.opdownload`, `.tmp`, `.temp`). This settling check cannot guarantee that a writer has finished; a normal-named file paused for longer can become eligible. Each batch uses the current rules without a preview, appears in the Activity Log with its own Undo, and shows a Windows notification. Files put back by Undo are treated as existing files and are not moved again when edited. A destination different from the watched source is required. Failed files stay in place for manual review rather than being retried indefinitely.

- Undo refuses an older run when a newer outstanding run uses the same paths. Undo the newer run first. Moves have unique identities so undoing one run cannot clear another run's record just because it reused the same paths. Legacy last-run records may require Undo from the Activity Log. This protects dependencies between recorded runs; it is not a crash-recovery or external-file-versioning system.

- A watcher that stops with a filesystem error updates its status in the UI, and schedule registration errors are shown.
- **Date folders** (in each category's settings) add `2026` or `2026\03` under the category and any extension or content subfolder. Dates come from the last-modified time in the computer's time zone; photo capture dates (EXIF) are not read. Files routed to Review or Duplicates_Archive do not get date folders.
- **Rule sets** save the rules, filters, tools, naming style, subfolder setting, and conflict setting under a name. Folders are not included. **Downloads cleanup** and **Photos by month** are built in. Export writes your saved sets to a `.json` file; Import adds sets from one, renaming any whose name is taken.
- The installer removes legacy **Tidy this folder** entries when upgrading. Folder selection remains inside Tidy. File reveal and Open folder still use File Explorer normally. A second launch focuses the existing window without changing its folders or starting a run.
