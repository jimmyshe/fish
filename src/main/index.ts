import { app, BrowserWindow, ipcMain, screen, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { createMenuModule } from './menu'
import { createConfigStore, type ConfigStore } from './config'
import { startGlobalMouseTracking, stopGlobalMouseTracking } from './globalMouse'

let configStore: ConfigStore
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** 按配置开关即时 start/stop 全局鼠标钩子 */
function applyGlobalMouseTracking(enabled: boolean): void {
  if (enabled && mainWindow) {
    startGlobalMouseTracking(mainWindow)
  } else {
    stopGlobalMouseTracking()
  }
}

// 菜单模块：tray / 右键菜单 / 自启动序列的唯一属主
const menu = createMenuModule({
  getTray: () => tray,
  getWindow: () => mainWindow,
  getConfig: () => configStore.get(),
  setConfig: (patch) => { configStore.set(patch) },
  applyGlobalMouseTracking
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
  // 1x1 透明图标占位，实际用 emoji 作为 tooltip
  const icon = nativeImage.createEmpty()
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

ipcMain.handle('get-work-end-time', () => {
  return configStore.get().workEndTime
})

ipcMain.handle('set-work-end-time', (_event, time: string) => {
  const updated = configStore.set({ workEndTime: time })
  menu.updateTrayMenu()
  return updated
})

ipcMain.on('show-context-menu', () => {
  menu.popupContextMenu()
})

ipcMain.on('quit', () => app.quit())

app.whenReady().then(() => {
  // 配置模块在 app 就绪后创建（userData 路径此时才可用）
  configStore = createConfigStore({ configPath: join(app.getPath('userData'), 'config.json') })
  app.on('will-quit', () => configStore.flush())

  // 同步开机自启动状态（防止手动改过注册表后不一致）
  menu.setAutoLaunch(configStore.get().autoLaunch)

  createWindow()
  createTray()

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
