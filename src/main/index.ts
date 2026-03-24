import { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

interface Config {
  workEndTime: string
  windowX: number
  windowY: number
}

// 简易持久化存储
function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'config.json')
}

function loadConfig(): Config {
  const path = getConfigPath()
  if (!existsSync(path)) {
    return { workEndTime: '18:00', windowX: -1, windowY: -1 }
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Config
  } catch {
    return { workEndTime: '18:00', windowX: -1, windowY: -1 }
  }
}

function saveConfig(config: Config): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

let config = loadConfig()
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function getInitialPosition(): { x: number; y: number } {
  if (config.windowX >= 0 && config.windowY >= 0) {
    return { x: config.windowX, y: config.windowY }
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
    config.windowX = wx
    config.windowY = wy
    saveConfig(config)
  })
}

function createTray(): void {
  // 1x1 透明图标占位，实际用 emoji 作为 tooltip
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('摸鱼宠物 🐟')
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (!tray) return
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `🕐 下班时间: ${config.workEndTime}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '⏰ 设置下班时间',
      click: () => mainWindow?.webContents.send('open-settings')
    },
    {
      label: '👁 显示/隐藏',
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow?.show()
        }
      }
    },
    { type: 'separator' },
    {
      label: '❌ 退出',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(contextMenu)
}

// IPC handlers
ipcMain.on('move-window', (_event, deltaX: number, deltaY: number) => {
  if (!mainWindow) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + deltaX, y + deltaY)
})

ipcMain.handle('get-work-end-time', () => {
  return config.workEndTime
})

ipcMain.handle('set-work-end-time', (_event, time: string) => {
  config.workEndTime = time
  saveConfig(config)
  updateTrayMenu()
  return true
})

ipcMain.on('show-context-menu', () => {
  if (!mainWindow) return
  const menu = Menu.buildFromTemplate([
    {
      label: `🕐 下班时间: ${config.workEndTime}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '⏰ 设置下班时间',
      click: () => mainWindow?.webContents.send('open-settings')
    },
    {
      label: '📌 置顶',
      type: 'checkbox',
      checked: mainWindow?.isAlwaysOnTop() ?? true,
      click: (item) => {
        mainWindow?.setAlwaysOnTop(item.checked)
        if (item.checked && process.platform !== 'darwin') {
          mainWindow?.setAlwaysOnTop(true, 'screen-saver')
        }
      }
    },
    { type: 'separator' },
    {
      label: '❌ 退出',
      click: () => app.quit()
    }
  ])
  menu.popup({ window: mainWindow! })
})

ipcMain.on('quit', () => app.quit())

app.whenReady().then(() => {
  // 重新读取 config（等 app 就绪后 userData 路径才可用）
  config = loadConfig()

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
