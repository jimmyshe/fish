import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Poop } from '../shared/config'

const {
  mockPoopStore,
  mockConfigStoreInstance,
  ipcHandles,
  ipcListeners,
  appEvents,
  getWhenReadyCallback,
  electronMock
} = vi.hoisted(() => {
  const ipcHandles = new Map<string, (...args: unknown[]) => unknown>()
  const ipcListeners = new Map<string, (...args: unknown[]) => unknown>()
  const appEvents = new Map<string, (...args: unknown[]) => unknown>()
  let whenReadyCallback: (() => Promise<void>) | null = null

  const mockPoopStore = {
    load: vi.fn(() => []),
    get: vi.fn(() => []),
    set: vi.fn((poops: unknown[]) => poops),
    flush: vi.fn()
  }

  const mockConfigStoreInstance = {
    get: vi.fn(() => ({
      workEndTime: '18:00',
      workEndReminderEnabled: true,
      windowX: 100,
      windowY: 100,
      autoLaunch: false,
      globalMouseTracking: true,
      skinId: 'default',
      poopEnabled: true
    })),
    set: vi.fn(),
    flush: vi.fn()
  }

  const electronMock = {
    app: {
      whenReady: vi.fn(() => ({
        then: vi.fn((cb) => {
          whenReadyCallback = cb
          return Promise.resolve()
        })
      })),
      on: vi.fn((event, cb) => {
        appEvents.set(event, cb)
      }),
      getPath: vi.fn(() => 'C:/mock/userData'),
      quit: vi.fn(),
      setLoginItemSettings: vi.fn()
    },
    BrowserWindow: Object.assign(
      vi.fn().mockImplementation(() => ({
        setAlwaysOnTop: vi.fn(),
        setIgnoreMouseEvents: vi.fn(),
        loadURL: vi.fn(),
        loadFile: vi.fn(),
        on: vi.fn(),
        isAlwaysOnTop: vi.fn(() => true),
        webContents: { send: vi.fn() }
      })),
      {
        getAllWindows: vi.fn(() => [])
      }
    ),
    ipcMain: {
      handle: vi.fn((channel, handler) => {
        ipcHandles.set(channel, handler)
      }),
      on: vi.fn((channel, listener) => {
        ipcListeners.set(channel, listener)
      })
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false)
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        bounds: { width: 1920, height: 1080 }
      }))
    },
    shell: {
      openExternal: vi.fn()
    },
    Tray: vi.fn().mockImplementation(() => ({
      setToolTip: vi.fn(),
      setContextMenu: vi.fn()
    })),
    Menu: {
      buildFromTemplate: vi.fn(() => ({}))
    },
    nativeImage: {
      createFromDataURL: vi.fn(() => ({}))
    }
  }

  return {
    mockPoopStore,
    mockConfigStoreInstance,
    ipcHandles,
    ipcListeners,
    appEvents,
    getWhenReadyCallback: () => whenReadyCallback,
    electronMock
  }
})

vi.mock('electron', () => ({
  __esModule: true,
  ...electronMock,
  default: electronMock
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: true
  }
}))

vi.mock('./tray-icon.png?inline', () => ({
  default: 'data:image/png;base64,mock'
}))

vi.mock('./poopStore', () => ({
  poopStore: mockPoopStore,
  default: mockPoopStore
}))

vi.mock('./config', () => ({
  createConfigStore: vi.fn(() => mockConfigStoreInstance)
}))

vi.mock('./globalMouse', () => ({
  startGlobalMouseTracking: vi.fn(),
  stopGlobalMouseTracking: vi.fn()
}))

vi.mock('./alwaysOnTop', () => ({
  startAlwaysOnTopWatchdog: vi.fn()
}))

vi.mock('./auth', () => ({
  createAuthModule: vi.fn(() => ({
    login: vi.fn(),
    logout: vi.fn(),
    getState: vi.fn(),
    getAccessToken: vi.fn(),
    load: vi.fn(),
    onStateChanged: vi.fn()
  }))
}))

vi.mock('./reporter', () => ({
  createReporter: vi.fn(() => ({
    reportScoop: vi.fn()
  }))
}))

vi.mock('./apiClient', () => ({
  createApiClient: vi.fn(() => ({
    getMe: vi.fn(),
    getLeaderboard: vi.fn(),
    setShowOnLeaderboard: vi.fn()
  }))
}))

describe('Main Process Poop IPC & Lifecycle Routing (#10)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await import('./index')
  })

  it('注册了 get-poops 与 set-poops IPC 频道', () => {
    expect(ipcHandles.has('get-poops')).toBe(true)
    expect(ipcListeners.has('set-poops')).toBe(true)
  })

  it('get-poops 路由至 poopStore.get()，不再读取 configStore', async () => {
    const samplePoops: Poop[] = [{ id: 'poop-1', x: 10, y: 20 }]
    mockPoopStore.get.mockReturnValue(samplePoops)

    const handler = ipcHandles.get('get-poops')!
    const result = await handler({} as never)

    expect(mockPoopStore.get).toHaveBeenCalledTimes(1)
    expect(result).toEqual(samplePoops)
    expect(mockConfigStoreInstance.get).not.toHaveBeenCalled()
  })

  it('set-poops 路由至 poopStore.set()，且绝不调用 configStore.set()（解耦广播）', () => {
    const newPoops: Poop[] = [
      { id: 'p1', x: 50, y: 60 },
      { id: 'p2', x: 70, y: 80 }
    ]

    const listener = ipcListeners.get('set-poops')!
    listener({} as never, newPoops)

    expect(mockPoopStore.set).toHaveBeenCalledTimes(1)
    expect(mockPoopStore.set).toHaveBeenCalledWith(newPoops)

    // 确保解耦广播通知：绝不调用 configStore.set()
    expect(mockConfigStoreInstance.set).not.toHaveBeenCalled()
  })

  it('应用就绪 app.whenReady() 时触发 poopStore.load()（初始化排泄物并触发兼容迁移）', async () => {
    const whenReady = getWhenReadyCallback()
    expect(whenReady).toBeDefined()
    if (whenReady) {
      await whenReady()
    }

    expect(mockPoopStore.load).toHaveBeenCalled()
  })

  it('应用退出 app.on(will-quit) 时触发 poopStore.flush()', async () => {
    const whenReady = getWhenReadyCallback()
    if (whenReady) {
      await whenReady()
    }

    const willQuitHandler = appEvents.get('will-quit')
    expect(willQuitHandler).toBeDefined()

    if (willQuitHandler) {
      willQuitHandler({} as never)
      expect(mockPoopStore.flush).toHaveBeenCalled()
      expect(mockConfigStoreInstance.flush).toHaveBeenCalled()
    }
  })
})
