import { app, BrowserWindow, ipcMain, screen, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { createMenuModule } from './menu'
import { createConfigStore, type ConfigStore } from './config'

let configStore: ConfigStore
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 菜单模块：tray / 右键菜单 / 自启动序列的唯一属主
const menu = createMenuModule({
  getTray: () => tray,
  getWindow: () => mainWindow,
  getConfig: () => configStore.get(),
  setConfig: (patch) => { configStore.set(patch) }
})

function getInitialPosition(): { x: number; y: number } {
  const { windowX, windowY } = configStore.get()
  if (windowX >= 0 && windowY >= 0) {
    return { x: windowX, y: windowY }
  }
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  return { x: width - 340, y: height - 220 }
}

function createWindow(): void {
  const { x, y } = getInitialPosition()

  mainWindow = new BrowserWindow({
    width: 320,
    height: 200,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (process.platform !== 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('moved', () => {
    if (!mainWindow) return
    const [wx, wy] = mainWindow.getPosition()
    configStore.set({ windowX: wx, windowY: wy })
  })
}

function createTray(): void {
  // 1x1 透明图标占位，实际用 emoji 作为 tooltip
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('摸鱼宠物 🐟')
  menu.updateTrayMenu()
}

// IPC handlers
ipcMain.on('move-window', (_event, deltaX: number, deltaY: number) => {
  if (!mainWindow) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + deltaX, y + deltaY)
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
