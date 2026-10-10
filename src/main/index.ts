import { app, BrowserWindow, dialog, ipcMain, safeStorage, screen, shell, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { createMenuModule } from './menu'
import { createConfigStore, type ConfigStore } from './config'
import { createAuthModule, type AuthModule } from './auth'
import { createReporter, type Reporter } from './reporter'
import { createApiClient, type ApiClient } from './apiClient'
import { startGlobalMouseTracking, stopGlobalMouseTracking } from './globalMouse'
import { startAlwaysOnTopWatchdog } from './alwaysOnTop'
import type { Poop } from '../shared/config'
import trayIconUrl from './tray-icon.png?inline'

let configStore: ConfigStore
let auth: AuthModule
let reporter: Reporter
let apiClient: ApiClient
let mainWindow: BrowserWindow | null = null
let networkWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** 按配置开关即时 start/stop 全局鼠标钩子 */
function applyGlobalMouseTracking(enabled: boolean): void {
  if (enabled && mainWindow) {
    startGlobalMouseTracking(mainWindow)
  } else {
    stopGlobalMouseTracking()
  }
}

/** 联网窗口（排行榜）：独立普通小窗口，与游乐场窗口完全解耦；关闭即销毁，再开重建 */
function openNetworkWindow(): void {
  if (networkWindow) {
    networkWindow.focus()
    return
  }
  networkWindow = new BrowserWindow({
    width: 380,
    height: 560,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  networkWindow.on('closed', () => { networkWindow = null })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    networkWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/network.html`)
  } else {
    networkWindow.loadFile(join(__dirname, '../renderer/network.html'))
  }
}

// 菜单模块：tray / 右键菜单 / 自启动序列的唯一属主
const menu = createMenuModule({
  getTray: () => tray,
  getWindow: () => mainWindow,
  getConfig: () => configStore.get(),
  setConfig: (patch) => { configStore.set(patch) },
  applyGlobalMouseTracking,
  // 拉屎开关：推送给 renderer 即时启停定时排泄调度
  applyPoopEnabled: (enabled) => { mainWindow?.webContents.send('poop-enabled-changed', enabled) },
  // auth 在 app 就绪后创建，菜单点击只发生在那之后
  getAuthState: () => auth?.getState() ?? { signedIn: false },
  login: () => {
    // 打包版看不到 console，登录失败必须让用户可见
    void auth?.login().catch((err) => {
      console.warn('[auth] 登录失败', err)
      dialog.showErrorBox('登录失败', err instanceof Error ? err.message : String(err))
    })
  },
  logout: () => { void auth?.logout() },
  openNetworkPanel: openNetworkWindow
})

function createWindow(): void {
  // 游乐场窗口：覆盖整个主屏（含任务栏区域），固定于 (0,0)，只支持主屏
  const { width, height } = screen.getPrimaryDisplay().bounds

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (process.platform !== 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  // 默认全屏穿透（forward 让 renderer 仍收得到 mousemove）；
  // renderer 通过动态命中检测经 set-click-through 临时关闭穿透
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  // 托盘图标：生成的 32×32 小鱼（scripts/generate-tray-icon.mjs）
  const icon = nativeImage.createFromDataURL(trayIconUrl)
  tray = new Tray(icon)
  tray.setToolTip('摸鱼宠物 🐟')
  menu.updateTrayMenu()
}

// IPC handlers
ipcMain.on('set-click-through', (_event, ignore: boolean) => {
  if (!mainWindow) return
  mainWindow.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined)
})

ipcMain.handle('get-fish-position', () => {
  const { windowX, windowY } = configStore.get()
  return { x: windowX, y: windowY }
})

ipcMain.on('set-fish-position', (_event, x: number, y: number) => {
  configStore.set({ windowX: Math.round(x), windowY: Math.round(y) })
})

ipcMain.on('set-global-mouse-tracking', (_event, enabled: boolean) => {
  configStore.set({ globalMouseTracking: enabled })
  applyGlobalMouseTracking(enabled)
  menu.updateTrayMenu()
})

ipcMain.handle('get-poop-enabled', () => {
  return configStore.get().poopEnabled
})

ipcMain.on('set-poop-enabled', (_event, enabled: boolean) => {
  // renderer 发起的切换：renderer 本地已应用，这里只落盘并刷新托盘勾选
  configStore.set({ poopEnabled: enabled })
  menu.updateTrayMenu()
})

ipcMain.handle('get-poops', () => {
  return configStore.get().poops
})

ipcMain.on('set-poops', (_event, poops: Poop[]) => {
  configStore.set({ poops })
})

ipcMain.handle('get-work-end-time', () => {
  return configStore.get().workEndTime
})

ipcMain.handle('set-work-end-time', (_event, time: string) => {
  const updated = configStore.set({ workEndTime: time })
  menu.updateTrayMenu()
  return updated
})

// 下班提示开关：入口只在 renderer 设置弹窗，invoke 型，无托盘项、无主→渲染推送
ipcMain.handle('get-work-end-reminder-enabled', () => {
  return configStore.get().workEndReminderEnabled
})

ipcMain.handle('set-work-end-reminder-enabled', (_event, enabled: boolean) => {
  return configStore.set({ workEndReminderEnabled: enabled })
})

ipcMain.on('show-context-menu', () => {
  menu.popupContextMenu()
})

ipcMain.on('quit', () => app.quit())

// 登录链路：auth 模块为登录态唯一属主；失败经 Promise reject 传回 renderer
ipcMain.handle('auth-login', () => auth.login())
ipcMain.handle('auth-logout', () => auth.logout())
ipcMain.handle('get-auth-state', () => auth.getState())

// 铲屎事件上报：失败即丢弃（ADR 0003），reporter 内部不抛错
ipcMain.on('report-scoop', () => { void reporter.reportScoop() })

// 联网 API：未登录/失败一律返回 null（renderer 给占位态）
ipcMain.handle('get-me', () => apiClient.getMe())
ipcMain.handle('get-leaderboard', () => apiClient.getLeaderboard())
ipcMain.handle('set-show-on-leaderboard', (_event, show: boolean) => apiClient.setShowOnLeaderboard(show))

app.whenReady().then(async () => {
  // 配置模块在 app 就绪后创建（userData 路径此时才可用）
  configStore = createConfigStore({ configPath: join(app.getPath('userData'), 'config.json') })
  app.on('will-quit', () => configStore.flush())

  // auth 模块：token 经 safeStorage 加密存 userData/auth.json（独立于明文 config.json）；
  // 状态变更推送给 renderer 并刷新托盘菜单（「登录/退出登录」项切换）
  auth = createAuthModule({
    authPath: join(app.getPath('userData'), 'auth.json'),
    safeStorage,
    opener: (url) => { void shell.openExternal(url) }
  })
  auth.onStateChanged((authState) => {
    // 广播给所有窗口（游乐场 + 联网窗口），各自订阅刷新
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('auth-state-changed', authState)
    }
    menu.updateTrayMenu()
  })

  // 铲屎事件上报：token 由 auth 模块供给（过期自动续期），失败即丢弃
  reporter = createReporter({ getAccessToken: () => auth.getAccessToken() })
  // 联网 API（/me、/leaderboard、/me/preferences）：同一个 token 来源
  apiClient = createApiClient({ getAccessToken: () => auth.getAccessToken() })

  // 同步开机自启动状态（防止手动改过注册表后不一致）
  menu.setAutoLaunch(configStore.get().autoLaunch)

  createWindow()
  createTray()

  // 启动恢复持久化登录态：有 session 则 refresh 续期，失败静默退回未登录
  await auth.load()

  // 置顶看门狗：周期性把窗口抬回置顶层级顶部（Windows 置顶层级会被其他置顶窗口抢占）
  startAlwaysOnTopWatchdog(() => mainWindow)

  // 按配置启动全局鼠标追踪（默认开启；Wayland 下静默降级）
  applyGlobalMouseTracking(configStore.get().globalMouseTracking)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
