# Family-use cleanup pass — October 22, 2026

This pass keeps the existing layout and optional Gemini features. It adds no dependencies, accounts, or settings pages.
Sixteen unused design-template dependency declarations were removed and the lockfile was refreshed offline. This reduces development dependencies; the packaged app already excluded the development dependency tree.

## Fixes

- Preview and execution now agree on enabled rules, modification dates, file size, hidden dot-files, and file ordering. Custom categories use their IDs instead of assuming the name and ID match. Missing folders report an error instead of appearing empty.
- The 50-file preview limit is explicit. Runs include all matching source files, with AI suggestions limited to the previewed files.
- Duplicate checks hash complete file contents with SHA-256. Equal-size files sharing the first 64 KB no longer count as duplicates. Checking is local.
- AI rename caching includes the full file path and modification time, so unrelated files and same-size edits do not reuse an old suggestion.
- AI rename output is validated before display: invalid paths, changed extensions, unexpected confidence values, and malformed objects are handled safely. AI category patches also filter unexpected types and extensions.
- Smart sort obtains suggestions without requiring Smart Rename, and can retain the original filename. AI-triggered previews use the newly applied rules and filters immediately.
- Replacing an existing file preserves its old version in `.Tidy Undo` and records both moves for Undo. A partial Undo retains only pending operations. Successful Undo remains cleared after restart.
- A shared guard prevents schedules, manual runs, and Undo from moving the same files concurrently. Symbolic links are skipped consistently.
- Removed the nonfunctional keep-original-copy button and unused category override UI. Empty previews cannot be confirmed. The preview uses the existing dialog library for keyboard focus trapping, Escape, and focus restoration.
- Confidence labels use theme-aware orange/red text instead of fixed light colors. Long folder paths truncate instead of stretching file rows. Examples no longer promise unsupported automatic duplicate deletion or date-based folder grouping.
- Offline filename suggestions are labelled as local patterns, rather than claiming an AI analysis occurred.

## Verification

Checks use disposable synthetic files in `.test-artifacts` and isolated profiles. No family documents are used for testing or sent to AI. The rule-parser regression uses a local fixture; live Gemini output is not certified by these tests.

- TypeScript compilation and production build.
- File safety: reserved names, traversal, collision rename, Undo conflicts, replacement/restore, shared-header false duplicates, filtered/custom-category previews, stale rename caches, malformed AI values, Smart sort without renaming, and overlapping jobs.
- Desktop: Settings/theme behavior, preview focus trap/Escape, actual UI run and persistent Undo, actual moves, missing-key handling, and immediate preview after an AI rule update.
- Browser smoke checks for the main controls.
- Automated accessibility checks across light/dark screens and dialogs; populated previews including high/medium/low confidence, 200% zoom, forced colors, reduced motion, and measured text/control contrast.

Automated accessibility checks cover the exercised states; they do not establish complete WCAG 2.2 conformance. Existing best-practice advisories and manual-review items remain described in [the Fluent review](FLUENT-REVIEW.md).

The cleanup build passed all 10 browser checks, 18 screen accessibility states, and 6 preview/zoom/contrast states, with 14 measured contrast pairs. That package remains in `release/cleanup/`. The subsequent AI feature build passed 12 browser checks, 18 screen states, and 14 preview/naming/review/zoom/contrast states, plus the live synthetic Gemini check. The latest package is in `release/`, and `Run Tidy.cmd` chooses the newer executable.
The desktop and preview/contrast suites also passed against this packaged executable. Captures and machine-readable evidence are kept locally: [light suggestion preview](../../.test-artifacts/fluent-validation/light-AI-confidence-preview.png), [dark suggestion preview](../../.test-artifacts/fluent-validation/dark-AI-confidence-preview.png), [preview/contrast report](../../.test-artifacts/fluent-validation/report.json), and [screen accessibility report](../../.test-artifacts/audit/report.json).

## Small AI additions worth considering

1. **A short confirmation of an interpreted instruction.** Show “Move PDFs modified in the past week to Documents” before applying it. Ask one focused question for ambiguous requests such as “old files.” Much of this can be generated locally from validated settings, without another AI call.
2. **One preferred naming style.** For example, descriptive names or date-first names, reused by the existing Smart Rename prompt. Keep it optional rather than building a template editor.

Both additions were implemented in the subsequent AI feature pass: a shared review/clarification dialog for both AI entry points, and one saved naming-style dropdown shown with Smart Rename. See [usage and limits](../WINDOWS.md#ai-rule-review-and-naming-style). The review summary is generated locally from validated settings, and date-first naming uses local modification times. No dependencies, accounts, or settings pages were added. A persistent chat assistant, semantic search database, background content indexing, and automatic deletion remain outside this app's scope.

Google also recommends validating model values in the application even when using structured JSON: [Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output).
