# Design-system validation

November 6, 2026 · System 1.0.0 · Application baseline 1.0.1

## Figma library

- Seven populated documentation pages, reviewed visually during construction.
- Eleven component families and 49 variants; all variant children verified as components.
- Twelve icon components imported from the application's actual Fluent SVG assets.
- Forty-one raw color primitives, 23 aliased semantic color variables, and 18 dimension/motion values.
- Light/Dark modes, explicit variable scopes, CSS `var()` syntax, and a semantic-alias check passed.
- Button Label, Show icon and Icon properties are exposed. An actual icon swap retained the primary action's semantic foreground binding.
- Six text styles, including one presentation-only display style. Segoe UI is the Windows source; Figma's Inter fallback is disclosed.
- Review boards use instances; main components are separate. Checks corrected clipped notes, populated-folder examples, local confidence, control alignment and visible radio focus rings.

## Portable reference

An isolated Chrome session exercised light/dark appearance, the 11-family component filter, switches, checkboxes, schedule radio keyboard input, the fixed review → preview → confirm → Undo demonstration, Escape dismissal and focus restoration.

Automated accessibility checks found no WCAG rule violations in seven exercised documentation states: light/wide, dark/wide, review dialog, file-preview dialog, 900px layout, 640px layout, and narrow Windows contrast-theme emulation. No page errors or horizontal overflow were detected. JSON inventories and exported PNG signatures passed asset checks.

The 640 CSS-pixel check is a responsive-layout check, not a claim of native browser 200% zoom testing. The underlying application's earlier zoom evidence is described separately in the system specification.

Local machine-readable evidence is under `.test-artifacts/design-system/validation.json` in the project. The complete Figma creation ledger remains in the source deliverable for safe continuation.

## Boundaries

The design system adds documentation and design assets. It does not change the production app or certify complete WCAG conformance. The HTML walkthrough uses fixed synthetic content and never accesses files, credentials or an AI provider. Figma preview rows are anatomy specimens. Some disabled variants and the governance process are specifications for future use. No formal family usability study, adoption metric or measured usability uplift is claimed. The Figma file is created and editable; team-library publishing and Code Connect registration have not been performed.
