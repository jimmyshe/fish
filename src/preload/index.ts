import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  moveWindow: (deltaX: number, deltaY: number): void => {
    ipcRenderer.send('move-window', deltaX, deltaY)
  },
  getWorkEndTime: (): Promise<string> => {
    return ipcRenderer.invoke('get-work-end-time')
  },
  setWorkEndTime: (time: string): Promise<boolean> => {
    return ipcRenderer.invoke('set-work-end-time', time)
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
