/** 应用配置：唯一类型来源，main / preload / renderer 共用 */
export interface Config {
  workEndTime: string
  windowX: number
  windowY: number
  autoLaunch: boolean
}

export const DEFAULT_CONFIG: Config = {
  workEndTime: '18:00',
  windowX: -1,
  windowY: -1,
  autoLaunch: false
}
