# Contributing to Tidy

Use Windows 11 x64 and Node.js 22 or later. Clone your fork, then:

```powershell
npm ci
npx playwright install chromium
npm run dev
```

The app runs without a key. For optional online AI, add your own Gemini key in Settings. `.env.example` documents the development alternative. Never commit credentials or personal test files.

## Before opening a pull request

```powershell
npm run verify
npm run check:publish -- --history --build
```

Describe the problem, resulting behavior, and relevant validation. UI changes should include synthetic-data captures. `npm run screenshots` regenerates portfolio images after a build; review them before committing.

## Working conventions

- Use TypeScript and follow the component, hook, service, and IPC boundaries. The type checker rejects unused declarations.
- Keep filesystem access in Electron's main process behind the preload bridge. Preserve context isolation, disabled Node integration, and renderer sandboxing.
- Validate AI output and imported settings. Missing credentials must leave local organization usable.
- Preserve preview/run agreement, conflict safety, and Undo. Use fixtures in `.test-artifacts/`.
- Update product and design-system documentation when behavior changes. Label proposed behavior and incomplete research honestly.
- Keep dependency changes focused and explain why they are needed.

Report ordinary defects with synthetic reproduction steps, expected behavior, Windows version, and app version. Follow [SECURITY.md](SECURITY.md) for sensitive reports.
