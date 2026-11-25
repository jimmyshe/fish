export type AchievementId =
  | 'scoop-1'
  | 'scoop-10'
  | 'scoop-100'
  | 'tap-50'
  | 'water-5'
  | 'skin-3'
  | 'overwork-5'
  | 'feed-1'
  | 'feed-10'
  | 'wake-up-snack'
  | 'rainbow-combo'
  | 'scared-poop'
  | 'sleep-poop'
  | 'poop-hoarder'
  | 'off-work-rush'
  | 'late-overtime'
  | 'weekend-worker'

export interface AchievementDef {
  id: AchievementId
  icon: string
  title: string
  hint: string
  description: string
  hidden: boolean
  target: number
}

export interface AchievementStats {
  scoopCount: number
  tapCount: number
  waterCount: number
  overworkCount: number
  fedCount: number
  visitedSkins: string[]
}

export interface AchievementState {
  stats: AchievementStats
  unlocked: Partial<Record<AchievementId, number>>
}

export type AchievementEvent =
  | { type: 'scoop' }
  | { type: 'tap' }
  | { type: 'water' }
  | { type: 'overwork' }
  | { type: 'feed'; placedWhileSleeping: boolean }
  | { type: 'skin'; speciesId: string; paletteId: string }
  | { type: 'rainbow' }
  | { type: 'scared-poop' }
  | { type: 'sleep-poop' }
  | { type: 'poop-count'; count: number }
  | { type: 'time-check'; remainingMinutes: number; hour: number; dayOfWeek?: number }

export interface ApplyAchievementResult {
  state: AchievementState
  newlyUnlocked: AchievementDef[]
  changed: boolean
}

export const ACHIEVEMENT_LIST: readonly AchievementDef[] = [
  {
    id: 'scoop-1',
    icon: '🧹',
    title: '初任铲屎官',
    hint: '清理 1 次小鱼留下的便便',
    description: '人生第一铲，桌面环保卫士的起点。',
    hidden: false,
    target: 1
  },
  {
    id: 'scoop-10',
    icon: '🪣',
    title: '熟练清洁工',
    hint: '累计清理 10 次便便',
    description: '手法愈发娴熟，小鱼对你的服务很满意。',
    hidden: false,
    target: 10
  },
  {
    id: 'scoop-100',
    icon: '👑',
    title: '传奇铲屎大帝',
    hint: '累计清理 100 次便便',
    description: '百铲成钢！这片屏幕的卫生由你全权统治。',
    hidden: false,
    target: 100
  },
  {
    id: 'tap-50',
    icon: '👆',
    title: '指尖陀螺',
    hint: '累计轻戳小鱼 50 次',
    description: '班是一点没上，鱼倒是快被你盘包浆了。',
    hidden: false,
    target: 50
  },
  {
    id: 'water-5',
    icon: '💧',
    title: '吨吨吨达人',
    hint: '响应 5 次喝水提醒',
    description: '摸鱼不忘补水，打工人养生标兵！',
    hidden: false,
    target: 5
  },
  {
    id: 'skin-3',
    icon: '🎨',
    title: '海底穿搭博主',
    hint: '尝试 3 种不同的物种或调色方案',
    description: '换个造型，换种摸鱼心情。',
    hidden: false,
    target: 3
  },
  {
    id: 'overwork-5',
    icon: '🔥',
    title: '一级退堂鼓选手',
    hint: '累计触发 5 次牛马搬砖劝退提醒',
    description: '工作再忙也要摸鱼，鱼都看不下去你的手速了。',
    hidden: false,
    target: 5
  },
  {
    id: 'feed-1',
    icon: '🍽️',
    title: '开饭啦',
    hint: '让小鱼吃下第一粒鱼粮',
    description: '吧唧！小鱼尝到了你投喂的第一口。',
    hidden: false,
    target: 1
  },
  {
    id: 'feed-10',
    icon: '🐟',
    title: '投喂熟客',
    hint: '让小鱼累计吃下 10 粒鱼粮',
    description: '第十粒鱼粮下肚，小鱼吃了个痛快。',
    hidden: false,
    target: 10
  },
  {
    id: 'rainbow-combo',
    icon: '🌈',
    title: '传说中的彩鱼',
    hint: '听说短时间内疯狂连击鱼身会有奇迹发生',
    description: '手速突破天际，召唤出全屏七彩祥瑞！',
    hidden: true,
    target: 1
  },
  {
    id: 'scared-poop',
    icon: '😱',
    title: '吓出翔了',
    hint: '鼠标突然袭击时，小鱼可能会控制不住括约肌',
    description: '这一晃不仅吓红了鱼，还顺便完成了排泄。',
    hidden: true,
    target: 1
  },
  {
    id: 'sleep-poop',
    icon: '💤',
    title: '梦游仙境',
    hint: '嘘……睡着的时候好像也拉了什么出来',
    description: '睡得正香突然一身轻松，深藏功与名。',
    hidden: true,
    target: 1
  },
  {
    id: 'poop-hoarder',
    icon: '💩',
    title: '屎山架构师',
    hint: '如果对桌面的便便放任不管，会堆起一座山……',
    description: '只要我不铲，这就不是 Bug，是底层架构！',
    hidden: true,
    target: 1
  },
  {
    id: 'off-work-rush',
    icon: '🏃',
    title: '准点跑路',
    hint: '撑到下班铃响的那一刻',
    description: '到点下班绝不恋战，我先撤了各位！',
    hidden: true,
    target: 1
  },
  {
    id: 'late-overtime',
    icon: '🌙',
    title: '深夜大怨种',
    hint: '夜深了，怎么还有人在工位上发光',
    description: '深夜十点还在工位，鱼都替你流泪。',
    hidden: true,
    target: 1
  },
  {
    id: 'weekend-worker',
    icon: '🐂',
    title: '周末大怨种',
    hint: '不会有人周末还在工位上打开我吧……',
    description: '周末还在电脑前发光发热，感动中国打工人！',
    hidden: true,
    target: 1
  },
  {
    id: 'wake-up-snack',
    icon: '🌤️',
    title: '醒来有饭',
    hint: '小鱼睡醒时，桌面上会不会有份惊喜？',
    description: '睡觉时留下的鱼粮，醒来刚好吃上一口。',
    hidden: true,
    target: 1
  }
] as const

