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
├── main/          # Electron main process (playground window, 主面板 window, tray, IPC, config persistence, global mouse hook, auth 登录)
├── preload/       # Context-isolated API bridge (window.api)
└── renderer/      # Vue 3 frontend (DesktopPet.vue 游乐场；panel.html 主面板入口 + MainPanel/SettingsTab/LeaderboardTab)
server/            # 铲屎计数后端（FastAPI + SQLite + uv，Python）
├── app/           # config（环境变量）、db（sqlite3）、auth（JWKS 验签 + userinfo 取用户名）、main（FastAPI app 工厂）
└── tests/         # pytest，唯一接缝是 HTTP API（TestClient），真 JWT + respx stub JWKS
```

## Key Conventions

- **Language**: Chinese (README, code comments, UI strings)
- **Config persistence**: JSON stored in `app.getPath('userData')/config.json`; owned by the configStore module (`src/main/config.ts`, debounced writes, flushed on will-quit). The `Config` type and the `window.api` contract live in `src/shared/` as the single source for all three processes. `windowX/windowY` 语义为鱼元素在屏幕内的位置（不再是窗口位置）
- **IPC**: Renderer uses `window.api` (exposed via preload); main process uses `ipcMain.handle/on`. 配置同步唯一缝隙：`configStore.set()` 是唯一写点，set 即向所有窗口广播完整 Config（`config-changed`）；renderer 一律挂载先拉 `getConfig()`、再订阅 `onConfigChanged`（DesktopPet 只挑关心的字段比对，poopEnabled 真实变化才重应用）。登录态推送：`onAuthStateChanged`（广播给所有窗口 BrowserWindow.getAllWindows()；各窗口挂载时先拉一次再订阅）。主面板 tab 切换：`panel-switch-tab`（托盘再次点击入口项时推送给已打开的主面板）。setter 通道（set-work-end-time 等）保留但不再兼任同步（不回传 Config）。fire-and-forget 上报：`reportScoop()`（renderer 铲屎时无条件调用，是否登录由主进程判断）。联网数据 invoke 型：`getMe` / `getLeaderboard` / `setShowOnLeaderboard`（未登录或失败返回 null，renderer 给占位态）
- **Auth（登录）**: 登录态唯一属主是 `src/main/auth.ts`（openid-client v6 + PKCE + loopback 回调固定 127.0.0.1:12344，opener/safeStorage/文件路径注入便于测试）；token 经 safeStorage 加密写 `userData/auth.json`（独立于明文 config.json）；OIDC 参数为模块内常量 + env 覆盖（`POCKET_ID_ISSUER`/`FISH_OIDC_CLIENT_ID`/`FISH_API_RESOURCE`）；openid-client 是纯 ESM，electron.vite.config.ts 里 `externalizeDepsPlugin({ exclude: ['openid-client'] })` 必须保留。登录/退出入口在主面板「🏆 排行榜」tab（登录失败由 tab 内错误文案呈现，不再弹主进程对话框）
- **联网 API（apiClient）**: `src/main/apiClient.ts`，`/me`、`/leaderboard`、`/me/preferences`（opt-out 存服务器）的唯一属主；Bearer 来自 `auth.getAccessToken()`，未登录/失败一律返回 null；`DEFAULT_API_BASE_URL` 常量（env `FISH_API_BASE_URL` 覆盖）由 reporter 共用
- **主面板（MainPanel）**: 所有设置 + 登录 + 排行榜 UI 的唯一归属（ADR 0005）。独立 BrowserWindow（440×620、autoHideMenuBar、不可缩放、非透明非置顶），与游乐场窗口完全解耦，窗口拖动与关闭由 OS 负责；main 里 `openMainPanel(tab)` 单例：不存在则带 `?tab=` 查询参数新建，已存在则聚焦并推 `panel-switch-tab` 切 tab，关闭即销毁置 null。页面是 electron-vite 多页第二入口 `src/renderer/panel.html` + `src/panel.ts`，`MainPanel.vue` 作 tab 壳（「⚙️ 设置」/「🏆 排行榜」），子组件 `SettingsTab.vue` / `LeaderboardTab.vue`；用同一 preload，window.api 直接可用；共享样式在 `src/renderer/src/styles/base.css`。设置 tab 全部即时生效（无草稿/保存流）：下班时间、下班提示、💩 拉屎、🖱 全局鼠标追踪、🚀 开机自启动（setLoginItemSettings 在 `set-auto-launch` IPC 处理器，仅生产生效）、📌 窗口置顶（不持久化、默认开启，走 `get/set-always-on-top`，看门狗跳过逻辑不变）。排行榜 tab 轮询：挂载即拉一次 + `leaderboard-poll` 5 分钟轮询，窗口销毁即 app 卸载、PetScheduler cancelAll 自动停
- **下班提示开关**: config `workEndReminderEnabled`（默认 true）只关气泡报时文案——心情/汗泪特效仍随下班时间变化；关闭时气泡不再常驻，只在互动消息/睡眠/喝水提醒时出现。设置入口在主面板设置 tab（即时生效），同步走 config-changed 广播
- **点击穿透**: 游乐场窗口是纯互动层（鱼/屎/气泡），无任何面板 UI——默认全屏穿透，纯 `elementFromPoint` 命中检测驱动；`INTERACTIVE_SELECTOR` = `.fish-wrap, .bubble-wrap, .poop`；仅拖鱼期间强制不穿透以免丢 mouseup。**Linux 特例**：`setIgnoreMouseEvents` 的 `forward` 仅支持 darwin/win32，Linux 穿透时窗口收不到 mousemove，命中检测由全局鼠标钩子位置驱动（屏幕坐标减窗口原点）；因此 Linux 下「全局鼠标追踪」关闭时鱼/屎不可点，Wayland（钩子不可用）下不可点属已知限制
- **铲屎事件上报（reporter）**: `src/main/reporter.ts`，铲屎 → `POST {FISH_API_BASE_URL}/events`（Bearer + UUID eventId 幂等键）；事件流、失败即丢弃（ADR 0003）：未登录/网络错误/4xx/5xx 一律静默，不排队不重试；`FISH_API_BASE_URL` 常量 + env 覆盖，风格同 auth.ts
- **Poop（拉屎）**: 纯逻辑在 `src/renderer/src/lib/poop.ts`，`Poop` 类型定义在 `src/shared/config.ts`（三进程共用）；屎列表持久化在 config `poops` 字段，开关 `poopEnabled`（默认 true，主面板设置 tab 切换）。屎元素是 `.playground` 的平级子元素（坐标即视口坐标），`.poop` 已加入 `INTERACTIVE_SELECTOR` 命中检测
- **Auto-launch**: Only applies in production builds; silently skipped in dev mode (`is.dev`)
- **Window**: 全屏游乐场窗口 —— frameless, transparent, always-on-top, non-resizable, `focusable: false`，覆盖整个主屏并固定于 (0,0)；默认 `setIgnoreMouseEvents(true, {forward: true})` 全屏穿透，renderer 经 `elementFromPoint` 命中检测 + `set-click-through` IPC 在光标位于鱼/UI 上时临时关闭穿透。鱼是窗口内的定位元素。置顶由 `src/main/alwaysOnTop.ts` 看门狗周期性重新声明（Windows 置顶层级会被其他置顶窗口抢占）；用户在主面板关闭置顶（isAlwaysOnTop 为 false）时看门狗自动跳过。第二窗口：主面板（见主面板条目），普通 OS 窗口，不参与穿透/置顶机制
- **Global mouse tracking**: `src/main/globalMouse.ts`（uiohook-napi，mousemove 30Hz 节流推送，点击不节流）；config `globalMouseTracking` 开关（默认 true），主面板设置 tab 可切换；Linux Wayland 下静默降级为窗口内追踪。electron-builder 需保持 `npmRebuild: false` + `asarUnpack` uiohook-napi
- **托盘菜单**: 固定三项——「⚙️ 设置」/「🏆 排行榜」deep-link 主面板对应 tab、「❌ 退出」（ADR 0005）；纯静态、构建后不再重建；右键菜单与「显示/隐藏」已删除

## CI / Release

- CI triggers on git tags: 客户端 `v*`（如 `git tag v1.3.0 && git push --tags`），后端 `server-v*`（如 `git tag server-v1.0.0`）；两个 release job 经 `if: startsWith(github.ref, ...)` 互斥
- Builds on Windows and Ubuntu; publishes to GitHub Releases automatically
- Node.js version: 22
- test.yml 两个并列 job：vitest（Node 22）+ server pytest（astral-sh/setup-uv，`cd server && uv run pytest`）
- release.yml 两个 job：`release`（客户端打包，仅 v* tag）+ `server-image`（仅 server-v* tag；docker/build-push-action 构建 `server/Dockerfile` 推 `ghcr.io/<repo-owner>/fish-server`，tag 为去掉 `server-` 前缀的版本号 + `latest`；构建前校验 tag 版本与 `server/pyproject.toml` 的 version 一致，不一致即 fail）
- server 版本号唯一来源：`server/pyproject.toml` 的 `version` 字段；`GET /health` 返回 `{"status":"ok","version":"..."}`（tomllib 读 pyproject.toml，Docker 镜像里同样拷到项目根）
- 客户端构建期注入（ADR 0004）：四个值存 GitHub repo **variables**（非 secrets）——`POCKET_ID_ISSUER`、`FISH_OIDC_CLIENT_ID`、`FISH_API_RESOURCE`、`FISH_API_BASE_URL`；release job 经 `env:` 传入，electron.vite.config.ts 的 main `define` 在构建期烧进 bundle（未设置则 `??` 落回 auth.ts/apiClient.ts 硬编码默认值；dev 模式由本地环境变量覆盖）
- server 镜像运行：必填 env `FISH_POCKETID_ISSUER` / `FISH_API_RESOURCE`（其余见 server/.env.example）；SQLite 落 `/app/data/fish.db`，挂卷持久化。部署示例见 `server/docker-compose.yml`（compose + .env + 挂卷，反代 HTTPS 到 8000 端口）

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
