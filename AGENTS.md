# Fish Pet — Development Notes

## Dev Commands

- `npm run dev` — Start development server (electron-vite dev)
- `npm run build` — Build for production (electron-vite build)
- `npm run dist` — Build and package into installable (electron-vite build && electron-builder)

## Project Structure

```
src/
├── main/          # Electron main process (window, tray, IPC, config persistence)
├── preload/       # Context-isolated API bridge (window.api)
└── renderer/      # Vue 3 frontend (DesktopPet.vue is the core component)
```

## Key Conventions

- **Language**: Chinese (README, code comments, UI strings)
- **Config persistence**: JSON stored in `app.getPath('userData')/config.json`
- **IPC**: Renderer uses `window.api` (exposed via preload); main process uses `ipcMain.handle/on`
- **Auto-launch**: Only applies in production builds; silently skipped in dev mode (`is.dev`)
- **Window**: Frameless, transparent, always-on-top, non-resizable desktop widget

## CI / Release

- CI triggers on git tags matching `v*` (e.g., `git tag v1.3.0 && git push --tags`)
- Builds on Windows and Ubuntu; publishes to GitHub Releases automatically
- Node.js version: 22

## Missing

- No lint, typecheck, or test scripts defined
- No unit/integration tests

## Stack

Electron 31 + Vue 3 + TypeScript + electron-vite + electron-builder + @electron-toolkit
