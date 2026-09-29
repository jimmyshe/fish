import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { Config, DEFAULT_CONFIG } from '../shared/config'

export interface ConfigStoreOptions {
  configPath: string
  /** 写盘去抖毫秒数，默认 500（窗口拖动等高频更新合并为一次写盘） */
  debounceMs?: number
}

/**
 * 配置模块：应用配置的唯一属主。
 * Interface：get 读、set(patch) 合并并调度持久化、flush 立即落盘。
 * 坏 JSON 或缺字段时回退默认值（并告警），不再静默吞错。
 */
export interface ConfigStore {
  get: () => Config
  set: (patch: Partial<Config>) => Config
  flush: () => void
}

export function createConfigStore({ configPath, debounceMs = 500 }: ConfigStoreOptions): ConfigStore {
  let config = load()
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function load(): Config {
    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG }
    }
    try {
      return { ...DEFAULT_CONFIG, ...(JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<Config>) }
    } catch {
      console.warn(`[config] 无法解析 ${configPath}，已回退默认配置`)
      return { ...DEFAULT_CONFIG }
    }
  }

  function persist(): void {
    const dir = dirname(configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  function schedulePersist(): void {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      persist()
    }, debounceMs)
  }

  return {
    get: () => config,
    set: (patch) => {
      config = { ...config, ...patch }
      schedulePersist()
      return config
    },
    flush: () => {
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      persist()
    }
  }
}
