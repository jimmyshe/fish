export type PetMood = 'sad' | 'nervous' | 'happy' | 'normal'

export interface PetTimeInfo {
  remainingMinutes: number
  mood: PetMood
  message: string
  subMessage: string
}

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE

/**
 * 时间推导模块：由「当前时间 + 下班时间」推导心情与气泡文案。
 * 心情阈值表与文案分级全部在实现内部，调用方只见一个函数。
 */
export function petTime(now: Date, workEndTime: string): PetTimeInfo {
  const [endHour, endMin] = workEndTime.split(':').map(Number)
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

  let subMessage: string
  if (remainingMinutes < 0) subMessage = '摸鱼人，快跑！'
  else if (remainingMinutes === 0) subMessage = '收拾东西！'
  else if (remainingMinutes <= 10) subMessage = '马上下班！冲！'
  else if (remainingMinutes <= 30) subMessage = '准备收工啦~'
  else if (remainingMinutes <= 60) subMessage = '快了快了...'
  else if (remainingMinutes <= 120) subMessage = '继续加油 ~'
  else subMessage = '好好摸鱼吧'

  return { remainingMinutes, mood, message, subMessage }
}
