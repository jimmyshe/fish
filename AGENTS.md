# Fish Pet — Development Notes

## Dev Commands

- `npm run dev` — Start development server (electron-vite dev)
- `npm run build` — Build for production (electron-vite build)
- `npm run dist` — Build and package into installable (electron-vite build && electron-builder)
- `npm run check` — 静态检查全套（`npm run typecheck && npm run check:timers && npm run check:version`）
- `npm run typecheck` — 运行 vue-tsc 类型检查（`vue-tsc --noEmit`）
- `npm run check:timers` — 检查渲染层禁止裸调 setTimeout/setInterval 规则
- `npm run check:version` — 校验 `package.json`、`package-lock.json`、`README.md` 与 `v*` tag 版本号一致
- `npm run generate:icons` — 生成全套应用图标（Windows .ico、Linux .png、托盘与窗口图标）
- `npm test` — Run unit tests (vitest, fake timers)
- `cd server && uv run pytest` — 后端单元测试（pytest + respx stub JWKS）
- `cd server && uv run uvicorn app.main:create_app --factory` — 本地启动后端（需先配好环境变量，见 `server/.env.example`）
- *Git Worktree 依赖复用*: 新建 worktree 时可通过目录联接秒级复用主目录依赖：`cmd /c mklink /J node_modules <path-to-main-node_modules>`（Windows 路径必须严格使用大写盘符如 `C:\...`，以保持与 Node 26 ESM 模块解析 URL 大小写一致，防止双重实例导致 Vitest 状态丢失）

## Project Structure

```
src/
├── main/          # Electron main process (playground window, 主面板, tray, IPC, stores, global mouse hook, auth)
├── preload/       # Context-isolated API bridge (window.api)
├── shared/        # Cross-process contracts & domain rules (config.ts, api.ts, achievements.ts)
└── renderer/      # Vue 3 frontend (index.html 游乐场 + panel.html 主面板)
    └── src/
        ├── components/    # DesktopPet.vue (纯视觉外壳), models/ (ClassicFishModel, OrcaModel), MainPanel/SettingsTab/LeaderboardTab/AchievementsTab
        ├── composables/   # usePetEngine (引擎桥接), PetScheduler (定时调度属主), useDrag
        ├── lib/           # petEngine (行为仲裁+运动模拟), behaviorTree, fishMotion, fishPosition, petTime, species, skins, poop
        └── styles/        # base.css, desktopPet.css
server/            # 铲屎计数后端（FastAPI + SQLite + uv，Python）
├── app/           # config（环境变量）、db（sqlite3）、auth（JWKS 验签 + userinfo）、main（FastAPI app 工厂）
└── tests/         # pytest，唯一接缝是 HTTP API（TestClient），真 JWT + respx stub JWKS
```

## Key Conventions & Gotchas

- **Language**: Chinese (README, code comments, UI strings)
- **领域术语与架构决策**: 概念定义见 [GLOSSARY.md](GLOSSARY.md)，架构决策见 [docs/adr/](docs/adr/)（0001 游乐场窗口、0002 Steering 漫游、0003 铲屎上报、0004 FastAPI 后端、0005 主面板、0006/0008 物种与调色解耦、0007 行为树决策、0009 本地成就）。新增宠物物种见 `.agent/skills/add-new-fish/SKILL.md`
- **宠物引擎（PetEngine）与行为树**: `src/renderer/src/lib/petEngine.ts` 为高层行为仲裁与 Steering 物理模拟的唯一属主；根优先级 `Dragging > ScaredDash > Sleeping > PoopStraining > Roaming`，`isSleeping` / `isPooping` 与动作进出副作用统一由 `tick()` 的行为树转移钩子收口
- **配置与持久化**: `Config` 契约与 `window.api` 位于 `src/shared/`。主进程各 store 独立落盘：`config.json`（`src/main/config.ts`，`configStore.set()` 是唯一写点并广播 `config-changed`）、`poops.json`（`poopStore`）、`achievements.json`（`achievementStore`）、`auth.json`（`safeStorage` 加密）。`windowX/windowY` 语义为鱼元素屏幕坐标而非窗口位置
- **Auth & 构建期注入**: `openid-client` v6 为纯 ESM，`electron.vite.config.ts` 中 `externalizeDepsPlugin({ exclude: ['openid-client'] })` 必须保留；PKCE loopback 回调固定 `127.0.0.1:12344`。客户端四项服务器参数（`POCKET_ID_ISSUER`/`FISH_OIDC_CLIENT_ID`/`FISH_API_RESOURCE`/`FISH_API_BASE_URL`）通过 GitHub repo variables 在构建期烧入 bundle（ADR 0004）
- **窗口、点击穿透与置顶**: 游乐场窗口全屏透明、`focusable: false`，默认 `setIgnoreMouseEvents(true, {forward: true})`，由 `elementFromPoint` 命中 `.fish-wrap, .bubble-wrap, .poop` 驱动；Linux 上 `forward` 无效，穿透时改由全局鼠标钩子位置驱动，关闭「全局鼠标追踪」或处于 Wayland 下不可点击属已知限制。`src/main/alwaysOnTop.ts` 看门狗在 Windows 周期重声明置顶（关闭置顶时自动跳过）
- **原生钩子打包与平台差异**: `src/main/globalMouse.ts` 使用 `uiohook-napi`（30Hz 节流移动，点击/按键脉冲不节流），`package.json` 需保留 `npmRebuild: false` + `asarUnpack`；Linux Wayland 静默降级为窗口内追踪。开机自启动仅在生产构建生效（`is.dev` 静默跳过）

## CI / Release

- CI triggers on git tags: 客户端 `v*`，后端 `server-v*`（`.github/workflows/release.yml` 两个 job 互斥）；Node.js 26
- `electron-builder` 默认上传产物到 Draft GitHub Release，客户端与后端完整发版流程见 `.agent/skills/release/SKILL.md`
- `server/pyproject.toml` 为后端版本号唯一来源（`GET /health` 通过 `tomllib` 读取，Docker 镜像需拷贝至根路径）；运行必填 `FISH_POCKETID_ISSUER` / `FISH_API_RESOURCE`，SQLite 挂卷 `/app/data/fish.db`（见 `server/docker-compose.yml`）

## Testing

- Unit tests via vitest (`npm test`), colocated as `*.test.ts`; CI runs `npm run check` + `npm test` + `cd server && uv run pytest` (`.github/workflows/test.yml`)
- 渲染层定时器唯一属主为 `PetScheduler`（`src/renderer/src/composables/PetScheduler.ts`），由 `npm run check:timers` 守护
- 后端测试自签 RSA JWT + respx stub 外部 PocketID JWKS，不 mock 鉴权本身、不直接查库断言

## Missing

- No ESLint configured (guarded by `npm run check`)

## Stack

Electron 31 + Vue 3 + TypeScript + electron-vite + electron-builder + @electron-toolkit

## Agent skills

### Issue tracker

Issues live in GitHub Issues (github.com/jimmyshe/fish) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
