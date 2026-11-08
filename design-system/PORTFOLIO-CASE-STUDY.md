> For the current product narrative, see [the portfolio case study](../docs/CASE-STUDY.md). This document focuses on the original design-system work.

# Tidy: a Windows design system built around user control

## Project context

I made Tidy as a file organizer for myself and my family. After developing the original desktop app, I wanted a dedicated Windows version that felt familiar on Windows 11 and kept the same core workflow. I also wanted to keep the app simple enough to maintain and potentially open source later.

My contribution included product direction, UX decisions, and reviewing the implementation, with AI-assisted design and development. This case study documents the working Windows app and a design system derived from it. It does not claim formal user research or measured usability improvement.

## The design problem

A desktop port needs more than different colors and icons. Users bring expectations about windows, menus, keyboard shortcuts, settings, controls and feedback. At the same time, file organization can change personal documents in ways that are hard to understand until after the action.

I framed the problem around two questions: how can the app feel familiar on Windows, and how can it help someone understand what will happen before files move?

## The system approach

I organized the system into foundations, controls, product patterns and quality criteria. This connects the visual interface to the behavior it supports. A consistent button matters, but so does the point in the workflow where that button appears.

The visual baseline uses Segoe UI Variable, Microsoft's Fluent icons, neutral surfaces, compact controls, and separate light/dark semantic roles. Accent color identifies action and selection. Geometry follows a 4px control radius and 8px container radius. Motion is restrained and respects reduced-motion preferences.

The implementation remains Electron and React. That was a practical scope decision for a small utility. I followed Windows conventions without presenting the app as a native WinUI 3 or Mica application.

## Decision 1: make the scope visible

Subfolder collection creates a risk of moving more files than intended. The system keeps that capability off by default and shows extra folder and file-type controls only when it is enabled. Selection counts help describe the scope. Clear means nothing is selected; it never falls back to selecting everything.

Search filters the visible options without changing which options are selected. Choosing a different source resets folder-specific selections. These rules are part of the component contract, rather than details left for each screen to decide independently.

## Decision 2: separate AI interpretation from execution

AI can interpret an instruction incorrectly even when it returns valid data. I kept a review step that describes the validated settings locally. When an instruction is ambiguous, the app asks a focused question instead of immediately changing the configuration.

Accepting that interpretation is separate from authorizing file changes. An immediate AI instruction opens the normal preview after acceptance. Confirm & Run remains the final file-move decision. The trade-off is an additional review step, which supports two different commitments: changing rules and moving personal files.

I also kept the AI scope small: a clarification flow and one naming preference rather than a persistent chat assistant or background indexing service. Date-first naming uses the file's modification date locally. Offline naming is labeled as a local pattern so the interface does not imply that AI analyzed the contents.

## Decision 3: design recovery as part of completion

Completion needs to explain what changed and what can be recovered. The Activity Log retains the last 10 runs across restarts, including manual, scheduled, and watched-folder runs, each with its own Undo. Replacement behavior preserves the earlier version for Undo. A partial reversal keeps pending operations available rather than discarding them.

The system also states the limits. Undo is not unlimited history or crash recovery. Scheduled and watched-folder runs skip interactive preview and do not generate Smart Rename suggestions. I chose to document those boundaries rather than promise a recovery model the app does not implement.

## What the design system contains

The editable Figma library has seven pages, 11 component families and 49 variants. It includes aliased light/dark color variables, dimensional values, text styles, actual Fluent icon assets, and reusable scope and AI-review patterns. A portable visual reference maps these assets back to the Windows stylesheet and components.

The Figma editor available for this work does not expose Segoe UI, so its specimens use a clearly labeled Inter fallback. The application and local reference retain the Windows font stack. The system also distinguishes implemented behavior, design-spec state coverage and proposed governance.

## Evidence and limits

The app has been exercised through automated file-safety and desktop workflows, including nested files, duplicate handling, replacements, preview, Undo, reviewed AI instructions and encrypted key storage. The cleanup verification passed 14 component/pattern accessibility states and 14 measured color pairs. Those checks found no WCAG rule violations in the exercised states.

This is evidence of implementation and targeted verification, not a complete accessibility certification or a measured usability outcome. I do not yet have participant research demonstrating that family members understand scope, confidence and recovery as intended.

## What I would evaluate next

I would ask representative family members to collect PDFs from selected nested folders, decline an incorrect suggested name, recover a replaced file, and continue after a partial Undo. I would observe scope errors, task completion, recovery success, confidence interpretation and the time needed to understand the next action. I would also test the complete task with assistive technology.

The goal is to learn whether the system's moments of control are clear and proportionate, and where they add effort without improving understanding.

## Credits

Microsoft Windows and Fluent guidance informed the platform conventions, and Microsoft supplies the Fluent icons. The app uses Electron, React, Radix and other open-source dependencies. AI-assisted collaboration supported design, implementation and verification. This draft should be edited to match the owner's contribution before publication; no fabricated role, research sample or impact metric is included.
