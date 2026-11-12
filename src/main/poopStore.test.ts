import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Poop } from '../shared/config'
import { createPoopStore, flush, get, load, poopStore, resetForTesting, set } from './poopStore'

describe('poopStore 模块', () => {
  let dir: string
  let poopPath: string
  let configPath: string
  let warnSpy: ReturnType<typeof vi.spyOn>

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
    resetForTesting(dir)
  })

  afterEach(() => {
    flush()
    resetForTesting()
    vi.useRealTimers()
    warnSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  it('文件不存在：默认返回空数组 []', () => {
    expect(get()).toEqual([])
    expect(existsSync(poopPath)).toBe(false)
  })

  it('损坏或非法的 JSON：安全降级回退为 [] 并记录警告', () => {
    writeFileSync(poopPath, '{invalid-json', 'utf-8')
    load(dir)
    expect(get()).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('JSON 内容非数组结构（如对象或字符串）：安全降级为 [] 并警告', () => {
    writeFileSync(poopPath, JSON.stringify({ not: 'an array' }), 'utf-8')
    load(dir)
    expect(get()).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('set() 立即更新内存状态，去抖 500ms 后落盘', () => {
    set(samplePoops)

    // 立即更新内存
    expect(get()).toEqual(samplePoops)
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
      set([{ id: `p-${i}`, x: i * 10, y: i * 20 }])
    }

    vi.advanceTimersByTime(500)
    const saved = JSON.parse(readFileSync(poopPath, 'utf-8'))
    expect(saved).toEqual([{ id: 'p-9', x: 90, y: 180 }])
  })

  it('flush() 立即同步写入未落盘数据，不等待去抖', () => {
    set(samplePoops)
    expect(existsSync(poopPath)).toBe(false)

    flush()
    expect(existsSync(poopPath)).toBe(true)
    const saved = JSON.parse(readFileSync(poopPath, 'utf-8'))
    expect(saved).toEqual(samplePoops)
  })

  it('正常读取已存在的 poops.json', () => {
    writeFileSync(poopPath, JSON.stringify(samplePoops, null, 2), 'utf-8')
    load(dir)
    expect(get()).toEqual(samplePoops)
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
      const loaded = load(dir)
      expect(loaded).toEqual(samplePoops)
      expect(get()).toEqual(samplePoops)

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

    it('poops.json 不存在但 config.json 中的 poops 为空数组时：不触发迁移写入，内存保持 []', () => {
      writeFileSync(configPath, JSON.stringify({ workEndTime: '18:00', poops: [] }), 'utf-8')

      load(dir)
      expect(get()).toEqual([])
      expect(existsSync(poopPath)).toBe(false)
    })

    it('poops.json 已存在时：即便 config.json 仍有残留 poops，也绝不覆盖现有 poops.json', () => {
      const currentPoops: Poop[] = [{ id: 'current', x: 1, y: 1 }]
      const legacyPoops: Poop[] = [{ id: 'legacy', x: 99, y: 99 }]

      writeFileSync(poopPath, JSON.stringify(currentPoops, null, 2), 'utf-8')
      writeFileSync(configPath, JSON.stringify({ workEndTime: '18:00', poops: legacyPoops }), 'utf-8')

      load(dir)
      expect(get()).toEqual(currentPoops)

      const savedPoops = JSON.parse(readFileSync(poopPath, 'utf-8'))
      expect(savedPoops).toEqual(currentPoops)
    })

    it('config.json 格式损坏时：迁移静默容错跳过，回退空数组且不崩溃', () => {
      writeFileSync(configPath, '{bad-json', 'utf-8')

      load(dir)
      expect(get()).toEqual([])
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('createPoopStore 实例与 poopStore 门面一致性', () => {
    it('poopStore 命名导出与对象门面方法具备相同的引用和行为', () => {
      expect(poopStore.get).toBe(get)
      expect(poopStore.set).toBe(set)
      expect(poopStore.load).toBe(load)
      expect(poopStore.flush).toBe(flush)
      expect(poopStore.resetForTesting).toBe(resetForTesting)
    })

    it('createPoopStore 可以创建完全隔离的独立存储实例', () => {
      const dir2 = mkdtempSync(join(tmpdir(), 'fish-poop-test-instance-'))
      try {
        const customStore = createPoopStore({ customDir: dir2, debounceMs: 200 })
        customStore.set([{ id: 'custom-1', x: 5, y: 5 }])
        expect(customStore.get()).toEqual([{ id: 'custom-1', x: 5, y: 5 }])
        expect(get()).toEqual([]) // 全局单例不受影响

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
        const customStore = createPoopStore({ customDir: dir2 })
        expect(customStore.get()).toEqual(samplePoops)
      } finally {
        rmSync(dir2, { recursive: true, force: true })
      }
    })
  })
})
