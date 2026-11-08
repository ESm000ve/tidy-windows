# Tidy / Windows design system

Version 1.0.0 · November 2026 · Baseline: Tidy Windows 1.0.1

## 1. Product purpose and system boundary

Tidy helps its owner and family organize files by choosing a source, destination, file types, filters and optional AI tools. The system makes those decisions visible before files move and supports recovery afterward. This is a focused desktop utility, not an enterprise content platform.

The application uses Electron, React, Radix controls, and Microsoft's Fluent icons. Its native Windows window frame, Segoe UI typography, control geometry, light/dark roles, keyboard access and settings conventions follow Windows design guidance. The renderer uses opaque layers; it is not a native WinUI 3 or Mica implementation.

This deliverable documents the Windows app and creates editable design assets. It changes no production screen, behavior, dependency, API key, or installed application.

## 2. Principles that guide decisions

| Principle | Design rule | Product example |
|---|---|---|
| Make scope explicit | Display what is selected and distinguish All from None. | Clearing file types or folders selects nothing. Searching the list does not alter selection. |
| Separate commitments | Treat a configuration change and a file move as different decisions. | Accept an interpreted AI rule, inspect the file preview, then Confirm & Run. |
| Preserve a path back | Explain recovery and its limits alongside completion. | Undo restores the latest manual run, including replacement backups and pending partial operations. |
| Borrow familiar conventions | Use the platform's type, iconography, geometry and input behavior. | Compact Fluent controls, Ctrl+, Settings, native folder pickers and File Explorer reveal. |
| Explain assistance honestly | Attribute AI and local patterns, show uncertainty, and avoid unsupported promises. | Local name suggestions say Local; date-first names use modification metadata. |

These are design principles and hypotheses, not findings from a formal participant study.

## 3. Foundations and token architecture

The portable JSON inventory includes 23 semantic color roles, two theme values per role, CSS names, and provenance. Figma contains raw color primitives, a semantic Color collection with Light and Dark modes, and a Dimensions collection. Components bind fills, strokes, spacing and radii to variables. Semantic colors alias primitives rather than duplicating values.

The app can derive an accent from Windows. The documented blue is the default baseline; it is not a fixed brand color that overrides the user's system preference. Hover and pressed accent values in Figma are resolved snapshots of the code's color-mix formulas at that baseline.

| Role | Light | Dark | Usage |
|---|---|---|---|
| Window | #F3F3F3 | #202020 | Main canvas |
| Card | #FFFFFF | #2B2B2B | Grouped tasks and information |
| Layer | #FAFAFA | #252525 | Dialog body and nested surface |
| Primary text | #1A1A1A | #F5F5F5 | Content and labels |
| Secondary text | #5C5C5C | #BDBDBD | Supporting explanations |
| Accent | #005FB8 | #60CDFF | Primary action and selected cues |
| Accent label | #FFFFFF | #000000 | Text over the accent fill |
| Strong boundary | #858585 | #A0A0A0 | Meaningful control boundaries |
| Success | #0F6C0F | #A6DF9C | Positive feedback with a text label |
| Warning | #895000 | #F7CF8B | Review-needed feedback with a text label |
| Error | #B10E1C | #FFB3BC | Errors and lower-confidence cues |

Use semantic roles rather than colors chosen by appearance. Never place the light theme's secondary text over a dark surface or reuse the light accent label in dark mode. A faint decorative divider need not meet the same requirement as a meaningful control boundary.

### Typography

The Windows stack is `Segoe UI Variable Text`, `Segoe UI`, `system-ui`, `sans-serif`. Figma's Inter fallback is explicitly labeled; no unlicensed font files are bundled.

| Role | Size / line height | Weight | Purpose |
|---|---|---|---|
| Page title | 28 / 36 px | 600 | Organize files |
| Section | 20 / 28 px | 600 | Locations, Filters, Settings |
| Body strong | 14 / 20 px | 600 | Important labels and file names |
| Body | 14 / 20 px | 400 | Controls and ordinary copy |
| Caption | 12 / 16 px | 400 | Supporting metadata |
| Portfolio display | 48 / 56 px | 600 | Presentation only; not an app text role |

### Layout and geometry

Use a 4px rhythm with observed values of 4, 8, 12, 16, 20, 24, 28 and 32px. Optical exceptions, such as 6px label gaps and 3px checkbox corners, follow the implemented components. Do not force every dimension onto a mathematical scale at the expense of the source.