const ACHIEVEMENT_MAP = new Map<AchievementId, AchievementDef>(
  ACHIEVEMENT_LIST.map((def) => [def.id, def])
)

const ACHIEVEMENT_INDEX = new Map<AchievementId, number>(
  ACHIEVEMENT_LIST.map((def, idx) => [def.id, idx])
)

export function createDefaultAchievementState(): AchievementState {
  return {
    stats: {
      scoopCount: 0,
      tapCount: 0,
      waterCount: 0,
      overworkCount: 0,
      fedCount: 0,
      visitedSkins: ['classic-fish:default']
    },
    unlocked: {}
  }
}

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

export function normalizeAchievementState(raw: unknown): AchievementState {
  const defaults = createDefaultAchievementState()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults
  }

  const obj = raw as Record<string, unknown>
  const rawStats =
    obj.stats && typeof obj.stats === 'object' && !Array.isArray(obj.stats)
      ? (obj.stats as Record<string, unknown>)
      : {}

  const visitedSkins = Array.isArray(rawStats.visitedSkins)
    ? Array.from(
        new Set(
          rawStats.visitedSkins.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        )
      )
    : defaults.stats.visitedSkins

  const unlocked: Partial<Record<AchievementId, number>> = {}
  if (obj.unlocked && typeof obj.unlocked === 'object' && !Array.isArray(obj.unlocked)) {
    for (const [key, val] of Object.entries(obj.unlocked as Record<string, unknown>)) {
      const id = key as AchievementId
      if (ACHIEVEMENT_MAP.has(id) && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        unlocked[id] = val
      }
    }
  }

  return {
    stats: {
      scoopCount: toNonNegativeInt(rawStats.scoopCount),
      tapCount: toNonNegativeInt(rawStats.tapCount),
      waterCount: toNonNegativeInt(rawStats.waterCount),
      overworkCount: toNonNegativeInt(rawStats.overworkCount),
      fedCount: toNonNegativeInt(rawStats.fedCount),
      visitedSkins: visitedSkins.length > 0 ? visitedSkins : defaults.stats.visitedSkins
    },
    unlocked
  }
}

