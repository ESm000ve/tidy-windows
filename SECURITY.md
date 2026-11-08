# Privacy and security

## Bring your own key

Tidy ships without a Gemini API key. Core organization works without one. Each user can add, replace, test, or remove their own key in Settings → AI connection. Windows secure storage encrypts saved keys for that account in Electron's user-data directory (`gemini-key.bin`), outside the repository and installer. An encrypted key file is still private: never share it or a user-data profile.

Development may use `GEMINI_API_KEY` from an ignored `.env`. Settings takes precedence. Removing a saved key does not remove an environment key. The renderer receives configuration status, not the saved key. Provider errors are reduced to generic messages to avoid exposing request metadata.

## Local data and online requests

Scans, moves, duplicate hashing, history, and Undo run locally. Local paths and operation history are stored in the user profile. Exported rule sets can include folder paths; review them before sharing.

Optional natural-language rules send the instruction and rule context to Gemini. Known-folder paths are resolved locally. Smart Rename and Smart sort can send filenames and supported file contents to Google. Inline formats include common images, PDF, text, and Markdown, up to 512 KiB per file; other files use filenames. Requests require internet access and use the key owner's quota. Connection testing sends a short test message.

## Before publishing

- Run `npm run verify`, then `npm run check:publish -- --history --build`.
- Keep `.env`, keys, profiles, personal fixtures, builds, and installers out of source control. `.env.example` is deliberately empty.
- Review screenshots and exports. The portfolio captures use synthetic files and anonymized folder labels.
- The checker recognizes common credential formats; it cannot prove the absence of every secret or sensitive document.
- If a key was published, revoke it with its provider. Deleting a file in a later commit does not remove it from Git history.

## Reporting a problem

Use GitHub's private vulnerability reporting if enabled for the published repository. Avoid credentials, personal contents, and private paths in public issues. For non-sensitive defects, include synthetic reproduction steps, Windows version, and app version.
