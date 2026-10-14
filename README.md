# Fish Pet 🐟 `v1.9.1`

一个基于 Electron + Vite + Vue 3 制作的趣味桌面摸鱼宠物。它会陪伴你度过忙碌的工作时光，实时显示下班倒计时，并在下班时刻准时提醒你"快跑"！

---

## ✨ 功能特性

### 🕒 核心功能
- **下班倒计时**：实时显示距离下班的时间，精准到分钟；不需要报时时可在主面板设置页关闭提示，关闭后气泡不再常驻（心情照常随时间变化）。
- **持久化配置**：自定义下班时间，重启应用后自动恢复设置（含鱼的位置记忆）。
- **喝水提醒**：每 45 分钟温馨提醒喝水，点击确认后重新计时。💧
- **开机自启动**：可选随系统登录自动启动。
- **系统托盘**：托盘菜单固定三项——「⚙️ 设置」「🏆 排行榜」（打开主面板对应页面）与「❌ 退出」，附带小鱼图标。
- **全局鼠标追踪**：基于 uiohook-napi 的全局鼠标钩子（30Hz 节流），驱动鱼眼跟随与避鼠行为；可在主面板设置页开关。支持 Windows 与 Linux X11，Wayland 下自动降级为窗口内追踪。
- **拉屎**：小鱼每 15~30 分钟随机拉一泡 💩（清醒时会停下使劲，睡着就梦游拉），受惊时也会被吓出屎；💩 会留在屏幕上直到你点击铲走，重启不消失；主面板设置页可开关。

### 🌐 联网玩法（可选）
- **PocketID 登录**：passkey 免密码登录（系统浏览器完成，token 加密存储）；不登录完全不影响单机玩法。
- **铲屎排行榜**：铲的每泡屎实时累计到云端，托盘菜单「🏆 排行榜」打开主面板查看总榜 Top 100 与自己的名次；可随时选择不上榜。

### 🐟 智能心情系统
小鱼会根据剩余工作时间变换状态：
- 🌊 **平静 (蓝色)**：剩余时间 > 2小时 —— "安心摸鱼，老板没看我。"
- 🌟 **开心 (黄色)**：剩余时间 < 2小时 —— "胜利在望，准备起飞！"
- 💦 **紧张 (粉色)**：剩余时间 < 30分钟 —— "流汗冲刺，马上解放！"
- 😭 **悲伤 (紫色)**：加班进行时 —— "别卷了，快跑吧！"

### 🖱️ 深度交互体验
- **自主漫游**：小鱼在全屏游乐场中连续游动，偶尔停下发呆；游动方向自动翻转朝向。
- **避鼠本能**：鼠标靠近时小鱼会悄悄游走；快速挥向它则会触发受惊逃窜。🐟💨
- **眼神随动**：小鱼的眼睛会实时追踪你的鼠标位置。
- **触碰反馈**：鼠标悬停触发加速游动与金色光效。
- **随机自言自语**：每隔一段时间冒出有趣的吐槽。
- **受惊模式**：鼠标快速冲到鱼身边会让它变红、剧烈抖动并逃开一段距离。
- **自动睡眠**：静置 3 分钟后，小鱼会进入 Zzz 睡眠状态。
- **连击彩蛋**：3 秒内点击 5 次，解锁全屏彩虹特效与皇冠装饰！👑

---

## 🛠️ 技术栈

- **框架**: [Electron 31](https://www.electronjs.org/) + [Vue 3](https://vuejs.org/)
- **构建工具**: [electron-vite](https://electron-vite.org/)
- **语言**: TypeScript
- **测试**: Vitest（102 个单元测试）+ pytest（后端 15 个）
- **打包**: electron-builder
- **后端**: FastAPI + SQLite（`server/`，PocketID OIDC 验签，独立版本演进）

---

## 📂 项目结构

```text
src/
├── main/          # Electron 主进程
│   ├── index.ts   # 游乐场窗口、托盘接线、IPC 注册
│   ├── config.ts  # configStore：配置唯一属主（去抖持久化）
│   ├── menu.ts    # 菜单模块：托盘菜单（设置 / 排行榜 / 退出）
│   ├── alwaysOnTop.ts # 置顶看门狗：周期性重新声明置顶，防被其他置顶窗口抢占
│   ├── auth.ts    # 登录模块：PocketID OIDC（PKCE + loopback 回调），safeStorage 加密存 token
│   ├── apiClient.ts # 联网 API 客户端：/me、/leaderboard、opt-out
│   ├── reporter.ts # 铲屎事件上报（幂等 UUID，失败即丢弃）
│   └── globalMouse.ts # 全局鼠标钩子模块（uiohook-napi，30Hz 节流）
├── preload/       # 预加载脚本 (安全的 API 桥接)
├── shared/        # 跨进程共享类型 (Config / window.api 契约)
└── renderer/      # Vue 渲染进程（多页：index 游乐场 + panel 主面板窗口）
    └── src/
        ├── App.vue
        ├── components/
        │   ├── DesktopPet.vue   # 宠物状态组合与模板
        │   ├── MainPanel.vue    # 主面板 tab 壳（设置 / 排行榜）
        │   ├── SettingsTab.vue  # 设置 tab（全部即时生效）
        │   └── LeaderboardTab.vue # 排行榜 tab（登录 + 联网数据）
        ├── styles/
        │   └── base.css         # 主面板共享样式（按钮、表单行、配色）
        ├── composables/
        │   ├── PetScheduler.ts  # 定时器调度模块（after/every/cancel）
        │   ├── usePetScheduler.ts
        │   └── useDrag.ts       # 拖拽模块（位移、点击判定）
        └── lib/
            ├── petTime.ts       # 时间推导模块（心情阈值与文案）
            ├── fishPosition.ts  # 鱼位置纯逻辑（初始落点、屏幕收敛）
            ├── fishMotion.ts    # 运动模块：漫游/避鼠/逃窜转向力（MOTION 参数）
            └── poop.ts          # 排泄模块：拉屎间隔、落点与序列化（POOP 参数）
server/            # 铲屎计数后端（FastAPI + SQLite，Docker 部署，独立 server-v* 版本）
```

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发环境
```bash
npm run dev
```

### 3. 运行测试
```bash
npm test
```

### 4. 构建与打包
```bash
# 构建并打包成安装包 (Windows .exe / Linux)
npm run dist
```

---

## 🎮 使用说明

1. **移动**：左键长按小鱼可拖拽至屏幕任意位置。
2. **设置**：点击托盘图标的「⚙️ 设置」，在主面板中调整下班时间、下班提示、拉屎、全局鼠标追踪、开机自启动与窗口置顶，全部即时生效。
3. **互动**：尝试点击、快速晃动鼠标或静置屏幕，探索更多动画细节。

## 📋 更新日志

各版本更新内容见 [GitHub Releases](https://github.com/jimmyshe/fish/releases)。

---

## 📄 开源协议

[GNU General Public License v3.0 or later](LICENSE)（GPL-3.0-or-later）

Copyright (C) 2026 jimmyshe
