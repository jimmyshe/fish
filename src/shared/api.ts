import type { Config } from './config'

/** window.api 契约：唯一类型来源，preload 实现、renderer 消费 */
export interface Api {
  moveWindow: (deltaX: number, deltaY: number) => void
  getWorkEndTime: () => Promise<string>
  setWorkEndTime: (time: string) => Promise<Config>
  showContextMenu: () => void
  quit: () => void
  onOpenSettings: (callback: () => void) => () => void
}
