import type { BrowserWindow } from 'electron'
import { isFeedShortcutInput } from './feedShortcut'

/** 全局鼠标移动推送的节流间隔（约 30Hz） */
export const MOUSE_MOVE_INTERVAL_MS = 33

/**
 * mousemove 节流器：窗口期内只保留最新坐标，每 intervalMs 至多发送一次。
 * 纯逻辑抽出以便单测；定时器句柄不离开本模块。
 */
export function createMouseMoveThrottle(
  intervalMs: number,
  send: (x: number, y: number) => void
): (x: number, y: number) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: { x: number; y: number } | null = null
  return (x: number, y: number) => {
    latest = { x, y }
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      if (latest) {
        send(latest.x, latest.y)
        latest = null
      }
    }, intervalMs)
  }
}

/**
 * 全局鼠标追踪是否可用：Linux Wayland 会话下协议层面禁止全局钩子，
 * 静默降级为窗口内追踪（不启动钩子，也不报错）。
 */
export function isGlobalMouseTrackingSupported(): boolean {
  return !(process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland')
}

type UiohookModule = typeof import('uiohook-napi')
type UiohookMouseEvent = import('uiohook-napi').UiohookMouseEvent
type UiohookKeyboardEvent = import('uiohook-napi').UiohookKeyboardEvent

// undefined = 尚未尝试加载；null = 加载失败（原生模块缺失等）
let hook: UiohookModule | null | undefined

/** 延迟加载原生模块：加载失败只告警，不影响应用启动 */
function loadHook(): UiohookModule | null {
  if (hook !== undefined) return hook
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hook = require('uiohook-napi') as UiohookModule
  } catch (error) {
    console.warn('[globalMouse] uiohook-napi 加载失败，全局鼠标追踪不可用', error)
    hook = null
  }
  return hook
}

let tracking = false
let targetWindow: BrowserWindow | null = null
let throttledMove: ((x: number, y: number) => void) | null = null
let getFeedShortcut: (() => string | null) | null = null

function onMouseMove(e: UiohookMouseEvent): void {
  throttledMove?.(e.x, e.y)
}

/** 点击类事件不节流，直接推给 renderer */
function onMouseButton(e: UiohookMouseEvent): void {
  targetWindow?.webContents.send('global-mouse-click', { x: e.x, y: e.y })
}

/** 键盘敲击脉冲：彻底丢弃具体键码，仅推送无参敲击活动信号 */
function onKeyDown(event: UiohookKeyboardEvent): void {
  const shortcut = getFeedShortcut?.()
  if (shortcut && hook && isFeedShortcutInput(event, shortcut, hook.UiohookKey)) return
  targetWindow?.webContents.send('global-key-down')
}

/**
 * 启动全局输入追踪：mousemove 节流至约 30Hz 后经 IPC 推送，
 * mousedown 与无键码 keydown 脉冲不节流直接推送。
 * 重复调用只换目标窗口；平台不支持或钩子失败时静默/告警降级。
 */
export function startGlobalMouseTracking(win: BrowserWindow, feedShortcut: () => string | null): void {
  if (tracking) {
    targetWindow = win
    getFeedShortcut = feedShortcut
    return
  }
  if (!isGlobalMouseTrackingSupported()) return
  const uio = loadHook()?.uIOhook
  if (!uio) return
  try {
    targetWindow = win
    getFeedShortcut = feedShortcut
    throttledMove = createMouseMoveThrottle(MOUSE_MOVE_INTERVAL_MS, (x, y) => {
      targetWindow?.webContents.send('global-mouse-move', { x, y })
    })
    uio.on('mousemove', onMouseMove)
    uio.on('mousedown', onMouseButton)
    uio.on('keydown', onKeyDown)
    uio.start()
    tracking = true
  } catch (error) {
    console.warn('[globalMouse] 全局鼠标钩子启动失败，已降级为窗口内追踪', error)
    stopGlobalMouseTracking()
  }
}

/** 完全停止全局钩子（配置开关关闭时调用） */
export function stopGlobalMouseTracking(): void {
  const uio = hook?.uIOhook
  if (uio) {
    try {
      uio.removeListener('mousemove', onMouseMove)
      uio.removeListener('mousedown', onMouseButton)
      uio.removeListener('mouseup', onMouseButton)
      uio.removeListener('click', onMouseButton)
      uio.removeListener('keydown', onKeyDown)
      if (tracking) uio.stop()
    } catch (error) {
      console.warn('[globalMouse] 停止全局鼠标钩子失败', error)
    }
  }
  tracking = false
  targetWindow = null
  getFeedShortcut = null
  throttledMove = null
}
