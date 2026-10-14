import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMenuModule } from './menu'

const mocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn((template: unknown) => ({ template })),
  setContextMenu: vi.fn(),
  quit: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    quit: mocks.quit
  },
  Menu: {
    buildFromTemplate: mocks.buildFromTemplate
  }
}))

type Template = Array<Record<string, unknown>>

function makeDeps() {
  const openMainPanel = vi.fn()
  const tray = { setContextMenu: mocks.setContextMenu }
  const deps = {
    getTray: () => tray as never,
    openMainPanel
  }
  return { deps, openMainPanel, tray }
}

function lastTemplate(): Template {
  const result = mocks.buildFromTemplate.mock.results.at(-1)
  return result!.value.template as Template
}

describe('menu module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('托盘菜单固定三项：设置 / 排行榜 / 退出', () => {
    const { deps } = makeDeps()
    const menu = createMenuModule(deps)
    menu.updateTrayMenu()

    const labels = lastTemplate().map(i => i.label)
    expect(labels).toEqual(['⚙️ 设置', '🏆 排行榜', undefined, '❌ 退出'])
    expect(mocks.setContextMenu).toHaveBeenCalledTimes(1)
  })

  it('「⚙️ 设置」打开主面板设置 tab', () => {
    const { deps, openMainPanel } = makeDeps()
    const menu = createMenuModule(deps)
    menu.updateTrayMenu()

    const item = lastTemplate().find(i => i.label === '⚙️ 设置')!
    ;(item.click as () => void)()

    expect(openMainPanel).toHaveBeenCalledWith('settings')
  })

  it('「🏆 排行榜」打开主面板排行榜 tab', () => {
    const { deps, openMainPanel } = makeDeps()
    const menu = createMenuModule(deps)
    menu.updateTrayMenu()

    const item = lastTemplate().find(i => i.label === '🏆 排行榜')!
    ;(item.click as () => void)()

    expect(openMainPanel).toHaveBeenCalledWith('leaderboard')
  })

  it('「❌ 退出」退出应用', () => {
    const { deps } = makeDeps()
    const menu = createMenuModule(deps)
    menu.updateTrayMenu()

    const item = lastTemplate().find(i => i.label === '❌ 退出')!
    ;(item.click as () => void)()

    expect(mocks.quit).toHaveBeenCalledTimes(1)
  })

  it('托盘未创建时不建菜单', () => {
    const openMainPanel = vi.fn()
    const menu = createMenuModule({ getTray: () => null, openMainPanel })
    menu.updateTrayMenu()

    expect(mocks.buildFromTemplate).not.toHaveBeenCalled()
  })
})
