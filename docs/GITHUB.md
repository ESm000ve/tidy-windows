# GitHub publication and maintenance

The Windows portfolio repository is [ESm000ve/tidy-windows](https://github.com/ESm000ve/tidy-windows). The original Mac repository is a separate project and should not receive Windows release changes.

## Before publishing updates

```powershell
npm ci
npx playwright install chromium
npm run verify
npm run check:publish -- --history --build
git status --short
git diff --check
git remote -v
```

Review files before committing. Keep `docs/screenshots/` and design-system exports as intentional portfolio assets. Exclude builds, `.env`, profiles, test artifacts, and ZIP bundles. The credential checker covers recognizable patterns in candidate files and, with `--history`, existing local history. Review documents and images separately.

The root README leads to the case study, screenshots, design system, and Windows download. Keep these links current. Do not claim unperformed user research or measured business impact.

## Windows releases

Build with `npm run build:win`. Test the generated app, then attach the installer to a versioned GitHub Release, together with a SHA-256 checksum. State that the installer is unsigned. Each user supplies their own Gemini key; no author key is distributed.

GitHub Actions verifies source and produces an installer artifact without automatically publishing a release. A green automated run does not replace manual installed-app, screen-reader, and user-research checks. The limits of the preparation pass are recorded in [the publication review](RELEASE-REVIEW.md).
