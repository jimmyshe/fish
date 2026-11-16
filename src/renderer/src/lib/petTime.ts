export type PetMood = 'sad' | 'nervous' | 'happy' | 'normal'

export interface PetTimeInfo {
  remainingMinutes: number
  mood: PetMood
  message: string
  subMessage: string
}

export type SalaryStatus = 'before-work' | 'working' | 'overtime'

export interface SalaryInfo {
  status: SalaryStatus
  earned: number
  formattedEarned: string
  badgeText: string
}

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const SEC_PER_MINUTE = 60
const SEC_PER_HOUR = 3600

function parseTimeParts(timeStr: string, fallbackHour: number, fallbackMinute: number): [number, number] {
  const [rawH, rawM] = timeStr.split(':').map(Number)
  const h = Number.isFinite(rawH) ? Math.min(Math.max(Math.floor(rawH), 0), 23) : fallbackHour
  const m = Number.isFinite(rawM) ? Math.min(Math.max(Math.floor(rawM), 0), 59) : fallbackMinute
  return [h, m]
}

function resolveDefaultSubMessage(remainingMinutes: number): string {
  if (remainingMinutes < 0) return '摸鱼人，快跑！'
  if (remainingMinutes === 0) return '收拾东西！'
  if (remainingMinutes <= 10) return '马上下班！冲！'
  if (remainingMinutes <= 30) return '准备收工啦~'
  if (remainingMinutes <= 60) return '快了快了...'
  if (remainingMinutes <= 120) return '继续加油 ~'
  return '好好摸鱼吧'
}

function resolveWeeklySubMessage(day: number, remainingMinutes: number): string {
  if (day === 0 || day === 6) {
    if (remainingMinutes < 0) return '周末还加班？大怨种快跑！'
    if (remainingMinutes === 0) return '周末值班结束，快跑！'
    return '周末还在工位？快去享受人生！'
  }
  if (day === 5) {
    if (remainingMinutes === 0) return '🎉 周五到点！周末愉快！'
    if (remainingMinutes > 0 && remainingMinutes <= 30) return '🎉 周五冲刺，马上放假！'
    if (remainingMinutes > 30 && remainingMinutes <= 120) return '🎉 周五啦！准备迎接周末～'
  }
  if (day === 1 && remainingMinutes > 120) {
    return '周一综合症…带薪发呆中'
  }
  return resolveDefaultSubMessage(remainingMinutes)
}

/**
 * 时间推导模块：由「当前时间 + 下班时间」推导心情与气泡文案（含周一/周五/周末周历感知）。
 */
export function petTime(now: Date, workEndTime: string): PetTimeInfo {
  const [endHour, endMin] = parseTimeParts(workEndTime, 18, 0)
  const endMs = endHour * MS_PER_HOUR + endMin * MS_PER_MINUTE
  const nowMs = now.getHours() * MS_PER_HOUR + now.getMinutes() * MS_PER_MINUTE + now.getSeconds() * 1000
  const remainingMinutes = Math.floor((endMs - nowMs) / MS_PER_MINUTE)

  let mood: PetMood
  if (remainingMinutes < 0) mood = 'sad'
  else if (remainingMinutes <= 30) mood = 'nervous'
  else if (remainingMinutes <= 120) mood = 'happy'
  else mood = 'normal'

  let message: string
  if (remainingMinutes < 0) {
    const o = Math.abs(remainingMinutes)
    const h = Math.floor(o / 60), m = o % 60
    message = h > 0 ? `加班 ${h}小时${m > 0 ? m + '分' : ''}了！` : `加班 ${m} 分钟了！`
  } else if (remainingMinutes === 0) {
    message = '到点下班啦！'
  } else {
    const h = Math.floor(remainingMinutes / 60), m = remainingMinutes % 60
    message = h > 0 ? `还有 ${h}小时${m > 0 ? m + '分' : ''}` : `还有 ${m} 分钟`
  }

  const subMessage = resolveWeeklySubMessage(now.getDay(), remainingMinutes)

  return { remainingMinutes, mood, message, subMessage }
}

/**
 * 窝囊费计算纯函数：按当前时间在「上班时间～下班时间」的线性比例累加日薪，
 * 到点后金额封顶并提示无偿加班。
 */
export function computeSalary(
  now: Date,
  workStartTime: string,
  workEndTime: string,
  dailyWage: number
): SalaryInfo {
  const [startHour, startMin] = parseTimeParts(workStartTime, 9, 0)
  const [endHour, endMin] = parseTimeParts(workEndTime, 18, 0)
  const startSec = startHour * SEC_PER_HOUR + startMin * SEC_PER_MINUTE
  const endSec = endHour * SEC_PER_HOUR + endMin * SEC_PER_MINUTE
  const nowSec = now.getHours() * SEC_PER_HOUR + now.getMinutes() * SEC_PER_MINUTE + now.getSeconds()
  const safeWage = Math.max(0, Number.isFinite(dailyWage) ? dailyWage : 0)

  if (nowSec < startSec || (endSec <= startSec && nowSec < endSec)) {
    return {
      status: 'before-work',
      earned: 0,
      formattedEarned: '¥0.00',
      badgeText: '💰 今日窝囊费 ¥0.00 · 未开工'
    }
  }

  if (nowSec >= endSec) {
    const formattedEarned = `¥${safeWage.toFixed(2)}`
    return {
      status: 'overtime',
      earned: safeWage,
      formattedEarned,
      badgeText: `💰 今日窝囊费 ${formattedEarned} · 白嫖加班中`
    }
  }

  const ratio = (nowSec - startSec) / (endSec - startSec)
  const earned = Math.floor(safeWage * ratio * 100 + 1e-9) / 100
  const formattedEarned = `¥${earned.toFixed(2)}`
  return {
    status: 'working',
    earned,
    formattedEarned,
    badgeText: `💰 今日窝囊费 ${formattedEarned}`
  }
}
