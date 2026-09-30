/** 应用配置：唯一类型来源，main / preload / renderer 共用 */
export interface Config {
  workEndTime: string
  /** 鱼元素在屏幕内的位置（游乐场窗口内坐标），负值表示未设置 */
  windowX: number
  windowY: number
  autoLaunch: boolean
  /** 全局鼠标追踪开关；关闭时原生钩子完全停止 */
  globalMouseTracking: boolean
}

export const DEFAULT_CONFIG: Config = {
  workEndTime: '18:00',
  windowX: -1,
  windowY: -1,
  autoLaunch: false,
  globalMouseTracking: true
}
