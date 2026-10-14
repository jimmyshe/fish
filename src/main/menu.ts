import { app, Menu } from 'electron'
import type { Tray } from 'electron'
import type { MainPanelTab } from '../shared/api'

export interface MenuDeps {
  getTray: () => Tray | null
  /** 点击「⚙️ 设置」/「🏆 排行榜」：打开（或聚焦）主面板并切到对应 tab */
  openMainPanel: (tab: MainPanelTab) => void
}

/**
 * 菜单模块：托盘菜单的唯一属主。
 * 菜单固定三项：设置 / 排行榜（deep-link 主面板 tab）与退出；
 * 不承担任何设置与窗口管理功能（ADR 0005）。
 */
export function createMenuModule(deps: MenuDeps) {
  function updateTrayMenu(): void {
    const tray = deps.getTray()
    if (!tray) return
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '⚙️ 设置', click: () => deps.openMainPanel('settings') },
      { label: '🏆 排行榜', click: () => deps.openMainPanel('leaderboard') },
      { type: 'separator' },
      { label: '❌ 退出', click: () => app.quit() }
    ]))
  }

  return { updateTrayMenu }
}
