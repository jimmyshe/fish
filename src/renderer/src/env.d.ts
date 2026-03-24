/// <reference types="vite/client" />

interface Window {
  api: {
    moveWindow: (deltaX: number, deltaY: number) => void
    getWorkEndTime: () => Promise<string>
    setWorkEndTime: (time: string) => Promise<boolean>
    showContextMenu: () => void
    quit: () => void
    onOpenSettings: (callback: () => void) => () => void
  }
}
