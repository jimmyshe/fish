import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMenuModule, type MenuConfig } from './menu'

const mocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn((template: unknown) => ({ template, popup: vi.fn() })),
  setContextMenu: vi.fn(),
  setLoginItemSettings: vi.fn(),
  quit: vi.fn(),
  send: vi.fn(),
  electronKit: { is: { dev: false } }
}))

vi.mock('electron', () => ({
  app: {
    setLoginItemSettings: mocks.setLoginItemSettings,
    quit: mocks.quit
  },
  Menu: {
    buildFromTemplate: mocks.buildFromTemplate
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: mocks.electronKit.is
}))

type Template = Array<Record<string, unknown>>

function makeDeps(configOverrides: Partial<MenuConfig> = {}) {
  const config: MenuConfig = { workEndTime: '18:00', autoLaunch: false, ...configOverrides }
  const saveConfig = vi.fn()
  const tray = { setContextMenu: mocks.setContextMenu }
  const win = {
    webContents: { send: mocks.send },
    isVisible: () => true,
    hide: vi.fn(),
    show: vi.fn(),
    isAlwaysOnTop: () => true,
    setAlwaysOnTop: vi.fn()
  }
  const deps = {
    getTray: () => tray,
    getWindow: () => win as never,
    getConfig: () => config,
    saveConfig
  }
  return { deps, config, saveConfig, tray, win }
}

function lastTemplate(): Template {
  const result = mocks.buildFromTemplate.mock.results.at(-1)
  return result!.value.template as Template
}

describe('menu module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.electronKit.is.dev = false
  })

  it('tray 菜单：含下班时间与「显示/隐藏」，不含「置顶」', () => {
    const { deps } = makeDeps({ workEndTime: '18:30' })
    const menu = createMenuModule(deps)
    menu.updateTrayMenu()

    const labels = lastTemplate().map(i => i.label)
    expect(labels).toContain('🕐 下班时间: 18:30')
    expect(labels).toContain('👁 显示/隐藏')
    expect(labels).not.toContain('📌 置顶')
    expect(mocks.setContextMenu).toHaveBeenCalledTimes(1)
  })

  it('右键菜单：含「置顶」，不含「显示/隐藏」', () => {
    const { deps } = makeDeps()
    const menu = createMenuModule(deps)
    menu.popupContextMenu()

    const labels = lastTemplate().map(i => i.label)
    expect(labels).toContain('📌 置顶')
    expect(labels).not.toContain('👁 显示/隐藏')
    expect(mocks.buildFromTemplate.mock.results.at(-1)!.value.popup).toHaveBeenCalled()
  })

  it('setAutoLaunch：更新 → 保存 → 应用 → 刷新，顺序固定', () => {
    const { deps, config, saveConfig } = makeDeps()
    const menu = createMenuModule(deps)
    menu.setAutoLaunch(true)

    expect(config.autoLaunch).toBe(true)
    expect(saveConfig).toHaveBeenCalledWith(config)
    expect(mocks.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, name: '摸鱼宠物' })
    expect(mocks.setContextMenu).toHaveBeenCalledTimes(1) // 菜单刷新
    expect(saveConfig.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.setLoginItemSettings.mock.invocationCallOrder[0])
    expect(mocks.setLoginItemSettings.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.setContextMenu.mock.invocationCallOrder[0])
  })

  it('开发模式：跳过系统自启动设置，但保存与菜单刷新照做', () => {
    mocks.electronKit.is.dev = true
    const { deps, saveConfig } = makeDeps()
    const menu = createMenuModule(deps)
    menu.setAutoLaunch(true)

    expect(mocks.setLoginItemSettings).not.toHaveBeenCalled()
    expect(saveConfig).toHaveBeenCalledTimes(1)
    expect(mocks.setContextMenu).toHaveBeenCalledTimes(1)
  })

  it('菜单里的自启动勾选走同一条 setAutoLaunch 序列', () => {
    const { deps, saveConfig } = makeDeps()
    const menu = createMenuModule(deps)
    menu.updateTrayMenu()

    const item = lastTemplate().find(i => i.label === '🚀 开机自启动')!
    ;(item.click as (i: { checked: boolean }) => void)({ checked: true })

    expect(saveConfig).toHaveBeenCalledTimes(1)
    expect(mocks.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, name: '摸鱼宠物' })
  })

  it('「设置下班时间」菜单项向渲染进程发 open-settings', () => {
    const { deps } = makeDeps()
    const menu = createMenuModule(deps)
    menu.popupContextMenu()

    const item = lastTemplate().find(i => i.label === '⏰ 设置下班时间')!
    ;(item.click as () => void)()

    expect(mocks.send).toHaveBeenCalledWith('open-settings')
  })
})
