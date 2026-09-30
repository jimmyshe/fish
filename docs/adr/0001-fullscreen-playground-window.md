# 全屏游乐场窗口 + uiohook-napi 全局鼠标钩子

Status: accepted

为了让鱼能"一直看着鼠标"（无论鼠标在屏幕何处）并为将来"鱼满屏自主游动"和"全局点击交互"铺路，我们将窗口模型从 320×200 固定小窗改为覆盖整个主屏的透明置顶「游乐场窗口」，鱼变为窗口内的定位元素；同时引入 `uiohook-napi` 在主进程监听全局鼠标事件（30Hz 节流后经 IPC 推给渲染层），作为可开关功能（默认开启，关闭时完全停止钩子）。窗口默认 `setIgnoreMouseEvents(true, {forward: true})` 全屏穿透，渲染层通过 `elementFromPoint` 命中检测在光标位于鱼或 UI 上时临时关闭穿透。

## Considered Options

- **主进程轮询 `screen.getCursorScreenPoint()`**：零新依赖，但拿不到全局点击，而点击是明确的后续需求，放弃。
- **保留小窗 + 仅钩子**：钩子本身就能提供全部鼠标数据，小窗方案更简单；但全屏窗口的目的不是拿数据，而是给鱼当游动画布，故仍选全屏窗口。
- **钩子坐标命中（窗口永远穿透）**：无切换竞态，但设置弹窗、喝水按钮等 DOM 交互全部失效需重做，放弃，改用动态切换穿透。

## Consequences

- 杀软误报风险：全局钩子是键盘记录器特征，未签名应用高发（uiohook-napi issue #58），已接受。
- Linux 支持 Windows + Linux X11；Wayland 会话下静默降级为窗口内追踪（Wayland 协议层面禁止全局光标查询，无正规方案）。
- 提权窗口（如任务管理器）获得焦点时钩子收不到事件，属 Windows 固有限制。
- electron-builder 需设 `npmRebuild: false` 以直接复用包内 N-API prebuild；依赖必须声明在 `dependencies`。
- 拖拽语义变化：拖鱼 = 移动窗口内鱼元素（CSS 位置），不再移动 OS 窗口；`windowX/windowY` 配置语义变为鱼在屏幕内的位置。
- Windows 上 Electron 不会自动穿透透明像素，穿透必须显式切换；动态切换存在小竞态（极快点击可能穿透）。
