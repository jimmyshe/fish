import { describe, expect, it } from 'vitest'
import {
  clampFishPosition,
  FISH_CONTAINER_HEIGHT,
  FISH_CONTAINER_WIDTH,
  isInFishArea,
  resolveInitialFishPosition
} from './fishPosition'

describe('resolveInitialFishPosition', () => {
  it('配置值有效（≥0）：沿用持久化位置', () => {
    expect(resolveInitialFishPosition(500, 300, 1920, 1080)).toEqual({ x: 500, y: 300 })
  })

  it('配置值无效（-1）：落回屏幕右下角附近', () => {
    expect(resolveInitialFishPosition(-1, -1, 1920, 1080)).toEqual({ x: 1580, y: 860 })
  })

  it('持久化位置超出当前屏幕（换了显示器）：收敛回屏幕内', () => {
    expect(resolveInitialFishPosition(3000, 2000, 1920, 1080)).toEqual({
      x: 1920 - FISH_CONTAINER_WIDTH,
      y: 1080 - FISH_CONTAINER_HEIGHT
    })
  })
})

describe('clampFishPosition', () => {
  it('屏幕内的位置原样保留', () => {
    expect(clampFishPosition(100, 100, 1920, 1080)).toEqual({ x: 100, y: 100 })
  })

  it('越界位置收敛到屏幕边缘（容器整体不跑出屏幕）', () => {
    expect(clampFishPosition(-50, -10, 1920, 1080)).toEqual({ x: 0, y: 0 })
    expect(clampFishPosition(9999, 9999, 1920, 1080)).toEqual({
      x: 1920 - FISH_CONTAINER_WIDTH,
      y: 1080 - FISH_CONTAINER_HEIGHT
    })
  })
})

describe('isInFishArea', () => {
  const pos = { x: 1000, y: 600 }

  it('容器范围内的坐标算在鱼附近', () => {
    expect(isInFishArea(1000, 600, pos)).toBe(true)
    expect(isInFishArea(1000 + FISH_CONTAINER_WIDTH - 1, 600 + FISH_CONTAINER_HEIGHT - 1, pos)).toBe(true)
  })

  it('容器范围外的坐标不算（远处快速移动不应惊吓鱼）', () => {
    expect(isInFishArea(999, 600, pos)).toBe(false)
    expect(isInFishArea(1000 + FISH_CONTAINER_WIDTH, 600, pos)).toBe(false)
    expect(isInFishArea(1000, 600 + FISH_CONTAINER_HEIGHT, pos)).toBe(false)
    expect(isInFishArea(0, 0, pos)).toBe(false)
  })
})
