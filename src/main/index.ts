import { app, BrowserWindow, ipcMain, safeStorage, screen, shell, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { createMenuModule } from './menu'
import { createConfigStore, type ConfigStore } from './config'
import { createAuthModule, type AuthModule } from './auth'
import { createReporter, type Reporter } from './reporter'
import { createApiClient, type ApiClient } from './apiClient'
import { startGlobalMouseTracking, stopGlobalMouseTracking } from './globalMouse'
import { startAlwaysOnTopWatchdog } from './alwaysOnTop'
import type { Config, Poop } from '../shared/config'
import type { MainPanelTab } from '../shared/api'
import trayIconUrl from './tray-icon.png?inline'

let configStore: ConfigStore
let auth: AuthModule
let reporter: Reporter
let apiClient: ApiClient
let mainWindow: BrowserWindow | null = null
let mainPanelWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** 按配置开关即时 start/stop 全局鼠标钩子 */
function applyGlobalMouseTracking(enabled: boolean): void {
  if (enabled && mainWindow) {
    startGlobalMouseTracking(mainWindow)
  } else {
    stopGlobalMouseTracking()
  }
}

/** 开机自启动：开发模式下路径不对，仅生产包生效 */
function applyAutoLaunch(enabled: boolean): void {
  if (is.dev) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: '摸鱼宠物'
  })
}

/** 游乐场窗口置顶：看门狗周期性重新声明，用户关闭时自动跳过（见 alwaysOnTop.ts） */
function applyAlwaysOnTop(enabled: boolean): void {
  if (!mainWindow) return
  mainWindow.setAlwaysOnTop(enabled)
  if (enabled && process.platform !== 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
  }
}

/** 主面板：设置 + 排行榜的唯一 UI 入口；单例，关闭即销毁，再开重建。
 *  已存在时聚焦并推送 panel-switch-tab 切 tab，否则带 ?tab= 查询参数新建。 */
function openMainPanel(tab: MainPanelTab): void {
  if (mainPanelWindow) {
    mainPanelWindow.focus()
    mainPanelWindow.webContents.send('panel-switch-tab', tab)
    return
  }
  mainPanelWindow = new BrowserWindow({
    width: 440,
    height: 620,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainPanelWindow.on('closed', () => { mainPanelWindow = null })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainPanelWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/panel.html?tab=${tab}`)
  } else {
    mainPanelWindow.loadFile(join(__dirname, '../renderer/panel.html'), { query: { tab } })
  }
}

// 菜单模块：托盘菜单的唯一属主（固定三项：设置 / 排行榜 / 退出）
const menu = createMenuModule({
  getTray: () => tray,
  openMainPanel
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

// 配置：读走 get-config；所有写经 configStore.set 合并，同步回执走 config-changed 广播
ipcMain.handle('get-config', () => configStore.get())

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
})

ipcMain.on('set-poop-enabled', (_event, enabled: boolean) => {
  configStore.set({ poopEnabled: enabled })
})

ipcMain.on('set-auto-launch', (_event, enabled: boolean) => {
  configStore.set({ autoLaunch: enabled })
  applyAutoLaunch(enabled)
})

ipcMain.handle('get-always-on-top', () => {
  return mainWindow?.isAlwaysOnTop() ?? true
})

ipcMain.on('set-always-on-top', (_event, enabled: boolean) => {
  applyAlwaysOnTop(enabled)
})

ipcMain.handle('get-poops', () => {
  return configStore.get().poops
})

ipcMain.on('set-poops', (_event, poops: Poop[]) => {
  configStore.set({ poops })
})

ipcMain.handle('set-work-end-time', (_event, time: string) => {
  configStore.set({ workEndTime: time })
})

ipcMain.handle('set-work-end-reminder-enabled', (_event, enabled: boolean) => {
  configStore.set({ workEndReminderEnabled: enabled })
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
  // 配置模块在 app 就绪后创建（userData 路径此时才可用）；
  // onChanged：配置同步的唯一缝隙，set 即广播完整 Config 给所有窗口
  configStore = createConfigStore({
    configPath: join(app.getPath('userData'), 'config.json'),
    onChanged: (config: Config) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('config-changed', config)
      }
    }
  })
  app.on('will-quit', () => configStore.flush())

  // auth 模块：token 经 safeStorage 加密存 userData/auth.json（独立于明文 config.json）
  auth = createAuthModule({
    authPath: join(app.getPath('userData'), 'auth.json'),
    safeStorage,
    opener: (url) => { void shell.openExternal(url) }
  })
  auth.onStateChanged((authState) => {
    // 广播给所有窗口（游乐场 + 主面板），各自订阅刷新
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('auth-state-changed', authState)
    }
  })

  // 铲屎事件上报：token 由 auth 模块供给（过期自动续期），失败即丢弃
  reporter = createReporter({ getAccessToken: () => auth.getAccessToken() })
  // 联网 API（/me、/leaderboard、/me/preferences）：同一个 token 来源
  apiClient = createApiClient({ getAccessToken: () => auth.getAccessToken() })

  // 同步开机自启动状态（防止手动改过注册表后不一致）
  applyAutoLaunch(configStore.get().autoLaunch)

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