export function applyAchievementEvents(
  state: AchievementState,
  events: AchievementEvent | AchievementEvent[],
  nowMs = Date.now()
): ApplyAchievementResult {
  const eventList = Array.isArray(events) ? events : [events]
  if (eventList.length === 0) {
    return { state, newlyUnlocked: [], changed: false }
  }

  const nextStats: AchievementStats = {
    scoopCount: state.stats.scoopCount,
    tapCount: state.stats.tapCount,
    waterCount: state.stats.waterCount,
    overworkCount: state.stats.overworkCount,
    fedCount: state.stats.fedCount,
    visitedSkins: [...state.stats.visitedSkins]
  }
  const nextUnlocked: Partial<Record<AchievementId, number>> = { ...state.unlocked }
  const newlyUnlocked: AchievementDef[] = []
  let changed = false

  function unlock(id: AchievementId): void {
    if (nextUnlocked[id] !== undefined) return
    const def = ACHIEVEMENT_MAP.get(id)
    if (!def) return
    nextUnlocked[id] = nowMs
    newlyUnlocked.push(def)
    changed = true
  }

  for (const ev of eventList) {
    switch (ev.type) {
      case 'scoop': {
        nextStats.scoopCount += 1
        changed = true
        if (nextStats.scoopCount >= 1) unlock('scoop-1')
        if (nextStats.scoopCount >= 10) unlock('scoop-10')
        if (nextStats.scoopCount >= 100) unlock('scoop-100')
        break
      }
      case 'tap': {
        nextStats.tapCount += 1
        changed = true
        if (nextStats.tapCount >= 50) unlock('tap-50')
        break
      }
      case 'water': {
        nextStats.waterCount += 1
        changed = true
        if (nextStats.waterCount >= 5) unlock('water-5')
        break
      }
      case 'overwork': {
        nextStats.overworkCount += 1
        changed = true
        if (nextStats.overworkCount >= 5) unlock('overwork-5')
        break
      }
      case 'feed': {
        nextStats.fedCount += 1
        changed = true
        if (nextStats.fedCount >= 1) unlock('feed-1')
        if (nextStats.fedCount >= 10) unlock('feed-10')
        if (ev.placedWhileSleeping) unlock('wake-up-snack')
        break
      }
      case 'skin': {
        if (ev.speciesId && ev.paletteId) {
          const key = `${ev.speciesId}:${ev.paletteId}`
          if (!nextStats.visitedSkins.includes(key)) {
            nextStats.visitedSkins.push(key)
            changed = true
          }
          if (nextStats.visitedSkins.length >= 3) {
            unlock('skin-3')
          }
        }
        break
      }
      case 'rainbow': {
        unlock('rainbow-combo')
        break
      }
      case 'scared-poop': {
        unlock('scared-poop')
        break
      }
      case 'sleep-poop': {
        unlock('sleep-poop')
        break
      }
      case 'poop-count': {
        if (ev.count >= 5) {
          unlock('poop-hoarder')
        }
        break
      }
      case 'time-check': {
        if (ev.remainingMinutes <= 0 && ev.remainingMinutes >= -5) {
          unlock('off-work-rush')
        }
        if ((ev.hour >= 22 && ev.remainingMinutes < 0) || ev.hour < 5) {
          unlock('late-overtime')
        }
        if (ev.dayOfWeek === 0 || ev.dayOfWeek === 6) {
          unlock('weekend-worker')
        }
        break
      }
    }
  }

  if (!changed) {
    return { state, newlyUnlocked: [], changed: false }
  }

  return {
    state: {
      stats: nextStats,
      unlocked: nextUnlocked
    },
    newlyUnlocked,
    changed: true
  }
}

export function getAchievementProgress(
  state: AchievementState,
  id: AchievementId
): { current: number; target: number } {
  const def = ACHIEVEMENT_MAP.get(id)
  if (!def) return { current: 0, target: 1 }
  if (state.unlocked[id] !== undefined) {
    return { current: def.target, target: def.target }
  }

  let raw = 0
  switch (id) {
    case 'scoop-1':
    case 'scoop-10':
    case 'scoop-100':
      raw = state.stats.scoopCount
      break
    case 'tap-50':
      raw = state.stats.tapCount
      break
    case 'water-5':
      raw = state.stats.waterCount
      break
    case 'skin-3':
      raw = state.stats.visitedSkins.length
      break
    case 'overwork-5':
      raw = state.stats.overworkCount
      break
    case 'feed-1':
    case 'feed-10':
      raw = state.stats.fedCount
      break
    default:
      raw = 0
      break
  }

  return {
    current: Math.min(raw, def.target),
    target: def.target
  }
}

export function formatAchievementUnlockMessage(newlyUnlocked: AchievementDef[]): string {
  if (newlyUnlocked.length === 0) return ''
  if (newlyUnlocked.length === 1) {
    return `🏅 解锁成就：【${newlyUnlocked[0].title}】`
  }
  return `🏅 解锁【${newlyUnlocked[0].title}】等 ${newlyUnlocked.length} 项成就！`
}

export function sortAchievementsForDisplay(state: AchievementState): AchievementDef[] {
  return [...ACHIEVEMENT_LIST].sort((a, b) => {
    const unlockedA = state.unlocked[a.id]
    const unlockedB = state.unlocked[b.id]

    if (unlockedA !== undefined && unlockedB !== undefined) {
      if (unlockedB !== unlockedA) return unlockedB - unlockedA
      return (ACHIEVEMENT_INDEX.get(a.id) ?? 0) - (ACHIEVEMENT_INDEX.get(b.id) ?? 0)
    }
    if (unlockedA !== undefined) return -1
    if (unlockedB !== undefined) return 1

    if (a.hidden !== b.hidden) {
      return a.hidden ? 1 : -1
    }
    return (ACHIEVEMENT_INDEX.get(a.id) ?? 0) - (ACHIEVEMENT_INDEX.get(b.id) ?? 0)
  })
}
