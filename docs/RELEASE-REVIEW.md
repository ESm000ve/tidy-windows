# GitHub preparation review

November 8, 2026 · Windows x64 · Source version 1.1.1

## Changes in this pass

- Rebuilt the README around the product problem, workflow, design decisions, and working screenshots.
- Added a portfolio case study, privacy/security guide, and GitHub publication guide.
- Captured four real desktop states with synthetic files, anonymized folder labels, and no configured key.
- Moved historical reviews into `docs/archive/`, repaired maintained documentation links, and replaced personal machine paths in those notes.
- Removed the unused Python-script generator, obsolete Puppeteer capture script, and outdated cleanup script.
- Removed unused imports and props; enabled TypeScript checks for unused declarations.
- Consolidated test fixtures under `.test-artifacts/`, fixed standalone test directory setup, and made the design-system verifier's browser path configurable.
- Added a publication checker, a single verification command, broader private-file exclusions, consistent line-ending rules, and CI publication checks with read-only repository permissions.
- Cleared the local development key without printing it. Settings-based bring-your-own-key behavior is retained. Saved keys outside this project remain local to their Windows account.
- Removed approximately 2.5 GB of obsolete generated release output and the redundant design-system ZIP. The current installer and unpacked app were rebuilt from the cleaned source.
- Pointed Help links and package metadata to the Windows publication destination: `ESm000ve/tidy-windows`.

## Verification completed

`npm run verify` passed all 16 steps. Browser checks used installed Chrome via `CHROMIUM_PATH`; a fresh clone can install Playwright Chromium as documented.

| Area | Result |
| --- | --- |
| TypeScript and production build | Passed, including unused-code checks. |
| File safety | Passed reserved-name and traversal rejection, collision handling, duplicate hashing, replacement preservation, concurrent-run protection, and Undo regressions. |
| Recursive scope | Passed 11 regression groups, including explicit folder/type selection, unreadable folders, junction exclusion, and preview/run agreement. |
| Product features | Passed date folders, rule-set import/export, history, backup cleanup, watched files, persistence, and second-launch behavior. |
| Browser UI | 12/12 smoke checks passed; no console errors. |
| Desktop UI | Passed workflows, review and clarification, preview, moves, Undo, source choices, Books, and minimum-size layout. |
| Key storage | Passed masked input, encrypted storage, no localStorage secret, restart, removal, and missing-key handling. |
| Targeted accessibility | No WCAG rule violations across 18 screen states and 14 preview/review/zoom/contrast states. All 14 measured color-role contrast checks passed. Filter-menu states retain three non-WCAG best-practice advisories per theme. |
| Design-system reference | Passed themes, search, live controls, keyboard interaction, workflow simulation, focus/Escape, responsive layouts, contrast theme, and PNG/JSON asset checks. |
| Portfolio screenshots | Four captures produced; the capture flow also moved and restored five synthetic files through the real UI. Images visually reviewed. |
| Windows packaging | NSIS installer and unpacked app built successfully. Packaged desktop and key-storage suites passed. |
| Package privacy | The packaged archive had 15 entries; no `.env`, key file, profile, test-artifact directory, or dependency tree. Built output passed credential-pattern checks. |
| Git publication | Candidate files and 352 historical text blobs passed recognized-credential checks. Maintained documentation links and whitespace checks passed. |

Disposable profiles are removed after verification. Local audit reports and synthetic screenshots remain ignored under `.test-artifacts/`; public captures live in `docs/screenshots/`.

## Limits and publication steps

- The initial preparation was local. The owner subsequently authorized publication to [ESm000ve/tidy-windows](https://github.com/ESm000ve/tidy-windows). The original Mac repository remains separate. See [publication maintenance](GITHUB.md) for future releases.
- The rebuilt installer is unsigned. This pass tested its unpacked runtime; it did not install over the owner's existing app, change startup registration, or repeat the full manual installer/native-shell checklist.
- Live Gemini requests were deliberately skipped. Key storage, missing-key behavior, local fallback, and fixture-based rule review were tested; provider access and quota depend on each user's key.
- Automated checks do not establish full WCAG conformance. Manual screen-reader testing and participant research remain open.
- Vite reports a renderer bundle-size advisory of approximately 599 kB before gzip. The build succeeds; no chunking refactor was introduced during this cleanup.
- Credential patterns are guardrails, not proof against every kind of private data. Included screenshots were reviewed, and no personal documents are included in the publication set.
