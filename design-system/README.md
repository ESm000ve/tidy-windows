# Tidy / Windows design system

An editable library and portfolio reference for Tidy's Windows app. System version **1.0.0** documents app version **1.0.1**. Created November 2026.

## Start here

- Open **index.html** for the visual reference, live control specimens, and a simulated review → preview → confirm → Undo walkthrough. It works locally without installation or an API key.
- [Open the editable Figma library](https://www.figma.com/design/bgHq8hu5Ik7fiSx3pUi4v3).
- Read **DESIGN-SYSTEM.md** for the full behavior and quality contract.
- Use **PORTFOLIO-CASE-STUDY.md** as a factual case-study draft and edit it to reflect your own contribution.
- Download **design-tokens.json**, **tokens.css**, and **component-inventory.json** for the implementation mapping.
- **exports/** contains presentation PNGs exported from the Figma pages. Images are flattened presentation assets; the Figma components remain editable.

## What is in v1

Seven Figma pages cover the overview, foundations, buttons and fields, selection and status, workflows, accessibility and governance, and portfolio story. There are 11 component families with 49 variants, plus 12 Fluent icon components. Three variable collections contain raw colors, 23 semantic color aliases with Light/Dark modes, and 18 dimensional/motion values. Six text styles include five application roles and one presentation-only display style.

Figma uses **Inter as an editing fallback** because Segoe UI is unavailable in the connected editor. The application and local reference use the Windows Segoe UI stack. Sizes and line heights are aligned; font metrics are not claimed to be identical. Figma preview rows are annotated anatomy specimens rather than exact production-row replicas. Future-only states and governance practices are labeled in the documentation.

## Source of truth

The current application behavior and `src/styles/windows.css` define the implemented baseline. Figma and these documents describe that baseline; they do not modify the app. The proposed contribution process is guidance for future maintenance. No formal usability study, accessibility certification, adoption statistic, or business impact is invented.

## Rebuild the local reference

From the project root, run `node design-system/build-reference.mjs`. This uses Node's built-in filesystem tools and the app's existing source tokens; no new package is required. The HTML, CSS-token export and JSON inventories are generated from the existing stylesheet and this system's inventory.

The `figma-*.js` files are construction records for Figma's plugin runtime, not browser scripts or production app code. The state ledger records exact object IDs for safe continuation. Figma publishing and Code Connect registration are not part of this deliverable.

## Share

Keep this folder together when sharing the local reference. A future public portfolio can host it as static files. Do not include the app's `.env`, personal file paths, API keys, user profiles, test fixtures, or runtime build folders. Nothing in this folder needs a Gemini key.