- Controls use a 4px radius and at least 32px height. Main containers and dialogs use an 8px radius.
- Switches have a 40×20px visible track inside a 44×32px hit target.
- File-type/folder checkboxes have an 18px visual box; their full label row is the interaction target. Folder rows are at least 42px high.
- Folder cards use 24px padding and a 156px minimum height. Settings rows use a 72px minimum height.
- Settings is at most 680px wide; AI rule review is at most 600px. Both leave viewport clearance and allow internal scrolling.
- The desktop window has an 800×600 minimum. Source selectors stack at narrower sizes and form two columns from 1000px. At 200% zoom, preserve reading and keyboard access instead of shrinking text to fit.

The Dimensions collection records existing literals where no named CSS token exists. It does not pretend the production code already has a fully abstracted spacing-token architecture.

The exported `tokens.css` adds `--tidy-primitive-*` and dimension aliases for Figma traceability. These aliases live only in this documentation deliverable. Semantic color syntax continues to point to the actual application CSS names. The current Select trigger is 36px high; 32px is the shared minimum control height.

### Motion

Use the observed 83ms feedback, 167ms control and 250ms entrance durations. Entrance easing is `cubic-bezier(0,0,0,1)`; exit easing is `cubic-bezier(1,0,1,1)`. These values are task-specific defaults, not a requirement to animate every property. Respect reduced-motion preferences and never delay a state update to finish an animation.

### Iconography

Use the existing `@fluentui/react-icons` family. Icons support labels rather than replace them. Give icon-only actions an accessible name. The Figma library contains 12 editable icon components imported from those actual SVG assets; button icons use an instance-swap property instead of multiplying the variant matrix.

## 4. Component contracts

The JSON component inventory maps every family to its source, variants, properties and expected behavior. Figma review boards show instances; master sets remain outside the presentation frames.

| Family | Variant coverage | Behavior contract |
|---|---|---|
| Button | Primary/Standard × Rest/Hover/Pressed/Focus/Disabled | One primary action per decision. Expose Label, Show icon and Icon. Focus is independent of selection. |
| Text field | Rest/Hover/Focus/Disabled | Persistent label and editable value; explain validation near the field. |
| Select | Rest/Hover/Focus/Disabled | Choose from a bounded list; arrows navigate, Enter chooses, Escape dismisses and restores trigger focus. |
| Switch | Checked/Unchecked × Rest/Focus/Disabled | Changes a setting; Space toggles; exposes its name and checked state. |
| Checkbox | Checked/Unchecked × Rest/Focus/Disabled | Changes membership in a set; the entire label is clickable. |
| Radio choice | Checked/Unchecked × Focus/Rest | One active choice in a group; arrows wrap, Home/End select the edges, one option is in Tab order. |
| Tool chip | Rest/Selected/Disabled | Uses aria-pressed; changes a capability without starting a run. |
| Confidence badge | High/Medium/Low | Text and color qualify the suggestion; neither grants execution permission. |
| Folder card | Empty/Populated/Drag over | Choosing or dropping a folder changes scope, not files. |
| AI rule dialog | Review/Clarification | Shared rule-review pattern; Cancel leaves state unchanged. |
| Preview row | Extension/AI/Local/Duplicate | Show file identity, destination, attribution and the relevant confidence or duplicate cue. |

Disabled tool-chip and selection variants are design-spec coverage. The current screen decides whether they are exposed. Figma preview rows are editorial anatomy specimens; they are not exact replicas of every production-row detail. Dialog close buttons and runtime progress are specified in the behavior contract even where a composition sheet omits them for clarity. No interactive prototype or published Code Connect mapping is claimed for the Figma library.

## 5. Product patterns and state transitions

### File scope

Choose source and destination → enable relevant categories → optionally include subfolders → optionally select exact folders/types → inspect the preview. Subfolder controls appear only when the feature is enabled. A checkbox selects files directly in that folder; deeper folders are separate choices. Changing the source clears folder-specific scope. Destination folders, Undo backups and links are excluded from traversal.

### AI-assisted rule creation

Instruction → optional clarification → local summary of validated settings → Apply rules or Apply and preview. The Advanced editor applies settings without starting a run. The inline immediate-action path opens the normal file preview after acceptance. Both preserve the separate Confirm & Run step. While a request is busy, dismissal may be temporarily blocked; requests have a bounded transport timeout.

The summary describes actual validated configuration rather than repeating an AI promise. Do not reinterpret unsupported older-than cutoffs as recent-date filters. The supported recent ranges mean within 1, 7, 30 or 365 days. Arbitrary date ranges, automatic deletion and date-based destination grouping remain unsupported.

### Smart naming and attribution

Show the original and proposed names, suggestion source, confidence, and acceptance state. Descriptive and Date first are the two preferences. Date first uses each file's modification time in local time, not a model-invented date or today's date. Local fallback labels must not imply content analysis by AI. Higher-confidence suggestions may be preselected; medium/low suggestions need explicit review and may be routed to Review.

