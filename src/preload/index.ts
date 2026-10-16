import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api, AuthState, LeaderboardResponse, MainPanelTab, MeResponse, ScreenPoint } from '../shared/api'
import type { Config, Poop } from '../shared/config'

const api: Api = {
  getConfig: (): Promise<Config> => {
    return ipcRenderer.invoke('get-config')
  },
  onConfigChanged: (callback: (config: Config) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, config: Config): void => callback(config)
    ipcRenderer.on('config-changed', handler)
    return () => ipcRenderer.removeListener('config-changed', handler)
  },
  setWorkEndTime: (time: string): Promise<void> => {
    return ipcRenderer.invoke('set-work-end-time', time)
  },
  setWorkEndReminderEnabled: (enabled: boolean): Promise<void> => {
    return ipcRenderer.invoke('set-work-end-reminder-enabled', enabled)
  },
  getFishPosition: (): Promise<ScreenPoint> => {
    return ipcRenderer.invoke('get-fish-position')
  },
  setFishPosition: (x: number, y: number): void => {
    ipcRenderer.send('set-fish-position', x, y)
  },
  setClickThrough: (ignore: boolean): void => {
    ipcRenderer.send('set-click-through', ignore)
  },
  setGlobalMouseTracking: (enabled: boolean): void => {
    ipcRenderer.send('set-global-mouse-tracking', enabled)
  },
  setSkinId: (id: string): Promise<void> => {
    return ipcRenderer.invoke('set-skin-id', id)
  },
  setPoopEnabled: (enabled: boolean): void => {
    ipcRenderer.send('set-poop-enabled', enabled)
  },
  setAutoLaunch: (enabled: boolean): void => {
    ipcRenderer.send('set-auto-launch', enabled)
  },
  getAlwaysOnTop: (): Promise<boolean> => {
    return ipcRenderer.invoke('get-always-on-top')
  },
  setAlwaysOnTop: (enabled: boolean): void => {
    ipcRenderer.send('set-always-on-top', enabled)
  },
  getPoops: (): Promise<Poop[]> => {
    return ipcRenderer.invoke('get-poops')
  },
  setPoops: (poops: Poop[]): void => {
    ipcRenderer.send('set-poops', poops)
  },
  quit: (): void => {
    ipcRenderer.send('quit')
  },
  onSwitchPanelTab: (callback: (tab: MainPanelTab) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, tab: MainPanelTab): void => callback(tab)
    ipcRenderer.on('panel-switch-tab', handler)
    return () => ipcRenderer.removeListener('panel-switch-tab', handler)
  },
  login: (): Promise<void> => {
    return ipcRenderer.invoke('auth-login')
  },
  logout: (): Promise<void> => {
    return ipcRenderer.invoke('auth-logout')
  },
  getAuthState: (): Promise<AuthState> => {
    return ipcRenderer.invoke('get-auth-state')
  },
  onAuthStateChanged: (callback: (state: AuthState) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, state: AuthState): void => callback(state)
    ipcRenderer.on('auth-state-changed', handler)
    return () => ipcRenderer.removeListener('auth-state-changed', handler)
  },
  reportScoop: (): void => {
    ipcRenderer.send('report-scoop')
  },
  getMe: (): Promise<MeResponse | null> => {
    return ipcRenderer.invoke('get-me')
  },
  getLeaderboard: (): Promise<LeaderboardResponse | null> => {
    return ipcRenderer.invoke('get-leaderboard')
  },
  setShowOnLeaderboard: (show: boolean): Promise<void> => {
    return ipcRenderer.invoke('set-show-on-leaderboard', show)
  },
  onGlobalMouseMove: (callback: (pos: ScreenPoint) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, pos: ScreenPoint): void => callback(pos)
    ipcRenderer.on('global-mouse-move', handler)
    return () => ipcRenderer.removeListener('global-mouse-move', handler)
  },
  onGlobalMouseClick: (callback: (pos: ScreenPoint) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, pos: ScreenPoint): void => callback(pos)
    ipcRenderer.on('global-mouse-click', handler)
    return () => ipcRenderer.removeListener('global-mouse-click', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (for non-context-isolated mode)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
