# Fish Pet — Development Notes

## Dev Commands

- `npm run dev` — Start development server (electron-vite dev)
- `npm run build` — Build for production (electron-vite build)
- `npm run dist` — Build and package into installable (electron-vite build && electron-builder)
- `npm test` — Run unit tests (vitest, fake timers)

## Project Structure

```
src/
├── main/          # Electron main process (window, tray, IPC, config persistence)
├── preload/       # Context-isolated API bridge (window.api)
└── renderer/      # Vue 3 frontend (DesktopPet.vue is the core component)
```

## Key Conventions

- **Language**: Chinese (README, code comments, UI strings)
- **Config persistence**: JSON stored in `app.getPath('userData')/config.json`; owned by the configStore module (`src/main/config.ts`, debounced writes, flushed on will-quit). The `Config` type and the `window.api` contract live in `src/shared/` as the single source for all three processes
- **IPC**: Renderer uses `window.api` (exposed via preload); main process uses `ipcMain.handle/on`
- **Auto-launch**: Only applies in production builds; silently skipped in dev mode (`is.dev`)
- **Window**: Frameless, transparent, always-on-top, non-resizable desktop widget

## CI / Release

- CI triggers on git tags matching `v*` (e.g., `git tag v1.3.0 && git push --tags`)
- Builds on Windows and Ubuntu; publishes to GitHub Releases automatically
- Node.js version: 22

## Testing

- Unit tests via vitest (`npm test`), colocated as `*.test.ts`; CI runs them on push to master and PRs (.github/workflows/test.yml)
- All timer-driven behavior is owned by the PetScheduler module (src/renderer/src/composables/); new scheduled behavior registers a named timer there instead of raw setTimeout/setInterval

## Missing

- No lint or typecheck scripts defined

## Stack

Electron 31 + Vue 3 + TypeScript + electron-vite + electron-builder + @electron-toolkit

## Agent skills

### Issue tracker

Issues live in GitHub Issues (github.com/jimmyshe/fish) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
