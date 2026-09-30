import { describe, expect, it } from 'vitest'
import {
  avoidanceForce,
  computeFacing,
  dashDirection,
  edgeForce,
  integrateVelocity,
  shouldScare,
  stepWanderAngle
} from './fishMotion'

describe('avoidanceForce', () => {
  const center = { x: 500, y: 400 }

  it('鼠标无数据：零向量', () => {
    expect(avoidanceForce(center, null, 200, 500)).toEqual({ x: 0, y: 0 })
  })

  it('鼠标在半径外：零向量', () => {
    expect(avoidanceForce(center, { x: 500 + 200, y: 400 }, 200, 500)).toEqual({ x: 0, y: 0 })
  })

  it('力方向指向远离鼠标', () => {
    const f = avoidanceForce(center, { x: 600, y: 400 }, 200, 500)
    expect(f.x).toBeLessThan(0)
    expect(f.y).toBe(0)
  })

  it('力大小随距离线性衰减：半径一半处为最大强度的一半', () => {
    const f = avoidanceForce(center, { x: 600, y: 400 }, 200, 500)
    expect(Math.hypot(f.x, f.y)).toBeCloseTo(250)
  })

  it('鼠标恰在中心（方向不定）：零向量，避免除零', () => {
    expect(avoidanceForce(center, center, 200, 500)).toEqual({ x: 0, y: 0 })
  })
})

describe('edgeForce', () => {
  const container = { x: 320, y: 200 }
  const screen = { x: 1920, y: 1080 }

  it('屏幕中部：零向量', () => {
    expect(edgeForce({ x: 800, y: 400 }, container, screen, 120, 600)).toEqual({ x: 0, y: 0 })
  })

  it('贴左边缘：向右推，越贴边越强', () => {
    const f = edgeForce({ x: 0, y: 400 }, container, screen, 120, 600)
    expect(f.x).toBeCloseTo(600)
    const half = edgeForce({ x: 60, y: 400 }, container, screen, 120, 600)
    expect(half.x).toBeCloseTo(300)
  })

  it('贴右边缘：向左推', () => {
    const f = edgeForce({ x: 1920 - 320, y: 400 }, container, screen, 120, 600)
    expect(f.x).toBeCloseTo(-600)
  })

  it('四角同时受两个方向的斥力', () => {
    const f = edgeForce({ x: 0, y: 0 }, container, screen, 120, 600)
    expect(f.x).toBeCloseTo(600)
    expect(f.y).toBeCloseTo(600)
  })
})

describe('integrateVelocity', () => {
  it('速度朝目标速度平滑转向', () => {
    const v = integrateVelocity({ x: 0, y: 0 }, { x: 60, y: 0 }, [], 0.033, 150, 3)
    expect(v.x).toBeGreaterThan(0)
    expect(v.x).toBeLessThan(60)
    expect(v.y).toBe(0)
  })

  it('叠加转向力改变速度', () => {
    const v = integrateVelocity({ x: 0, y: 0 }, { x: 0, y: 0 }, [{ x: 100, y: 0 }], 0.1, 150, 3)
    expect(v.x).toBeCloseTo(10)
  })

  it('速度超过上限时截断到上限', () => {
    const v = integrateVelocity({ x: 0, y: 0 }, { x: 1000, y: 0 }, [], 10, 150, 3)
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(150)
  })
})

describe('computeFacing', () => {
  it('水平速度向左：翻转', () => {
    expect(computeFacing(-10, 1, 5)).toBe(-1)
  })

  it('水平速度向右：不翻转', () => {
    expect(computeFacing(10, -1, 5)).toBe(1)
  })

  it('死区内：保持上次朝向', () => {
    expect(computeFacing(3, -1, 5)).toBe(-1)
    expect(computeFacing(-3, 1, 5)).toBe(1)
  })
})

describe('dashDirection', () => {
  it('远离鼠标方向的单位向量', () => {
    const d = dashDirection({ x: 500, y: 400 }, { x: 560, y: 400 })
    expect(d.x).toBeCloseTo(-1)
    expect(d.y).toBeCloseTo(0)
  })

  it('鼠标无数据：随机方向且长度为 1', () => {
    const d = dashDirection({ x: 500, y: 400 }, null, () => 0)
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1)
  })

  it('鼠标恰在中心：随机方向且长度为 1', () => {
    const d = dashDirection({ x: 500, y: 400 }, { x: 500, y: 400 }, () => 0.25)
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1)
  })
})

describe('stepWanderAngle', () => {
  it('rand=0.5 时角度不变', () => {
    expect(stepWanderAngle(1, 0.15, () => 0.5)).toBe(1)
  })

  it('rand=1 时向正方向抖动半个 jitter', () => {
    expect(stepWanderAngle(1, 0.15, () => 1)).toBeCloseTo(1 + 0.075)
  })
})

describe('shouldScare', () => {
  it('又快又近：触发', () => {
    expect(shouldScare(3, 50, 80, 2.5)).toBe(true)
  })

  it('近但慢：只是推开，不惊吓', () => {
    expect(shouldScare(1, 50, 80, 2.5)).toBe(false)
  })

  it('快但远：不算', () => {
    expect(shouldScare(3, 120, 80, 2.5)).toBe(false)
  })
})
