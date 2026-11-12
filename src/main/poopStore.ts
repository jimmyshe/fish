import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { Poop } from '../shared/config'

export interface PoopStoreOptions {
  /** 存储目录（用于自动推导 poops.json 与 config.json） */
  storageDir?: string
  /** 兼容别名 */
  customDir?: string
  /** 显式指定 poops.json 路径 */
  poopPath?: string
  /** 显式指定旧版 config.json 路径（用于迁移检测） */
  configPath?: string
  /** 写盘去抖毫秒数，默认 500 */
  debounceMs?: number
}

export interface PoopStore {
  load: (dirOrOptions?: string | PoopStoreOptions) => Poop[]
  get: () => Poop[]
  set: (poops: Poop[]) => Poop[]
  flush: () => void
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

function resolveFilePath(
  filename: string,
  explicitPath?: string,
  dir?: string,
  fallbackDir?: string
): string {
  if (explicitPath) return explicitPath
  if (dir) return join(dir, filename)
  if (fallbackDir) return join(fallbackDir, filename)
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
    const opts = typeof dirOrOptions === 'string' ? { storageDir: dirOrOptions } : dirOrOptions
    const targetDir = opts?.storageDir ?? opts?.customDir ?? initialOptions?.storageDir ?? initialOptions?.customDir
    const fallbackDir = getDefaultUserDataDir()

    poopPath = resolveFilePath('poops.json', opts?.poopPath ?? initialOptions?.poopPath, targetDir, fallbackDir)
    configPath = resolveFilePath('config.json', opts?.configPath ?? initialOptions?.configPath, targetDir, fallbackDir)
    debounceMs = opts?.debounceMs ?? initialOptions?.debounceMs ?? 500
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
        if (configRaw && typeof configRaw === 'object' && 'poops' in configRaw) {
          if (Array.isArray(configRaw.poops) && configRaw.poops.length > 0) {
            memory = [...configRaw.poops]
            // 立即持久化到 poops.json
            persist(memory)
          } else {
            memory = []
          }

          // 无论数组是否为空，只要包含 poops 键，均清理旧 config 中的残留字段 (ADR / Issue #3)
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

  // 初始化路径与首次加载
  resolvePaths(initialOptions)
  if (poopPath) {
    load()
  }

  return {
    load,
    get,
    set,
    flush
  }
}

export const poopStore: PoopStore = createPoopStore()

export default poopStore
