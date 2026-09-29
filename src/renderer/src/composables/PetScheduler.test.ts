import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PetScheduler } from './PetScheduler'

describe('PetScheduler', () => {
  let scheduler: PetScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new PetScheduler()
  })

  afterEach(() => {
    scheduler.cancelAll()
    vi.useRealTimers()
  })

  it('after：到点触发回调', () => {
    const fn = vi.fn()
    scheduler.after('msg', 1000, fn)
    vi.advanceTimersByTime(999)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('every：周期重复触发', () => {
    const fn = vi.fn()
    scheduler.every('tick', 1000, fn)
    vi.advanceTimersByTime(3500)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('同名 after 替换挂起中的旧定时器', () => {
    const first = vi.fn()
    const second = vi.fn()
    scheduler.after('msg', 1000, first)
    scheduler.after('msg', 2000, second)
    vi.advanceTimersByTime(2000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('cancel：取消后不再触发；未知名称是 no-op', () => {
    const fn = vi.fn()
    scheduler.after('msg', 1000, fn)
    scheduler.cancel('msg')
    scheduler.cancel('不存在') // 不应抛错
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('回归：cancelAll 后任何回调都不得触发', () => {
    const once = vi.fn()
    const repeated = vi.fn()
    scheduler.after('msg', 1000, once)
    scheduler.every('tick', 500, repeated)
    scheduler.cancelAll()
    vi.advanceTimersByTime(10000)
    expect(once).not.toHaveBeenCalled()
    expect(repeated).not.toHaveBeenCalled()
  })

  it('自调度链：回调内同名重挂可延续，cancel 可终止整条链', () => {
    let count = 0
    const chain = () => {
      count++
      scheduler.after('chain', 1000, chain)
    }
    scheduler.after('chain', 1000, chain)

    vi.advanceTimersByTime(5000)
    expect(count).toBe(5)

    scheduler.cancel('chain')
    vi.advanceTimersByTime(10000)
    expect(count).toBe(5)
  })

  it('every 可被同名替换', () => {
    const slow = vi.fn()
    const fast = vi.fn()
    scheduler.every('tick', 1000, slow)
    vi.advanceTimersByTime(1000)
    scheduler.every('tick', 100, fast)
    vi.advanceTimersByTime(1000)
    expect(slow).toHaveBeenCalledTimes(1)
    expect(fast).toHaveBeenCalledTimes(10)
  })
})
