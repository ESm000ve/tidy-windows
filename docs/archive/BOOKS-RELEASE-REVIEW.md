# Books support — Windows 1.0.2

Verified November 6, 2026.

## Change

Adds a built-in Books category using the existing category controls and file pipeline. Its 21 formats are defined in `src/shared/ebookFormats.ts`. No new dependency or book-content parser was added. PDFs remain in Documents. Ebook AI suggestions use filenames rather than extracting book text or metadata. AI rule instructions recognize Books and exact requested extensions.

The desktop regression also exposed invalid accessibility labels on the existing status metrics. Adding a group role corrected their semantics without changing their appearance.

## Verification

- TypeScript checking and production Windows installer build passed.
- File tests passed for all 21 extensions, uppercase EPUB, exact extension selection, nested filename collisions, and byte-for-byte restoration with Undo.
- Existing desktop regression and all 12 browser smoke checks passed.
- Books desktop tests passed in development, the packaged app, and the installed app. They cover category controls, MOBI deselection, recursive EPUB selection, preview, confirmed moves, preservation of unrelated files, Undo, and disabled-category behavior.
- Automated light/dark accessibility checks found no violations in the tested Books states. These are automated checks, not a claim of complete WCAG conformance.
- Packaged settings tests passed for encrypted key storage, restart persistence, masking, removal, and missing-key handling using a synthetic key in an isolated profile.
- Installed update exited successfully. The normal user profile reports version 1.0.2, Books visible, saved API key present, and AI configured. No live AI request was made for this release.

Organization tests used synthetic file contents to verify matching and preservation; they do not validate ebook rendering or conversion, which Tidy does not provide. User files were not organized during verification.

## Delivery

Installer: `release/Tidy-Windows-1.0.2-x64-Setup.exe` (unsigned).

Installer SHA-256: `2F560784157B4C1FBE01D19C85472FAA10D402E6126525B036A683EBC70A6965`.

Packaged and installed `resources/app.asar` hashes match: `222E59F12A673AF6E4E2E5369DE6F8F3527E656174557A887DC1C7DF4F7F454D`.

Installed application: `C:\Users\Demo\AppData\Local\Programs\Tidy\Tidy.exe`.

Detailed Books test records: `.test-artifacts/books-14gWgI/results.json` (installed), `.test-artifacts/books-hYe7LX/results.json` (packaged), and `.test-artifacts/books-bOyb8i/results.json` (development).
