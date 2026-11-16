import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  applyAchievementEvents,
  createDefaultAchievementState,
  normalizeAchievementState,
  type AchievementDef,
  type AchievementEvent,
  type AchievementState,
  type ApplyAchievementResult
} from '../shared/achievements'

export interface AchievementStoreOptions {
  /** 存储目录（用于自动推导 achievements.json） */
  storageDir?: string
  /** 显式指定 achievements.json 路径 */
  filePath?: string
  /** 写盘去抖毫秒数，默认 500 */
  debounceMs?: number
  /** 状态变更后立即广播回调（不经去抖） */
  onChanged?: (state: AchievementState) => void
  /** 新解锁成就后立即通知回调（不经去抖） */
  onUnlocked?: (unlocked: AchievementDef[]) => void
}

export interface AchievementStore {
  load: (dirOrOptions?: string | AchievementStoreOptions) => AchievementState
  get: () => AchievementState
  record: (events: AchievementEvent | AchievementEvent[], nowMs?: number) => ApplyAchievementResult
  setCallbacks: (callbacks: {
    onChanged?: (state: AchievementState) => void
    onUnlocked?: (unlocked: AchievementDef[]) => void
  }) => void
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

/**
 * 本地成就存储属主：管理 userData/achievements.json。
 * 采用事件求值写入 + 500ms 去抖落盘 + will-quit 同步 flush。
 */
export function createAchievementStore(initialOptions?: AchievementStoreOptions): AchievementStore {
  let filePath = ''
  let debounceMs = 500
  let onChangedCb = initialOptions?.onChanged
  let onUnlockedCb = initialOptions?.onUnlocked
  let memory: AchievementState = createDefaultAchievementState()
  let isLoaded = false
  let isDirty = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function resolvePaths(dirOrOptions?: string | AchievementStoreOptions): void {
    const opts = typeof dirOrOptions === 'string' ? { storageDir: dirOrOptions } : dirOrOptions
    const targetDir = opts?.storageDir ?? initialOptions?.storageDir
    const fallbackDir = getDefaultUserDataDir()

    filePath = resolveFilePath(
      'achievements.json',
      opts?.filePath ?? initialOptions?.filePath,
      targetDir,
      fallbackDir
    )
    debounceMs = opts?.debounceMs ?? initialOptions?.debounceMs ?? 500
    if (opts?.onChanged !== undefined) onChangedCb = opts.onChanged
    if (opts?.onUnlocked !== undefined) onUnlockedCb = opts.onUnlocked
  }

  function readStoreFile(targetPath: string): AchievementState {
    if (!targetPath || !existsSync(targetPath)) {
      return createDefaultAchievementState()
    }
    try {
      const raw = JSON.parse(readFileSync(targetPath, 'utf-8'))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        console.warn(`[achievementStore] ${targetPath} 内容格式非对象，已回退默认状态`)
        return createDefaultAchievementState()
      }
      return normalizeAchievementState(raw)
    } catch (err) {
      console.warn(`[achievementStore] 无法解析 ${targetPath}，已回退默认状态`, err)
      return createDefaultAchievementState()
    }
  }

  function persist(state: AchievementState): void {
    if (!filePath) {
      resolvePaths()
    }
    if (!filePath) return
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
    isDirty = false
  }

  function load(dirOrOptions?: string | AchievementStoreOptions): AchievementState {
    if (dirOrOptions !== undefined || !filePath) {
      resolvePaths(dirOrOptions)
    }
    isLoaded = true
    isDirty = false
    memory = readStoreFile(filePath)
    return memory
  }

  function ensureLoaded(): void {
    if (!isLoaded && (filePath || getDefaultUserDataDir())) {
      load()
    }
  }

  function get(): AchievementState {
    ensureLoaded()
    return memory
  }

  function record(
    events: AchievementEvent | AchievementEvent[],
    nowMs = Date.now()
  ): ApplyAchievementResult {
    ensureLoaded()
    const result = applyAchievementEvents(memory, events, nowMs)
    if (!result.changed) {
      return result
    }

    memory = result.state
    isDirty = true

    if (pendingTimer) {
      clearTimeout(pendingTimer)
    }
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      persist(memory)
    }, debounceMs)

    onChangedCb?.(memory)
    if (result.newlyUnlocked.length > 0) {
      onUnlockedCb?.(result.newlyUnlocked)
    }

    return result
  }

  function setCallbacks(callbacks: {
    onChanged?: (state: AchievementState) => void
    onUnlocked?: (unlocked: AchievementDef[]) => void
  }): void {
    onChangedCb = callbacks.onChanged
    onUnlockedCb = callbacks.onUnlocked
  }

  function flush(): void {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    if (isDirty) {
      persist(memory)
    }
  }

  resolvePaths(initialOptions)
  if (filePath) {
    load()
  }

  return {
    load,
    get,
    record,
    setCallbacks,
    flush
  }
}

export const achievementStore: AchievementStore = createAchievementStore()

export default achievementStore
