import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { Poop } from '../shared/config'

export interface PoopStoreOptions {
  customDir?: string
  poopPath?: string
  configPath?: string
  debounceMs?: number
}

export interface PoopStore {
  load: (dirOrOptions?: string | PoopStoreOptions) => Poop[]
  get: () => Poop[]
  set: (poops: Poop[]) => Poop[]
  flush: () => void
  resetForTesting: (dirOrOptions?: string | PoopStoreOptions) => void
}

function getDefaultUserDataDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron')
    if (electron && typeof electron === 'object' && electron.app?.getPath) {
      return electron.app.getPath('userData')
    }
  } catch {
    // 非 Electron 运行时（如测试环境）或 app 尚未就绪
  }
  return ''
}

export function createPoopStore(initialOptions?: PoopStoreOptions): PoopStore {
  let poopPath = ''
  let configPath = ''
  let debounceMs = 500
  let memory: Poop[] = []
  let isLoaded = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function resolvePaths(dirOrOptions?: string | PoopStoreOptions): void {
    let customDir: string | undefined
    let customPoopPath: string | undefined
    let customConfigPath: string | undefined
    let customDebounceMs: number | undefined

    if (typeof dirOrOptions === 'string') {
      customDir = dirOrOptions
    } else if (dirOrOptions && typeof dirOrOptions === 'object') {
      customDir = dirOrOptions.customDir
      customPoopPath = dirOrOptions.poopPath
      customConfigPath = dirOrOptions.configPath
      customDebounceMs = dirOrOptions.debounceMs
    }

    debounceMs = customDebounceMs ?? initialOptions?.debounceMs ?? 500

    if (customPoopPath) {
      poopPath = customPoopPath
    } else if (customDir) {
      poopPath = join(customDir, 'poops.json')
    } else if (initialOptions?.poopPath) {
      poopPath = initialOptions.poopPath
    } else if (initialOptions?.customDir) {
      poopPath = join(initialOptions.customDir, 'poops.json')
    } else {
      const userData = getDefaultUserDataDir()
      poopPath = userData ? join(userData, 'poops.json') : ''
    }

    if (customConfigPath) {
      configPath = customConfigPath
    } else if (customDir) {
      configPath = join(customDir, 'config.json')
    } else if (initialOptions?.configPath) {
      configPath = initialOptions.configPath
    } else if (initialOptions?.customDir) {
      configPath = join(initialOptions.customDir, 'config.json')
    } else {
      const userData = getDefaultUserDataDir()
      configPath = userData ? join(userData, 'config.json') : ''
    }
  }

  function readStoreFile(targetPath: string): Poop[] | null {
    if (!targetPath || !existsSync(targetPath)) return null
    try {
      const raw = JSON.parse(readFileSync(targetPath, 'utf-8'))
      if (Array.isArray(raw)) {
        return raw as Poop[]
      }
      console.warn(`[poopStore] ${targetPath} 内容格式非数组，已回退为空列表`)
      return []
    } catch (err) {
      console.warn(`[poopStore] 无法解析 ${targetPath}，已回退为空列表`, err)
      return []
    }
  }

  function persist(data: Poop[]): void {
    if (!poopPath) {
      resolvePaths()
    }
    if (!poopPath) return
    const dir = dirname(poopPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(poopPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  function load(dirOrOptions?: string | PoopStoreOptions): Poop[] {
    if (dirOrOptions !== undefined || !poopPath) {
      resolvePaths(dirOrOptions)
    }

    isLoaded = true

    if (!poopPath) {
      memory = []
      return memory
    }

    const existing = readStoreFile(poopPath)
    if (existing !== null) {
      memory = existing
      return memory
    }

    // poops.json 不存在，检测是否需要从旧版 config.json 迁移
    if (configPath && existsSync(configPath)) {
      try {
        const configRaw = JSON.parse(readFileSync(configPath, 'utf-8'))
        if (Array.isArray(configRaw?.poops) && configRaw.poops.length > 0) {
          memory = [...configRaw.poops]
          // 立即持久化到 poops.json
          persist(memory)
          // 从 config.json 清理 poops 字段以避免冗余残留 (ADR / Issue #3)
          try {
            delete configRaw.poops
            writeFileSync(configPath, JSON.stringify(configRaw, null, 2), 'utf-8')
          } catch (cleanErr) {
            console.warn(`[poopStore] 清理旧版 ${configPath} 中的 poops 字段失败:`, cleanErr)
          }
          return memory
        }
      } catch (err) {
        console.warn(`[poopStore] 尝试从 ${configPath} 迁移旧数据失败:`, err)
      }
    }

    memory = []
    return memory
  }

  function ensureLoaded(): void {
    if (!isLoaded && (poopPath || getDefaultUserDataDir())) {
      load()
    }
  }

  function get(): Poop[] {
    ensureLoaded()
    return memory
  }

  function set(poops: Poop[]): Poop[] {
    ensureLoaded()
    memory = [...poops]
    if (pendingTimer) {
      clearTimeout(pendingTimer)
    }
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      persist(memory)
    }, debounceMs)
    return memory
  }

  function flush(): void {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    persist(memory)
  }

  function resetForTesting(dirOrOptions?: string | PoopStoreOptions): void {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    resolvePaths(dirOrOptions)
    memory = []
    isLoaded = false
    if (dirOrOptions !== undefined) {
      load(dirOrOptions)
    }
  }

  // 初始化路径与首次加载
  resolvePaths(initialOptions)
  if (poopPath) {
    load()
  }

  return {
    load,
    get,
    set,
    flush,
    resetForTesting
  }
}

const defaultStore = createPoopStore()

export const load = defaultStore.load
export const get = defaultStore.get
export const set = defaultStore.set
export const flush = defaultStore.flush
export const resetForTesting = defaultStore.resetForTesting

export const poopStore: PoopStore = defaultStore

export default poopStore
