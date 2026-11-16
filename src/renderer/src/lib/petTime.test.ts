import { describe, expect, it } from 'vitest'
import { computeSalary, petTime } from './petTime'

// 统一用 2026-09-29（周二）这一天构造 now，避免跨日歧义
function at(hour: number, minute: number, second = 0): Date {
  return new Date(2026, 8, 29, hour, minute, second)
}

function atDay(dayOfMonth: number, hour: number, minute: number, second = 0): Date {
  return new Date(2026, 8, dayOfMonth, hour, minute, second)
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

  it('周历感知：周一、周五与周末专属副文案', () => {
    // 2026-09-28 为周一
    expect(petTime(atDay(28, 10, 0), END).subMessage).toBe('周一综合症…带薪发呆中')
    expect(petTime(atDay(28, 17, 40), END).subMessage).toBe('准备收工啦~')

    // 2026-10-02 为周五（9 月 30 日后两天 -> 10 月 2 日为 dayOfMonth = 32）
    expect(petTime(atDay(32, 16, 30), END).subMessage).toBe('🎉 周五啦！准备迎接周末～')
    expect(petTime(atDay(32, 17, 45), END).subMessage).toBe('🎉 周五冲刺，马上放假！')
    expect(petTime(atDay(32, 18, 0), END).subMessage).toBe('🎉 周五到点！周末愉快！')

    // 2026-09-26 为周六，2026-09-27 为周日
    expect(petTime(atDay(26, 14, 0), END).subMessage).toBe('周末还在工位？快去享受人生！')
    expect(petTime(atDay(27, 18, 0), END).subMessage).toBe('周末值班结束，快跑！')
    expect(petTime(atDay(27, 19, 0), END).subMessage).toBe('周末还加班？大怨种快跑！')
  })
})

describe('computeSalary', () => {
  it('开工前显示未开工且金额为 ¥0.00', () => {
    const info = computeSalary(at(8, 30), '09:00', '18:00', 200)
    expect(info).toEqual({
      status: 'before-work',
      earned: 0,
      formattedEarned: '¥0.00',
      badgeText: '💰 今日窝囊费 ¥0.00 · 未开工'
    })
  })

  it('工时内按秒线性比例累加窝囊费', () => {
    // 09:00 ~ 18:00 共 9 小时，13:30 恰好过半
    const half = computeSalary(at(13, 30), '09:00', '18:00', 200)
    expect(half).toEqual({
      status: 'working',
      earned: 100,
      formattedEarned: '¥100.00',
      badgeText: '💰 今日窝囊费 ¥100.00'
    })

    // 12:00 为 1/3 工时，向下取整到分
    const third = computeSalary(at(12, 0), '09:00', '18:00', 200)
    expect(third.earned).toBe(66.66)
    expect(third.badgeText).toBe('💰 今日窝囊费 ¥66.66')
  })

  it('到点及加班后金额封顶日薪并提示白嫖加班中', () => {
    const onTime = computeSalary(at(18, 0), '09:00', '18:00', 200)
    expect(onTime).toEqual({
      status: 'overtime',
      earned: 200,
      formattedEarned: '¥200.00',
      badgeText: '💰 今日窝囊费 ¥200.00 · 白嫖加班中'
    })

    const late = computeSalary(at(21, 30), '09:00', '18:00', 200)
    expect(late.earned).toBe(200)
    expect(late.badgeText).toBe('💰 今日窝囊费 ¥200.00 · 白嫖加班中')
  })
})
