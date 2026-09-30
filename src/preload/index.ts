import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from '../shared/api'
import type { ScreenPoint } from '../shared/api'

const api: Api = {
  getWorkEndTime: (): Promise<string> => {
    return ipcRenderer.invoke('get-work-end-time')
  },
  setWorkEndTime: (time: string) => {
    return ipcRenderer.invoke('set-work-end-time', time)
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
  showContextMenu: (): void => {
    ipcRenderer.send('show-context-menu')
  },
  quit: (): void => {
    ipcRenderer.send('quit')
  },
  onOpenSettings: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('open-settings', handler)
    return () => ipcRenderer.removeListener('open-settings', handler)
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
