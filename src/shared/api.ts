import type { Config } from './config'

/** 屏幕坐标点（游乐场窗口覆盖主屏且位于 (0,0)，client 坐标即屏幕坐标） */
export interface ScreenPoint {
  x: number
  y: number
}

/** window.api 契约：唯一类型来源，preload 实现、renderer 消费 */
export interface Api {
  getWorkEndTime: () => Promise<string>
  setWorkEndTime: (time: string) => Promise<Config>
  /** 读取鱼元素在屏幕内的持久化位置（负值表示未设置） */
  getFishPosition: () => Promise<ScreenPoint>
  /** 持久化鱼元素位置（拖拽 / 漂移结束时调用） */
  setFishPosition: (x: number, y: number) => void
  /** 动态切换点击穿透：true = 全屏穿透（转发 mousemove），false = 恢复交互 */
  setClickThrough: (ignore: boolean) => void
  /** 开关全局鼠标追踪（主进程即时 start/stop 钩子） */
  setGlobalMouseTracking: (enabled: boolean) => void
  showContextMenu: () => void
  quit: () => void
  onOpenSettings: (callback: () => void) => () => void
  /** 订阅全局鼠标移动（主进程 30Hz 节流推送），返回取消订阅函数 */
  onGlobalMouseMove: (callback: (pos: ScreenPoint) => void) => () => void
  /** 订阅全局鼠标点击（不节流），返回取消订阅函数 */
  onGlobalMouseClick: (callback: (pos: ScreenPoint) => void) => () => void
}
