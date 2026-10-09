import type { BrowserWindow } from 'electron'

/**
 * 置顶看门狗。
 * Windows 的置顶（HWND_TOPMOST）是共享层级：其他置顶窗口（任务管理器置顶模式、
 * 悬浮工具等）随时可能压到鱼的上面，hide/show、锁屏恢复也会重排层级，而系统
 * 不会自动把鱼抬回来——表现为"随机失去置顶"。看门狗周期性重新声明置顶并把
 * 窗口抬到置顶层级顶部；用户在右键菜单关闭置顶时 isAlwaysOnTop() 为 false，
 * 看门狗自动跳过，不与用户对抗。
 */
export function startAlwaysOnTopWatchdog(
  getWindow: () => BrowserWindow | null,
  intervalMs = 3000
): () => void {
  const level = process.platform === 'darwin' ? undefined : 'screen-saver'
  const timer = setInterval(() => {
    const win = getWindow()
    if (!win || win.isDestroyed() || !win.isAlwaysOnTop()) return
    win.setAlwaysOnTop(true, level)
    win.moveTop()
  }, intervalMs)
  return () => clearInterval(timer)
}
