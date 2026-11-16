import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENT_LIST,
  applyAchievementEvents,
  createDefaultAchievementState,
  formatAchievementUnlockMessage,
  getAchievementProgress,
  normalizeAchievementState,
  sortAchievementsForDisplay,
  type AchievementEvent
} from './achievements'

describe('achievements domain module', () => {
  it('默认状态包含 1 个初始皮肤组合，12 项成就均未解锁', () => {
    const state = createDefaultAchievementState()
    expect(ACHIEVEMENT_LIST).toHaveLength(12)
    expect(state.stats).toEqual({
      scoopCount: 0,
      tapCount: 0,
      waterCount: 0,
      visitedSkins: ['classic-fish:default']
    })
    expect(state.unlocked).toEqual({})
  })

  it('normalizeAchievementState 容错处理损坏或部分字段缺失的数据', () => {
    expect(normalizeAchievementState(null)).toEqual(createDefaultAchievementState())
    expect(normalizeAchievementState('invalid')).toEqual(createDefaultAchievementState())
    expect(normalizeAchievementState([])).toEqual(createDefaultAchievementState())

    const normalized = normalizeAchievementState({
      stats: {
        scoopCount: -5,
        tapCount: 12.9,
        waterCount: 'bad',
        visitedSkins: ['classic-fish:gold', 'classic-fish:gold', '', 123]
      },
      unlocked: {
        'scoop-1': 1000,
        'unknown-id': 2000,
        'tap-50': 'not-a-number'
      }
    })

    expect(normalized).toEqual({
      stats: {
        scoopCount: 0,
        tapCount: 12,
        waterCount: 0,
        visitedSkins: ['classic-fish:gold']
      },
      unlocked: {
        'scoop-1': 1000
      }
    })
  })

  it('累计铲屎成就：1 / 10 / 100 次依次解锁且不重复触发', () => {
    let state = createDefaultAchievementState()

    const first = applyAchievementEvents(state, { type: 'scoop' }, 1000)
    state = first.state
    expect(first.changed).toBe(true)
    expect(first.newlyUnlocked.map((a) => a.id)).toEqual(['scoop-1'])
    expect(state.unlocked['scoop-1']).toBe(1000)

    const batch9 = applyAchievementEvents(
      state,
      Array.from({ length: 9 }, () => ({ type: 'scoop' }) as AchievementEvent),
      2000
    )
    state = batch9.state
    expect(state.stats.scoopCount).toBe(10)
    expect(batch9.newlyUnlocked.map((a) => a.id)).toEqual(['scoop-10'])

    const batch90 = applyAchievementEvents(
      state,
      Array.from({ length: 90 }, () => ({ type: 'scoop' }) as AchievementEvent),
      3000
    )
    state = batch90.state
    expect(state.stats.scoopCount).toBe(100)
    expect(batch90.newlyUnlocked.map((a) => a.id)).toEqual(['scoop-100'])

    // 再铲一次只增加计数，不重复解锁
    const extra = applyAchievementEvents(state, { type: 'scoop' }, 4000)
    expect(extra.changed).toBe(true)
    expect(extra.newlyUnlocked).toEqual([])
  })

  it('轻戳 50 次、喝水 5 次、皮肤 3 种去重解锁对应普通成就', () => {
    let state = createDefaultAchievementState()

    const taps = applyAchievementEvents(
      state,
      Array.from({ length: 50 }, () => ({ type: 'tap' }) as AchievementEvent),
      100
    )
    state = taps.state
    expect(taps.newlyUnlocked.map((a) => a.id)).toEqual(['tap-50'])

    const waters = applyAchievementEvents(
      state,
      Array.from({ length: 5 }, () => ({ type: 'water' }) as AchievementEvent),
      200
    )
    state = waters.state
    expect(waters.newlyUnlocked.map((a) => a.id)).toEqual(['water-5'])

    // 重复传默认皮肤不变化
    const sameSkin = applyAchievementEvents(
      state,
      { type: 'skin', speciesId: 'classic-fish', paletteId: 'default' },
      300
    )
    expect(sameSkin.changed).toBe(false)
    expect(sameSkin.newlyUnlocked).toEqual([])

    const skin2 = applyAchievementEvents(
      state,
      { type: 'skin', speciesId: 'classic-fish', paletteId: 'sakura' },
      400
    )
    state = skin2.state
    expect(skin2.changed).toBe(true)
    expect(skin2.newlyUnlocked).toEqual([])

    const skin3 = applyAchievementEvents(
      state,
      { type: 'skin', speciesId: 'orca', paletteId: 'default' },
      500
    )
    state = skin3.state
    expect(skin3.newlyUnlocked.map((a) => a.id)).toEqual(['skin-3'])
    expect(state.stats.visitedSkins).toEqual([
      'classic-fish:default',
      'classic-fish:sakura',
      'orca:default'
    ])
  })

  it('隐藏成就触发：rainbow / scared-poop / sleep-poop / poop-count / time-check', () => {
    let state = createDefaultAchievementState()

    const rainbow = applyAchievementEvents(state, { type: 'rainbow' }, 10)
    state = rainbow.state
    expect(rainbow.newlyUnlocked.map((a) => a.id)).toEqual(['rainbow-combo'])

    // 同帧受惊拉第 5 泡屎：两个成就合并返回
    const scaredAndHoard = applyAchievementEvents(
      state,
      [{ type: 'scared-poop' }, { type: 'poop-count', count: 5 }],
      20
    )
    state = scaredAndHoard.state
    expect(scaredAndHoard.newlyUnlocked.map((a) => a.id)).toEqual(['scared-poop', 'poop-hoarder'])

    const sleepPoop = applyAchievementEvents(state, { type: 'sleep-poop' }, 30)
    state = sleepPoop.state
    expect(sleepPoop.newlyUnlocked.map((a) => a.id)).toEqual(['sleep-poop'])

    // 下班跑路窗口：-5 ~ 0 分钟内
    const noRushYet = applyAchievementEvents(
      state,
      { type: 'time-check', remainingMinutes: 1, hour: 17 },
      40
    )
    expect(noRushYet.changed).toBe(false)

    const noRushLate = applyAchievementEvents(
      state,
      { type: 'time-check', remainingMinutes: -6, hour: 18 },
      45
    )
    expect(noRushLate.changed).toBe(false)

    const rush = applyAchievementEvents(
      state,
      { type: 'time-check', remainingMinutes: 0, hour: 18 },
      50
    )
    state = rush.state
    expect(rush.newlyUnlocked.map((a) => a.id)).toEqual(['off-work-rush'])

    // 深夜大怨种：22:00 后且加班，或凌晨 < 5 点
    const notOvertimeAt22 = applyAchievementEvents(
      state,
      { type: 'time-check', remainingMinutes: 10, hour: 22 },
      55
    )
    expect(notOvertimeAt22.changed).toBe(false)

    const lateOvertime = applyAchievementEvents(
      state,
      { type: 'time-check', remainingMinutes: -30, hour: 22 },
      60
    )
    state = lateOvertime.state
    expect(lateOvertime.newlyUnlocked.map((a) => a.id)).toEqual(['late-overtime'])

    // 凌晨时间再次检查不应重复解锁
    const dawnCheck = applyAchievementEvents(
      state,
      { type: 'time-check', remainingMinutes: 600, hour: 2 },
      70
    )
    expect(dawnCheck.changed).toBe(false)
    expect(dawnCheck.newlyUnlocked).toEqual([])
  })

  it('formatAchievementUnlockMessage 支持单条与多项合并文案', () => {
    expect(formatAchievementUnlockMessage([])).toBe('')
    expect(formatAchievementUnlockMessage([ACHIEVEMENT_LIST[0]])).toBe(
      '🏅 解锁成就：【初任铲屎官】'
    )
    expect(formatAchievementUnlockMessage([ACHIEVEMENT_LIST[7], ACHIEVEMENT_LIST[9]])).toBe(
      '🏅 解锁【吓出翔了】等 2 项成就！'
    )
  })

  it('getAchievementProgress 返回封顶进度与排序规则', () => {
    let state = createDefaultAchievementState()
    state = applyAchievementEvents(
      state,
      [{ type: 'scoop' }, { type: 'scoop' }, { type: 'scoop' }],
      100
    ).state
    state = applyAchievementEvents(state, { type: 'rainbow' }, 200).state

    expect(getAchievementProgress(state, 'scoop-1')).toEqual({ current: 1, target: 1 })
    expect(getAchievementProgress(state, 'scoop-10')).toEqual({ current: 3, target: 10 })
    expect(getAchievementProgress(state, 'skin-3')).toEqual({ current: 1, target: 3 })
    expect(getAchievementProgress(state, 'rainbow-combo')).toEqual({ current: 1, target: 1 })
    expect(getAchievementProgress(state, 'sleep-poop')).toEqual({ current: 0, target: 1 })

    const sorted = sortAchievementsForDisplay(state)
    // 已解锁按时间戳倒序排在最前
    expect(sorted[0].id).toBe('rainbow-combo')
    expect(sorted[1].id).toBe('scoop-1')
    // 之后是未解锁的普通成就，再之后是未解锁的隐藏成就
    const remainingIds = sorted.slice(2).map((a) => a.id)
    expect(remainingIds).toEqual([
      'scoop-10',
      'scoop-100',
      'tap-50',
      'water-5',
      'skin-3',
      'scared-poop',
      'sleep-poop',
      'poop-hoarder',
      'off-work-rush',
      'late-overtime'
    ])
  })
})
