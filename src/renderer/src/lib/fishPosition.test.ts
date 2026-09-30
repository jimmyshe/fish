import { describe, expect, it } from 'vitest'
import {
  clampFishPosition,
  FISH_CONTAINER_HEIGHT,
  FISH_CONTAINER_WIDTH,
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