### Preview and confirmation

Preview → inspect the plan → Confirm & Run → progress → completion or partial error → optional Undo. The preview shows at most 50 matching files; confirmation processes all matching files, with AI suggestions restricted to previewed files. Never write copy suggesting only the displayed files will run. Folder paths may truncate visually while retaining the full value for inspection.

### Conflicts and recovery

Keep both appends a number; Skip preserves the existing destination; Replace keeps a backup for Undo; Archive handles duplicates and preserves both names on collisions. Undo restores the latest manual run and retains pending operations after a partial reversal. It does not overwrite a new file created at the original location. This is not unlimited history, a crash recovery journal, or automatic backup deletion.

### Scheduling

Daily, Monday weekly, and first-of-month monthly schedules run while the app is open and respect the configured start date. Closing Tidy stops scheduling. Scheduled runs do not generate Smart Rename suggestions or expose an Undo record in the current UI. Describe that difference clearly instead of extending the manual-run promise to schedules.

## 6. Content design

Lead with the state, explain its consequence, then give a recovery action. Use familiar nouns and concrete verbs: Choose folder, Review AI rule, Apply and preview, Confirm & Run, Undo. Avoid a generic OK when a more precise action is available.

| Situation | Copy pattern | Avoid |
|---|---|---|
| Missing source | Choose a source folder before running. | An unexplained disabled primary action. |
| Ambiguous AI instruction | One detail first, followed by one focused question. | Guessing and changing settings immediately. |
| Offline naming | Local name pattern. | Claiming AI analyzed the contents. |
| API quota issue | Explain the limit and offer retry or quota review. | Raw provider responses or secret-bearing logs. |
| Partial run | State that some files failed and direct the user to the log. | An unqualified success message. |
| Partial Undo | Explain pending operations and preserve retry information. | Saying everything was restored. |

AI connection belongs in the existing Settings dialog. Mask the key, clear the input after saving, offer Test connection and Remove saved key, and explain which contents can be sent to Google. Saved credentials are encrypted for the Windows account; they are not bundled into the installer. Ordinary organization and duplicate comparison are local. AI is optional and uses online access and provider quota.

## 7. Accessibility quality bar

Use WCAG 2.2 AA as a design and test target for the renderer. Normal text generally requires 4.5:1 contrast; large text and applicable non-text cues require 3:1. Minimum target size is 24×24 CSS px subject to the criterion's exceptions. Larger label rows and switch targets improve usability beyond their visible geometry.

Verify keyboard order, accessible names, selected/checked state, visible focus, focus containment/restoration, meaningful status announcements, and errors that identify a next action. Test 200% zoom, reduced motion, Windows contrast themes and both color modes. Do not suppress keyboard text undo to trigger file Undo while the user is typing.

The current implementation has automated file-safety and desktop checks. The cleanup verification passed 14 preview/review/zoom/contrast states and 14 measured color pairs without detected WCAG rule violations in those exercised states. The earlier full screen audit covers 18 states with filter-popup landmark advisories. These results do not establish complete accessibility conformance. Screen-reader tasks, broader device coverage and representative family usability sessions remain open work.

## 8. Governance — proposed practice

1. **Propose:** identify the user task and explain why existing components cannot solve it.
2. **Specify:** include variants, keyboard behavior, copy, error/recovery, theme and resize behavior.
3. **Reconcile:** compare Figma with source. Name intentional representation gaps; never silently claim parity.
4. **Verify:** run only relevant automated checks and inspect the affected composition.
5. **Release:** update inventory, change notes and any migration guidance. New optional states are additive; changed property meanings or task behavior require a breaking-change note.

For a small app, the owner can review this checklist with a contributor. Do not invent a multi-team governance council or an adoption program. Suggested readiness levels are Proposed → Specified → Implemented → Verified. Existing Figma components are Specified representations; app behavior has the verification scope documented above.

## 9. Ownership and references

The owner provided product direction, original design intent and implementation decisions, with AI-assisted design and development. Review first-person portfolio copy before publishing. Credit the platform guidance and open-source dependencies accurately.

- [Windows typography](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography)
- [Windows geometry](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/geometry)
- [Windows timing and easing](https://learn.microsoft.com/en-us/windows/apps/design/motion/timing-and-easing)
- [Fluent icon source](https://github.com/microsoft/fluentui-system-icons)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 10. Change record

**1.0.0 / November 2026:** documented the existing Windows baseline, created the editable seven-page Figma library, exported portfolio sheets, added a portable visual reference and token inventory, and labeled proposed governance and research. The application was not redesigned or changed by this design-system deliverable.
