import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { fishCenter } from './fishMotion'
import { POOP, nextPoopDelayMs, poopDropPosition, serializePoops, type Poop } from './poop'

describe('nextPoopDelayMs', () => {
  it('rand=0 时取最小间隔（15 分钟）', () => {
    expect(nextPoopDelayMs(() => 0)).toBe(POOP.MIN_INTERVAL_MS)
  })

  it('rand 趋近 1 时趋近最大间隔（30 分钟）', () => {
    expect(nextPoopDelayMs(() => 0.9999999)).toBeCloseTo(POOP.MAX_INTERVAL_MS, 0)
  })

  it('任意随机数下间隔都落在 [15, 30] 分钟区间内', () => {
    for (const r of [0.1, 0.33, 0.5, 0.77, 0.95]) {
      const delay = nextPoopDelayMs(() => r)
      expect(delay).toBeGreaterThanOrEqual(POOP.MIN_INTERVAL_MS)
      expect(delay).toBeLessThanOrEqual(POOP.MAX_INTERVAL_MS)
    }
  })
})

describe('poopDropPosition', () => {
  const fishPos = { x: 1000, y: 500 }
  const center = fishCenter(fishPos)

  it('鱼朝右（facing=1）时屎落在鱼尾，即中心左侧', () => {
    const p = poopDropPosition(fishPos, 1)
    expect(p.x).toBeLessThan(center.x)
  })

  it('鱼朝左（facing=-1）时屎落在鱼尾，即中心右侧', () => {
    const p = poopDropPosition(fishPos, -1)
    expect(p.x).toBeGreaterThan(center.x)
  })

  it('左右朝向的落点关于鱼中心镜像对称', () => {
    const right = poopDropPosition(fishPos, 1)
    const left = poopDropPosition(fishPos, -1)
    expect(right.x - center.x).toBeCloseTo(-(left.x - center.x))
    expect(right.y).toBe(left.y)
  })

  it('落点在鱼中心下方（屎向下掉）', () => {
    const p = poopDropPosition(fishPos, 1)
    expect(p.y).toBeGreaterThan(center.y)
  })
})

describe('serializePoops', () => {
  it('把响应式屎列表转成纯对象，可结构化克隆（IPC 安全）', () => {
    // 根因回归：Vue 响应式代理直接过 IPC 结构化克隆会抛 DOMException
    const poops = reactive([{ id: 'a', x: 1, y: 2 }]) as Poop[]
    expect(() => structuredClone(poops)).toThrow()

    const plain = serializePoops(poops)
    expect(() => structuredClone(plain)).not.toThrow()
    expect(plain).toEqual([{ id: 'a', x: 1, y: 2 }])
  })

  it('只保留持久化需要的字段', () => {
    const poops = [{ id: 'a', x: 1, y: 2, extra: '不应持久化' } as Poop & { extra: string }]
    expect(serializePoops(poops)).toEqual([{ id: 'a', x: 1, y: 2 }])
  })
})
