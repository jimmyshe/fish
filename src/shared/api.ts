import type { Config, Poop } from './config'

/** 屏幕坐标点（游乐场窗口覆盖主屏且位于 (0,0)，client 坐标即屏幕坐标） */
export interface ScreenPoint {
  x: number
  y: number
}

/** 登录状态：主进程 auth 模块为唯一属主，renderer 经 IPC 拉取/订阅 */
export interface AuthState {
  signedIn: boolean
  username?: string
}

/** GET /me 响应：我的铲屎计数、总榜名次（null = 未上榜）与上榜开关 */
export interface MeResponse {
  count: number
  rank: number | null
  showOnLeaderboard: boolean
}

/** 排行榜条目（总榜 Top 100） */
export interface LeaderboardEntry {
  rank: number
  username: string
  count: number
}

/** GET /leaderboard 响应：榜单 + 本人名次（opt-out 时本人不在 entries 里） */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  me: { rank: number | null; count: number }
}

/** window.api 契约：唯一类型来源，preload 实现、renderer 消费 */
export interface Api {
  getWorkEndTime: () => Promise<string>
  setWorkEndTime: (time: string) => Promise<Config>
  /** 读取下班提示开关 */
  getWorkEndReminderEnabled: () => Promise<boolean>
  /** 开关下班提示（返回更新后的完整配置，以主进程为准） */
  setWorkEndReminderEnabled: (enabled: boolean) => Promise<Config>
  /** 读取鱼元素在屏幕内的持久化位置（负值表示未设置） */
  getFishPosition: () => Promise<ScreenPoint>
  /** 持久化鱼元素位置（拖拽 / 漂移结束时调用） */
  setFishPosition: (x: number, y: number) => void
  /** 动态切换点击穿透：true = 全屏穿透（转发 mousemove），false = 恢复交互 */
  setClickThrough: (ignore: boolean) => void
  /** 开关全局鼠标追踪（主进程即时 start/stop 钩子） */
  setGlobalMouseTracking: (enabled: boolean) => void
  /** 读取拉屎开关 */
  getPoopEnabled: () => Promise<boolean>
  /** 开关拉屎（renderer 侧调用；托盘菜单切换则经 onPoopEnabledChanged 推送回来） */
  setPoopEnabled: (enabled: boolean) => void
  /** 订阅拉屎开关变化（主→渲染推送），返回取消订阅函数 */
  onPoopEnabledChanged: (callback: (enabled: boolean) => void) => () => void
  /** 读取已拉出的屎列表（重启恢复用） */
  getPoops: () => Promise<Poop[]>
  /** 持久化屎列表（每次增删即调用） */
  setPoops: (poops: Poop[]) => void
  showContextMenu: () => void
  quit: () => void
  onOpenSettings: (callback: () => void) => () => void
  /** 发起 PocketID 登录（系统浏览器 + loopback 回调），失败 reject */
  login: () => Promise<void>
  /** 退出登录：纯本地清除，不调 PocketID end-session */
  logout: () => Promise<void>
  /** 读取当前登录状态 */
  getAuthState: () => Promise<AuthState>
  /** 订阅登录状态变化（主→渲染推送），返回取消订阅函数 */
  onAuthStateChanged: (callback: (state: AuthState) => void) => () => void
  /** 上报一次铲屎事件（fire-and-forget；是否登录、失败丢弃由主进程判断） */
  reportScoop: () => void
  /** 读取我的计数/名次/上榜开关；未登录或失败返回 null（UI 给占位态） */
  getMe: () => Promise<MeResponse | null>
  /** 读取排行榜（总榜 Top 100 + 本人名次）；未登录或失败返回 null */
  getLeaderboard: () => Promise<LeaderboardResponse | null>
  /** 设置上榜开关（opt-out 存服务器）；失败静默，调用方重新 getMe 取权威值 */
  setShowOnLeaderboard: (show: boolean) => Promise<void>
  /** 订阅全局鼠标移动（主进程 30Hz 节流推送），返回取消订阅函数 */
  onGlobalMouseMove: (callback: (pos: ScreenPoint) => void) => () => void
  /** 订阅全局鼠标点击（不节流），返回取消订阅函数 */
  onGlobalMouseClick: (callback: (pos: ScreenPoint) => void) => () => void
}
