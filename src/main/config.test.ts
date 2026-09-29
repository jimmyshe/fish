import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../shared/config'
import { createConfigStore, type ConfigStore } from './config'

describe('configStore', () => {
  let dir: string
  let configPath: string
  let store: ConfigStore
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    dir = mkdtempSync(join(tmpdir(), 'fish-config-test-'))
    configPath = join(dir, 'config.json')
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    store?.flush()
    vi.useRealTimers()
    warnSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  it('文件不存在：返回默认配置', () => {
    store = createConfigStore({ configPath })
    expect(store.get()).toEqual(DEFAULT_CONFIG)
  })

  it('set 合并补丁并在去抖后落盘', () => {
    store = createConfigStore({ configPath, debounceMs: 500 })
    const result = store.set({ workEndTime: '17:30' })

    expect(result.workEndTime).toBe('17:30')
    expect(result.windowX).toBe(-1) // 未触及字段保留

    vi.advanceTimersByTime(499)
    expect(() => readFileSync(configPath)).toThrow() // 尚未写盘

    vi.advanceTimersByTime(1)
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(saved.workEndTime).toBe('17:30')
  })

  it('窗口拖动：连续 set 合并为一次落盘，保留最新值', () => {
    store = createConfigStore({ configPath, debounceMs: 500 })
    for (let i = 0; i < 20; i++) {
      store.set({ windowX: 100 + i, windowY: 200 + i })
    }
    vi.advanceTimersByTime(500)
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(saved.windowX).toBe(119)
    expect(saved.windowY).toBe(219)
  })

  it('flush：不等待去抖立即落盘', () => {
    store = createConfigStore({ configPath, debounceMs: 500 })
    store.set({ autoLaunch: true })
    store.flush()
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(saved.autoLaunch).toBe(true)
  })

  it('坏 JSON：回退默认值并告警', () => {
    writeFileSync(configPath, '{not json', 'utf-8')
    store = createConfigStore({ configPath })
    expect(store.get()).toEqual(DEFAULT_CONFIG)
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('缺字段的 JSON：默认值补齐缺失字段', () => {
    writeFileSync(configPath, JSON.stringify({ workEndTime: '19:00' }), 'utf-8')
    store = createConfigStore({ configPath })
    expect(store.get()).toEqual({ ...DEFAULT_CONFIG, workEndTime: '19:00' })
  })
})
