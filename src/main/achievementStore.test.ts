import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultAchievementState } from '../shared/achievements'
import {
  achievementStore,
  createAchievementStore,
  type AchievementStore
} from './achievementStore'

describe('achievementStore 模块', () => {
  let dir: string
  let filePath: string
  let warnSpy: ReturnType<typeof vi.spyOn>
  let store: AchievementStore

  beforeEach(() => {
    vi.useFakeTimers()
    dir = mkdtempSync(join(tmpdir(), 'fish-achievement-test-'))
    filePath = join(dir, 'achievements.json')
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    store = createAchievementStore({ storageDir: dir })
  })

  afterEach(() => {
    store.flush()
    vi.useRealTimers()
    warnSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  it('文件不存在：默认返回初始状态且不写盘', () => {
    expect(store.get()).toEqual(createDefaultAchievementState())
    expect(existsSync(filePath)).toBe(false)
  })

  it('损坏或非对象格式的 JSON：安全降级回退默认状态并警告', () => {
    writeFileSync(filePath, '{bad-json', 'utf-8')
    store.load()
    expect(store.get()).toEqual(createDefaultAchievementState())
    expect(warnSpy).toHaveBeenCalledTimes(1)

    writeFileSync(filePath, JSON.stringify(['not-an-object']), 'utf-8')
    store.load()
    expect(store.get()).toEqual(createDefaultAchievementState())
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  it('record() 立即更新内存并触发广播/解锁回调，去抖 500ms 后落盘', () => {
    const onChanged = vi.fn()
    const onUnlocked = vi.fn()
    store.setCallbacks({ onChanged, onUnlocked })

    const res = store.record({ type: 'scoop' }, 12345)
    expect(res.changed).toBe(true)
    expect(res.newlyUnlocked.map((a) => a.id)).toEqual(['scoop-1'])
    expect(store.get().stats.scoopCount).toBe(1)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(onUnlocked).toHaveBeenCalledWith([expect.objectContaining({ id: 'scoop-1' })])

    // 去抖前尚未写盘
    expect(existsSync(filePath)).toBe(false)
    vi.advanceTimersByTime(499)
    expect(existsSync(filePath)).toBe(false)

    vi.advanceTimersByTime(1)
    expect(existsSync(filePath)).toBe(true)
    const saved = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(saved.stats.scoopCount).toBe(1)
    expect(saved.unlocked['scoop-1']).toBe(12345)
  })

  it('无状态变更的事件（如重复皮肤或未达标的 time-check）不触发写盘与回调', () => {
    const onChanged = vi.fn()
    const onUnlocked = vi.fn()
    store.setCallbacks({ onChanged, onUnlocked })

    const res = store.record({ type: 'time-check', remainingMinutes: 30, hour: 17 }, 1000)
    expect(res.changed).toBe(false)
    expect(onChanged).not.toHaveBeenCalled()
    expect(onUnlocked).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(existsSync(filePath)).toBe(false)
  })

  it('短时间内连续 record() 合并为一次写盘，保留最新状态', () => {
    for (let i = 0; i < 10; i++) {
      store.record({ type: 'tap' }, 1000 + i)
    }

    expect(store.get().stats.tapCount).toBe(10)
    expect(existsSync(filePath)).toBe(false)

    vi.advanceTimersByTime(500)
    const saved = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(saved.stats.tapCount).toBe(10)
  })

  it('flush() 立即同步写入未落盘数据', () => {
    store.record({ type: 'water' }, 5000)
    expect(existsSync(filePath)).toBe(false)

    store.flush()
    expect(existsSync(filePath)).toBe(true)
    const saved = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(saved.stats.waterCount).toBe(1)
  })

  it('从已有 achievements.json 恢复进度与解锁记录', () => {
    const initial = {
      stats: {
        scoopCount: 8,
        tapCount: 12,
        waterCount: 2,
        visitedSkins: ['classic-fish:default', 'classic-fish:sakura']
      },
      unlocked: { 'scoop-1': 999 }
    }
    writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8')

    store.load()
    expect(store.get()).toEqual({
      ...initial,
      stats: { ...initial.stats, overworkCount: 0 }
    })

    const res = store.record([{ type: 'scoop' }, { type: 'scoop' }], 2000)
    expect(res.newlyUnlocked.map((a) => a.id)).toEqual(['scoop-10'])
    expect(store.get().stats.scoopCount).toBe(10)
  })

  it('单例 achievementStore 暴露完整接口', () => {
    expect(typeof achievementStore.load).toBe('function')
    expect(typeof achievementStore.get).toBe('function')
    expect(typeof achievementStore.record).toBe('function')
    expect(typeof achievementStore.setCallbacks).toBe('function')
    expect(typeof achievementStore.flush).toBe('function')
  })
})
