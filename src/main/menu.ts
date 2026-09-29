import { app, Menu } from 'electron'
import type { BrowserWindow, MenuItem, MenuItemConstructorOptions, Tray } from 'electron'
import { is } from '@electron-toolkit/utils'

/** 菜单模块依赖的最小配置形状（index.ts 的 Config 结构满足此接口） */
export interface MenuConfig {
  workEndTime: string
  autoLaunch: boolean
}

export interface MenuDeps {
  getTray: () => Tray | null
  getWindow: () => BrowserWindow | null
  getConfig: () => MenuConfig
  setConfig: (patch: Partial<MenuConfig>) => void
}

/**
 * 菜单模块：tray 菜单与右键菜单的唯一属主。
 * Interface：updateTrayMenu / popupContextMenu / setAutoLaunch。
 * 菜单形状只有一份定义；自启动的 更新→保存→应用→刷新 顺序由模块保证。
 */
export function createMenuModule(deps: MenuDeps) {
  function applyAutoLaunch(enabled: boolean): void {
    // 开发模式下路径不对，仅生产包生效
    if (is.dev) return
    app.setLoginItemSettings({
      openAtLogin: enabled,
      name: '摸鱼宠物'
    })
  }

  function buildMenu(opts: { showToggle?: boolean; showPin?: boolean }): MenuItemConstructorOptions[] {
    const config = deps.getConfig()
    const mainWindow = deps.getWindow()
    const items: MenuItemConstructorOptions[] = [
      {
        label: `🕐 下班时间: ${config.workEndTime}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '⏰ 设置下班时间',
        click: () => deps.getWindow()?.webContents.send('open-settings')
      }
    ]

    if (opts.showToggle) {
      items.push({
        label: '👁 显示/隐藏',
        click: () => {
          const win = deps.getWindow()
          if (win?.isVisible()) {
            win.hide()
          } else {
            win?.show()
          }
        }
      })
    }

    if (opts.showPin) {
      items.push({
        label: '📌 置顶',
        type: 'checkbox',
        checked: mainWindow?.isAlwaysOnTop() ?? true,
        click: (item: MenuItem) => {
          const win = deps.getWindow()
          win?.setAlwaysOnTop(item.checked)
          if (item.checked && process.platform !== 'darwin') {
            win?.setAlwaysOnTop(true, 'screen-saver')
          }
        }
      })
    }

    items.push(
      {
        label: '🚀 开机自启动',
        type: 'checkbox',
        checked: deps.getConfig().autoLaunch,
        click: (item: MenuItem) => setAutoLaunch(item.checked)
      },
      { type: 'separator' },
      {
        label: '❌ 退出',
        click: () => app.quit()
      }
    )
    return items
  }

  function updateTrayMenu(): void {
    const tray = deps.getTray()
    if (!tray) return
    tray.setContextMenu(Menu.buildFromTemplate(buildMenu({ showToggle: true })))
  }

  function popupContextMenu(): void {
    const mainWindow = deps.getWindow()
    if (!mainWindow) return
    Menu.buildFromTemplate(buildMenu({ showPin: true })).popup({ window: mainWindow })
  }

  function setAutoLaunch(enabled: boolean): void {
    deps.setConfig({ autoLaunch: enabled })
    applyAutoLaunch(enabled)
    updateTrayMenu()
  }

  return { updateTrayMenu, popupContextMenu, setAutoLaunch }
}
