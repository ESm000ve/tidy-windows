# Tidy — File Organizer

Tidy is a modern, beautifully designed file organizer built with Electron and React. It brings an elegant and intuitive interface to an otherwise tedious task, making it easy to keep your directories clean and organized.

![Tidy App Screenshot](./build/icon.png)

## Features

- **Dynamic Theme** — Supports Light, Dark, and System appearance.
- **Rule Engine** — Visually build rules to filter files by type, extension, string match, and date ranges.
- **Natural Language Parsing** — Type commands like *"Move all images from last week into my Archives"* and let the AI generate a rule for you.
- **Preview Operations** — Inspect exactly what will be moved and where *before* running any destructive operations. Handles file collisions and duplicates gracefully.
- **Intelligent Insights** — Detects common patterns in your folders to suggest rules that might save you time.
- **Auto-Scheduling** — Run your cleanups automatically on a daily, weekly, or monthly schedule.

---

## Design & Experience

Tidy was designed from the ground up to feel like a **first-class citizen on macOS**. We prioritized a native aesthetic and fluid interactions to ensure that organizing files feels less like a chore and more like magic.

### The Dashboard
![Tidy Dashboard](./assets/home_dashboard.jpg)
- **Glassmorphism & Depth:** We leverage translucent materials and subtle drop shadows that adapt beautifully to both light and dark modes, ensuring the app blends perfectly with your desktop environment.
- **Clear Affordances:** The drag-and-drop zones for Source and Destination are immediately obvious, reducing cognitive load for first-time users.

### Visual Rules Engine
![Visual Rules Engine](./assets/rules_engine.jpg)
- **Node-Based Logic:** Instead of overwhelming users with complex boolean dropdowns, the visual node system allows users to intuitively chain conditions (e.g., "If File Type is .pdf" AND "Date is Within 30 days").
- **Clean Typography:** Using SF Pro and careful whitespace management keeps the interface legible even when rules get complex.

### AI Natural Language Command Bar
![AI Command Bar](./assets/ai_prompt.jpg)
- **Invisible Complexity:** For power users, the glowing AI command bar at the bottom provides a frictionless way to create rules ("Type a natural language rule...").
- **Graceful Feedback:** Success states (like the "Rules updated" toast) are non-blocking and animate smoothly, keeping the user in the flow without requiring disruptive modal dismissals.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- npm v10 or later (comes bundled with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ericauzenne/tidy.git
cd tidy

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Open .env and add your Gemini API key (see below)

# 4. Start the app in development mode
npm run dev
```

### Environment Variables

AI features (Smart Rename and Natural Language Rule parsing) require a Google Gemini API key.

1. Copy `.env.example` to `.env`.
2. Obtain a free key at [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Add your key to `.env`:

```
GEMINI_API_KEY=your_key_here
```

> **Note:** Without a key the app runs normally. Smart Rename falls back to local filename heuristics and the AI command bar reports that the feature is unavailable.

---

## Build & Distribution

```bash
# Run a type check
npm run typecheck

# Build for the current platform
npm run build

# Build universal macOS DMG (Apple Silicon + Intel)
npm run build:mac
```

The macOS build outputs separate DMG and ZIP files for each architecture inside `dist/`:

| Architecture | Output |
|---|---|
| Apple Silicon (M-series) | `dist/arm64/Tidy-1.0.0-arm64.dmg` |
| Intel (x64) | `dist/x64/Tidy-1.0.0-x64.dmg` |

### ⚠️ macOS Gatekeeper

These builds use ad-hoc signing. Other users may see a *"Damaged"* or *"Unidentified Developer"* warning. To bypass it:

1. Drag **Tidy** to `/Applications`.
2. Open Terminal and run:
   ```bash
   xattr -cr /Applications/Tidy.app
   ```
3. Open the app normally.

For a public release, configure [Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution) by adding your Apple Developer credentials to the `electron-builder` configuration.

---

## Project Structure

```
tidy/
├── electron/         # Main process (Electron)
│   ├── main.ts       # App lifecycle, IPC handlers, AI integration
│   └── preload.ts    # Context bridge — exposes safe APIs to renderer
├── src/
│   ├── app/
│   │   ├── App.tsx           # Root React component and routing
│   │   ├── components/       # Feature and UI components
│   │   └── lib/              # Shared utilities (script generator, etc.)
│   ├── styles/               # Global CSS and theme tokens
│   └── main.tsx              # Renderer entry point
├── build/            # App icons and macOS entitlements
├── .env.example      # Environment variable template
└── vite.config.ts    # Vite + Electron plugin configuration
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

---

## Credits

- SF Symbols via [@bradleyhodges/sfsymbols](https://github.com/bradleyhodges/sfsymbols)

---

## License

[MIT](./LICENSE)
