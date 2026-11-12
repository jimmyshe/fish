import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Poop } from '../shared/config'
import { createPoopStore, poopStore, type PoopStore } from './poopStore'

describe('poopStore 模块', () => {
  let dir: string
  let poopPath: string
  let configPath: string
  let warnSpy: ReturnType<typeof vi.spyOn>
  let store: PoopStore

  const samplePoops: Poop[] = [
    { id: 'poop-1', x: 100, y: 200 },
    { id: 'poop-2', x: 150, y: 250 }
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    dir = mkdtempSync(join(tmpdir(), 'fish-poop-test-'))
    poopPath = join(dir, 'poops.json')
    configPath = join(dir, 'config.json')
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    store = createPoopStore({ storageDir: dir })
  })

  afterEach(() => {
    store.flush()
    vi.useRealTimers()
    warnSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  it('文件不存在：默认返回空数组 []', () => {
    expect(store.get()).toEqual([])
    expect(existsSync(poopPath)).toBe(false)
  })

  it('损坏或非法的 JSON：安全降级回退为 [] 并记录警告', () => {
    writeFileSync(poopPath, '{invalid-json', 'utf-8')
    store.load()
    expect(store.get()).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('JSON 内容非数组结构（如对象或字符串）：安全降级为 [] 并警告', () => {
    writeFileSync(poopPath, JSON.stringify({ not: 'an array' }), 'utf-8')
    store.load()
    expect(store.get()).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('set() 立即更新内存状态，去抖 500ms 后落盘', () => {
    store.set(samplePoops)

    // 立即更新内存
    expect(store.get()).toEqual(samplePoops)
    // 尚未落盘
    expect(existsSync(poopPath)).toBe(false)

    vi.advanceTimersByTime(499)
    expect(existsSync(poopPath)).toBe(false)

    vi.advanceTimersByTime(1)
    expect(existsSync(poopPath)).toBe(true)
    const saved = JSON.parse(readFileSync(poopPath, 'utf-8'))
    expect(saved).toEqual(samplePoops)
  })

  it('短时间内连续 set() 合并为一次写盘，保留最新状态', () => {
    for (let i = 0; i < 10; i++) {
      store.set([{ id: `p-${i}`, x: i * 10, y: i * 20 }])
    }

    vi.advanceTimersByTime(500)
    const saved = JSON.parse(readFileSync(poopPath, 'utf-8'))
    expect(saved).toEqual([{ id: 'p-9', x: 90, y: 180 }])
  })

  it('flush() 立即同步写入未落盘数据，不等待去抖', () => {
    store.set(samplePoops)
    expect(existsSync(poopPath)).toBe(false)

    store.flush()
    expect(existsSync(poopPath)).toBe(true)
    const saved = JSON.parse(readFileSync(poopPath, 'utf-8'))
    expect(saved).toEqual(samplePoops)
  })

  it('正常读取已存在的 poops.json', () => {
    writeFileSync(poopPath, JSON.stringify(samplePoops, null, 2), 'utf-8')
    store.load()
    expect(store.get()).toEqual(samplePoops)
  })

  describe('向下兼容迁移 (One-time Migration)', () => {
    it('poops.json 不存在且 config.json 中有非空 poops 时：自动导入并立即持久化至 poops.json，同时清理旧 config 中的 poops 字段', () => {
      const legacyConfig = {
        workEndTime: '18:30',
        skinId: 'orange',
        poops: samplePoops
      }
      writeFileSync(configPath, JSON.stringify(legacyConfig, null, 2), 'utf-8')

      // load 执行迁移
      const loaded = store.load()
      expect(loaded).toEqual(samplePoops)
      expect(store.get()).toEqual(samplePoops)

      // poops.json 应已被持久化
      expect(existsSync(poopPath)).toBe(true)
      const savedPoops = JSON.parse(readFileSync(poopPath, 'utf-8'))
      expect(savedPoops).toEqual(samplePoops)

      // config.json 中的 poops 字段应被清理，其余偏好字段保持完好
      const updatedConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
      expect(updatedConfig.workEndTime).toBe('18:30')
      expect(updatedConfig.skinId).toBe('orange')
      expect(updatedConfig.poops).toBeUndefined()
    })

    it('poops.json 不存在但 config.json 中的 poops 为空数组时：不触发迁移写入，内存保持 []，并清理旧 config 中的 poops 字段', () => {
      const legacyConfig = {
        workEndTime: '18:00',
        skinId: 'blue',
        poops: []
      }
      writeFileSync(configPath, JSON.stringify(legacyConfig, null, 2), 'utf-8')

      const loaded = store.load()
      expect(loaded).toEqual([])
      expect(store.get()).toEqual([])
      // 空数组不落盘 poops.json
      expect(existsSync(poopPath)).toBe(false)

      // config.json 中的残留 poops: [] 必须彻底清理，保留其余字段
      const updatedConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
      expect(updatedConfig.workEndTime).toBe('18:00')
      expect(updatedConfig.skinId).toBe('blue')
      expect(updatedConfig.poops).toBeUndefined()
    })

    it('poops.json 已存在时：即便 config.json 仍有残留 poops，也绝不覆盖现有 poops.json', () => {
      const currentPoops: Poop[] = [{ id: 'current', x: 1, y: 1 }]
      const legacyPoops: Poop[] = [{ id: 'legacy', x: 99, y: 99 }]

      writeFileSync(poopPath, JSON.stringify(currentPoops, null, 2), 'utf-8')
      writeFileSync(configPath, JSON.stringify({ workEndTime: '18:00', poops: legacyPoops }), 'utf-8')

      store.load()
      expect(store.get()).toEqual(currentPoops)

      const savedPoops = JSON.parse(readFileSync(poopPath, 'utf-8'))
      expect(savedPoops).toEqual(currentPoops)
    })

    it('config.json 格式损坏时：迁移静默容错跳过，回退空数组且不崩溃', () => {
      writeFileSync(configPath, '{bad-json', 'utf-8')

      store.load()
      expect(store.get()).toEqual([])
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('createPoopStore 实例与 poopStore 导出规范', () => {
    it('poopStore 单例具备标准的 PoopStore 接口 (load, get, set, flush) 且不泄露测试方法', () => {
      expect(typeof poopStore.load).toBe('function')
      expect(typeof poopStore.get).toBe('function')
      expect(typeof poopStore.set).toBe('function')
      expect(typeof poopStore.flush).toBe('function')
      expect((poopStore as unknown as Record<string, unknown>).resetForTesting).toBeUndefined()
    })

    it('createPoopStore 可以创建完全隔离的独立存储实例', () => {
      const dir2 = mkdtempSync(join(tmpdir(), 'fish-poop-test-instance-'))
      try {
        const customStore = createPoopStore({ storageDir: dir2, debounceMs: 200 })
        customStore.set([{ id: 'custom-1', x: 5, y: 5 }])
        expect(customStore.get()).toEqual([{ id: 'custom-1', x: 5, y: 5 }])
        expect(store.get()).toEqual([]) // 隔离实例不受影响

        vi.advanceTimersByTime(200)
        expect(existsSync(join(dir2, 'poops.json'))).toBe(true)
      } finally {
        rmSync(dir2, { recursive: true, force: true })
      }
    })

    it('createPoopStore 传入已存在数据的目录时，首次 get() 自动加载就绪', () => {
      const dir2 = mkdtempSync(join(tmpdir(), 'fish-poop-test-autoload-'))
      try {
        writeFileSync(join(dir2, 'poops.json'), JSON.stringify(samplePoops), 'utf-8')
        const customStore = createPoopStore({ storageDir: dir2 })
        expect(customStore.get()).toEqual(samplePoops)
      } finally {
        rmSync(dir2, { recursive: true, force: true })
      }
    })

    it('支持通过 { storageDir, configPath } 显式隔离实例并在 config.json 包含 poops: [] 时彻底清理旧字段', () => {
      const testDir = mkdtempSync(join(tmpdir(), 'fish-poop-test-isolated-'))
      try {
        const customConfig = join(testDir, 'legacy.json')
        writeFileSync(customConfig, JSON.stringify({ windowX: 50, poops: [] }), 'utf-8')
        const customStore = createPoopStore({ storageDir: testDir, configPath: customConfig })

        expect(customStore.get()).toEqual([])
        expect(existsSync(join(testDir, 'poops.json'))).toBe(false)
        const updated = JSON.parse(readFileSync(customConfig, 'utf-8'))
        expect(updated.windowX).toBe(50)
        expect(updated.poops).toBeUndefined()
      } finally {
        rmSync(testDir, { recursive: true, force: true })
      }
    })
  })
})
