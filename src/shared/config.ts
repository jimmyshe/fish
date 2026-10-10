/** 一泡屎：屏幕坐标（游乐场窗口覆盖主屏且位于 (0,0)，坐标即视口坐标） */
export interface Poop {
  id: string
  x: number
  y: number
}

/** 应用配置：唯一类型来源，main / preload / renderer 共用 */
export interface Config {
  workEndTime: string
  /** 下班提示开关；关闭时气泡不报时（心情/特效仍随下班时间变化），气泡只在互动/睡眠/喝水提醒时出现 */
  workEndReminderEnabled: boolean
  /** 鱼元素在屏幕内的位置（游乐场窗口内坐标），负值表示未设置 */
  windowX: number
  windowY: number
  autoLaunch: boolean
  /** 全局鼠标追踪开关；关闭时原生钩子完全停止 */
  globalMouseTracking: boolean
  /** 拉屎开关；关闭时停止定时排泄调度，已拉出的屎保留可铲 */
  poopEnabled: boolean
  /** 已拉出的屎列表：无上限、不自动消失，重启后原位恢复 */
  poops: Poop[]
}

export const DEFAULT_CONFIG: Config = {
  workEndTime: '18:00',
  workEndReminderEnabled: true,
  windowX: -1,
  windowY: -1,
  autoLaunch: false,
  globalMouseTracking: true,
  poopEnabled: true,
  poops: []
}
