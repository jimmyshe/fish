# Fish Pet — Development Notes

## Dev Commands

- `npm run dev` — Start development server (electron-vite dev)
- `npm run build` — Build for production (electron-vite build)
- `npm run dist` — Build and package into installable (electron-vite build && electron-builder)
- `npm test` — Run unit tests (vitest, fake timers)
- `cd server && uv run pytest` — 后端单元测试（pytest + respx stub JWKS）
- `cd server && uv run uvicorn app.main:create_app --factory` — 本地启动后端（需先配好环境变量，见 `server/.env.example`）

## Project Structure

```
src/
├── main/          # Electron main process (playground window, tray, IPC, config persistence, global mouse hook, auth 登录)
├── preload/       # Context-isolated API bridge (window.api)
└── renderer/      # Vue 3 frontend (DesktopPet.vue is the core component)
server/            # 铲屎计数后端（FastAPI + SQLite + uv，Python）
├── app/           # config（环境变量）、db（sqlite3）、auth（JWKS 验签 + userinfo 取用户名）、main（FastAPI app 工厂）
└── tests/         # pytest，唯一接缝是 HTTP API（TestClient），真 JWT + respx stub JWKS
```

## Key Conventions

- **Language**: Chinese (README, code comments, UI strings)
- **Config persistence**: JSON stored in `app.getPath('userData')/config.json`; owned by the configStore module (`src/main/config.ts`, debounced writes, flushed on will-quit). The `Config` type and the `window.api` contract live in `src/shared/` as the single source for all three processes. `windowX/windowY` 语义为鱼元素在屏幕内的位置（不再是窗口位置）
- **IPC**: Renderer uses `window.api` (exposed via preload); main process uses `ipcMain.handle/on`. 主→渲染推送先例：`onOpenSettings`（菜单触发）、`onPoopEnabledChanged`（config 开关变更推送给 renderer 即时生效；renderer 挂载时先拉一次再订阅）与 `onAuthStateChanged`（登录态变更，广播给所有窗口 BrowserWindow.getAllWindows()；各窗口挂载时先拉一次再订阅）。fire-and-forget 上报：`reportScoop()`（renderer 铲屎时无条件调用，是否登录由主进程判断）。联网数据 invoke 型：`getMe` / `getLeaderboard` / `setShowOnLeaderboard`（未登录或失败返回 null，renderer 给占位态）
- **Auth（登录）**: 登录态唯一属主是 `src/main/auth.ts`（openid-client v6 + PKCE + loopback 回调固定 127.0.0.1:12344，opener/safeStorage/文件路径注入便于测试）；token 经 safeStorage 加密写 `userData/auth.json`（独立于明文 config.json）；OIDC 参数为模块内常量 + env 覆盖（`POCKET_ID_ISSUER`/`FISH_OIDC_CLIENT_ID`/`FISH_API_RESOURCE`）；openid-client 是纯 ESM，electron.vite.config.ts 里 `externalizeDepsPlugin({ exclude: ['openid-client'] })` 必须保留。托盘菜单「🔑 登录 / 🚪 退出登录（用户名）」随状态切换
- **联网 API（apiClient）**: `src/main/apiClient.ts`，`/me`、`/leaderboard`、`/me/preferences`（opt-out 存服务器）的唯一属主；Bearer 来自 `auth.getAccessToken()`，未登录/失败一律返回 null；`DEFAULT_API_BASE_URL` 常量（env `FISH_API_BASE_URL` 覆盖）由 reporter 共用
- **联网面板（NetworkPanel）**: 独立 BrowserWindow（380×560、autoHideMenuBar、不可缩放、非透明非置顶），与游乐场窗口完全解耦——不再是浮层，无命中检测/拖拽接线，窗口拖动与关闭由 OS 负责；托盘菜单「🏆 排行榜」经 menu 注入的 `openNetworkPanel` 回调在 main 里开窗口（已存在则聚焦，关闭即销毁置 null）。页面是 electron-vite 多页第二入口 `src/renderer/network.html` + `src/network.ts`，`NetworkPanel.vue` 直接作页面根组件；用同一 preload，window.api 直接可用。轮询：挂载即拉一次 + `leaderboard-poll` 5 分钟轮询，窗口销毁即 app 卸载、PetScheduler cancelAll 自动停。设置面板只留「下班时间」
- **点击穿透与面板**: 设置面板打开不再强制全屏不穿透——默认仍全屏穿透，纯 `elementFromPoint` 命中检测驱动（面板开着也能点桌面其他应用）；`INTERACTIVE_SELECTOR` 命中的是面板盒子（`.settings-panel`）而非全屏背板（`*-overlay` 是 `inset:0` 的透明容器，进选择器会导致全屏不穿透）；面板开关时按当前光标位置主动做一次命中检测（解决「面板在光标下打开」的边角）；仅拖鱼期间强制不穿透以免丢 mouseup
- **铲屎事件上报（reporter）**: `src/main/reporter.ts`，铲屎 → `POST {FISH_API_BASE_URL}/events`（Bearer + UUID eventId 幂等键）；事件流、失败即丢弃（ADR 0003）：未登录/网络错误/4xx/5xx 一律静默，不排队不重试；`FISH_API_BASE_URL` 常量 + env 覆盖，风格同 auth.ts
- **Poop（拉屎）**: 纯逻辑在 `src/renderer/src/lib/poop.ts`，`Poop` 类型定义在 `src/shared/config.ts`（三进程共用）；屎列表持久化在 config `poops` 字段，开关 `poopEnabled`（默认 true，托盘菜单「💩 拉屎」切换）。屎元素是 `.playground` 的平级子元素（坐标即视口坐标），`.poop` 已加入 `INTERACTIVE_SELECTOR` 命中检测
- **Auto-launch**: Only applies in production builds; silently skipped in dev mode (`is.dev`)
- **Window**: 全屏游乐场窗口 —— frameless, transparent, always-on-top, non-resizable, `focusable: false`，覆盖整个主屏并固定于 (0,0)；默认 `setIgnoreMouseEvents(true, {forward: true})` 全屏穿透，renderer 经 `elementFromPoint` 命中检测 + `set-click-through` IPC 在光标位于鱼/UI 上时临时关闭穿透。鱼是窗口内的定位元素。置顶由 `src/main/alwaysOnTop.ts` 看门狗周期性重新声明（Windows 置顶层级会被其他置顶窗口抢占）；用户右键菜单关闭置顶时看门狗自动跳过。第二窗口：联网窗口（见联网面板条目），普通 OS 窗口，不参与穿透/置顶机制
- **Global mouse tracking**: `src/main/globalMouse.ts`（uiohook-napi，mousemove 30Hz 节流推送，点击不节流）；config `globalMouseTracking` 开关（默认 true），托盘菜单可切换；Linux Wayland 下静默降级为窗口内追踪。electron-builder 需保持 `npmRebuild: false` + `asarUnpack` uiohook-napi

