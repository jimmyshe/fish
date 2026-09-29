import { describe, expect, it } from 'vitest'
import { petTime } from './petTime'

// 统一用 2026-09-29 这一天构造 now，避免跨日歧义
function at(hour: number, minute: number, second = 0): Date {
  return new Date(2026, 8, 29, hour, minute, second)
}

const END = '18:00'

describe('petTime', () => {
  it('四心情区间：normal / happy / nervous / sad', () => {
    expect(petTime(at(12, 0), END).mood).toBe('normal') // 剩 360 分
    expect(petTime(at(16, 0), END).mood).toBe('happy') // 恰好 120 分
    expect(petTime(at(17, 30), END).mood).toBe('nervous') // 恰好 30 分
    expect(petTime(at(19, 0), END).mood).toBe('sad') // 加班
  })

  it('剩余时间文案', () => {
    const near = petTime(at(17, 45), END)
    expect(near.message).toContain('还有')
    expect(near.message).toContain('15')

    const hours = petTime(at(14, 30), END)
    expect(hours.message).toContain('还有')
    expect(hours.message).toContain('3小时')
    expect(hours.message).toContain('30')
  })

  it('整点下班：到点文案', () => {
    const info = petTime(at(18, 0), END)
    expect(info.remainingMinutes).toBe(0)
    expect(info.message).toBe('到点下班啦！')
    expect(info.subMessage).toBe('收拾东西！')
  })

  it('分钟级加班', () => {
    const info = petTime(at(18, 30), END)
    expect(info.remainingMinutes).toBe(-30)
    expect(info.message).toContain('加班')
    expect(info.message).toContain('30')
    expect(info.subMessage).toBe('摸鱼人，快跑！')
  })

  it('小时级加班', () => {
    const info = petTime(at(19, 5), END)
    expect(info.message).toContain('加班')
    expect(info.message).toContain('1小时')
    expect(info.message).toContain('5')
  })

  it('秒数向下取整：17:59:30 视为还剩 0 分钟', () => {
    expect(petTime(at(17, 59, 30), END).remainingMinutes).toBe(0)
  })

  it('提示语分级', () => {
    expect(petTime(at(17, 55), END).subMessage).toBe('马上下班！冲！')
    expect(petTime(at(17, 40), END).subMessage).toBe('准备收工啦~')
    expect(petTime(at(17, 15), END).subMessage).toBe('快了快了...')
    expect(petTime(at(16, 30), END).subMessage).toBe('继续加油 ~')
    expect(petTime(at(9, 0), END).subMessage).toBe('好好摸鱼吧')
  })
})
