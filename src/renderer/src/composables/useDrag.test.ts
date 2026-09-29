import { describe, expect, it } from 'vitest'
import { isTap } from './useDrag'

describe('isTap', () => {
  it('位移小于阈值：点击', () => {
    expect(isTap(0, 0)).toBe(true)
    expect(isTap(4, -3)).toBe(true)
  })

  it('位移等于阈值：拖拽（与原始 < 5 行为一致）', () => {
    expect(isTap(5, 0)).toBe(false)
    expect(isTap(0, -5)).toBe(false)
  })

  it('任一轴向超阈值：拖拽', () => {
    expect(isTap(6, 0)).toBe(false)
    expect(isTap(1, 8)).toBe(false)
  })
})