## CI / Release

- CI triggers on git tags matching `v*` (e.g., `git tag v1.3.0 && git push --tags`)
- Builds on Windows and Ubuntu; publishes to GitHub Releases automatically
- Node.js version: 22
- test.yml 两个并列 job：vitest（Node 22）+ server pytest（astral-sh/setup-uv，`cd server && uv run pytest`）
- release.yml 两个 job：`release`（客户端打包，见下）+ `server-image`（docker/build-push-action 构建 `server/Dockerfile` 推 `ghcr.io/<repo-owner>/fish-server`，tag 为 git tag + `latest`，GITHUB_TOKEN + packages: write）
- 客户端构建期注入（ADR 0004）：四个值存 GitHub repo **variables**（非 secrets）——`POCKET_ID_ISSUER`、`FISH_OIDC_CLIENT_ID`、`FISH_API_RESOURCE`、`FISH_API_BASE_URL`；release job 经 `env:` 传入，electron.vite.config.ts 的 main `define` 在构建期烧进 bundle（未设置则 `??` 落回 auth.ts/apiClient.ts 硬编码默认值；dev 模式由本地环境变量覆盖）
- server 镜像运行：必填 env `FISH_POCKETID_ISSUER` / `FISH_API_RESOURCE`（其余见 server/.env.example）；SQLite 落 `/app/data/fish.db`，挂卷持久化（`-v fish-data:/app/data`）

## Testing

- Unit tests via vitest (`npm test`), colocated as `*.test.ts`; CI runs them on push to master and PRs (.github/workflows/test.yml)
- 后端测试：`cd server && uv run pytest`；测试自签 RSA JWT，外部 PocketID JWKS 端点用 respx stub，不 mock 鉴权本身、不直接查库断言
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
