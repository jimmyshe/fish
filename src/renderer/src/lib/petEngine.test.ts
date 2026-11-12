import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PetEngine, createPetEngine } from './petEngine'
import { PetScheduler } from '../composables/PetScheduler'

describe('PetEngine - 5-level Priority Decision Arbiter (Ticket #6)', () => {
  let scheduler: PetScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new PetScheduler()
  })

  afterEach(() => {
    scheduler.cancelAll()
    vi.useRealTimers()
  })

  describe('Priority Preemption & Snapshot Contract', () => {
    it('defaults to roaming action and roam movement intent', () => {
      const engine = createPetEngine({ scheduler })
      const snapshot = engine.getSnapshot()

      expect(snapshot).toEqual({
        currentAction: 'roaming',
        movementIntent: 'roam',
        isSleeping: false,
        isScared: false,
        isPooping: false,
        isHovered: false,
        isRainbow: false,
        showWaterReminder: false,
      })
    })

    it('dragging pre-empts roaming and endDrag restores roaming', () => {
      const engine = createPetEngine({ scheduler })

      engine.startDrag()
      expect(engine.getSnapshot().currentAction).toBe('dragging')
      expect(engine.getSnapshot().movementIntent).toBe('user-drag')

      engine.endDrag()
      expect(engine.getSnapshot().currentAction).toBe('roaming')
      expect(engine.getSnapshot().movementIntent).toBe('roam')
    })

    it('dragging pre-empts scared and restores scared if scare duration is not finished', () => {
      const engine = createPetEngine({ scheduler })

      engine.triggerScared()
      expect(engine.getSnapshot().isScared).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('scared')
      expect(engine.getSnapshot().movementIntent).toBe('dash')

      // Start drag while scared
      engine.startDrag()
      expect(engine.getSnapshot().currentAction).toBe('dragging')
      expect(engine.getSnapshot().movementIntent).toBe('user-drag')
      expect(engine.getSnapshot().isScared).toBe(true)

      // End drag: still scared until 1800ms timer elapses
      engine.endDrag()
      expect(engine.getSnapshot().currentAction).toBe('scared')
      expect(engine.getSnapshot().movementIntent).toBe('dash')

      vi.advanceTimersByTime(1800)
      expect(engine.getSnapshot().isScared).toBe(false)
      expect(engine.getSnapshot().currentAction).toBe('roaming')
      expect(engine.getSnapshot().movementIntent).toBe('roam')
    })

    it('scared pre-empts sleeping and roaming', () => {
      const engine = createPetEngine({ scheduler })

      // Inactivity 3 min -> falls asleep
      vi.advanceTimersByTime(3 * 60 * 1000)
      expect(engine.getSnapshot().isSleeping).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('sleeping')
      expect(engine.getSnapshot().movementIntent).toBe('paused')

      // Scared interrupts sleeping
      engine.triggerScared()
      expect(engine.getSnapshot().isScared).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('scared')
      expect(engine.getSnapshot().movementIntent).toBe('dash')
    })

    it('dragging overrides pooping straining immediately', () => {
      const engine = createPetEngine({ scheduler })

      engine.triggerPoop()
      expect(engine.getSnapshot().isPooping).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('pooping')
      expect(engine.getSnapshot().movementIntent).toBe('paused')

      engine.startDrag()
      expect(engine.getSnapshot().currentAction).toBe('dragging')
      expect(engine.getSnapshot().movementIntent).toBe('user-drag')
    })
  })

  describe('Poop Branching (Roaming vs Sleeping vs Scared)', () => {
    it('poop while roaming triggers straining for 800ms, then drops poop and returns to roaming', () => {
      const onDropPoop = vi.fn()
      const onShowMessage = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onDropPoop, onShowMessage },
        autoStartTimers: false
      })

      engine.triggerPoop()

      // Enters straining state
      expect(engine.getSnapshot().isPooping).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('pooping')
      expect(engine.getSnapshot().movementIntent).toBe('paused')
      expect(onDropPoop).not.toHaveBeenCalled()

      // Advance 800ms -> finishes straining, drops poop, shows relief msg, resumes roaming
      vi.advanceTimersByTime(800)
      expect(onDropPoop).toHaveBeenCalledTimes(1)
      expect(onShowMessage).toHaveBeenCalledWith(
        expect.stringMatching(/舒服了|别看|……|谁把灯打开/),
        2000
      )
      expect(engine.getSnapshot().isPooping).toBe(false)
      expect(engine.getSnapshot().currentAction).toBe('roaming')
      expect(engine.getSnapshot().movementIntent).toBe('roam')
    })

    it('poop while sleeping drops poop immediately without waking up and without straining animation', () => {
      const onDropPoop = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onDropPoop }
      })

      // Inactivity 3 min -> falls asleep
      vi.advanceTimersByTime(3 * 60 * 1000)
      expect(engine.getSnapshot().isSleeping).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('sleeping')

      // Trigger poop while sleeping
      engine.triggerPoop()

      // Immediately dropped poop
      expect(onDropPoop).toHaveBeenCalledTimes(1)
      // Did NOT enter straining animation
      expect(engine.getSnapshot().isPooping).toBe(false)
      // Did NOT wake up
      expect(engine.getSnapshot().isSleeping).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('sleeping')
      expect(engine.getSnapshot().movementIntent).toBe('paused')
    })

    it('poop while scared drops poop immediately without straining animation', () => {
      const onDropPoop = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onDropPoop },
        autoStartTimers: false,
        poopEnabled: false // disable scare-auto-poop for isolated test
      })

      engine.triggerScared()
      expect(engine.getSnapshot().isScared).toBe(true)
      expect(onDropPoop).not.toHaveBeenCalled()

      // Scheduled poop arrives during scare
      engine.triggerPoop()
      expect(onDropPoop).toHaveBeenCalledTimes(1)
      expect(engine.getSnapshot().isPooping).toBe(false)
      expect(engine.getSnapshot().currentAction).toBe('scared')
      expect(engine.getSnapshot().movementIntent).toBe('dash')
    })

    it('triggerScared drops poop immediately when poopEnabled is true', () => {
      const onDropPoop = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onDropPoop },
        poopEnabled: true
      })

      engine.triggerScared()
      expect(onDropPoop).toHaveBeenCalledTimes(1)
    })

    it('triggerScared does NOT drop poop when poopEnabled is false', () => {
      const onDropPoop = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onDropPoop },
        poopEnabled: false
      })

      engine.triggerScared()
      expect(onDropPoop).not.toHaveBeenCalled()
    })

    it('setPoopEnabled(false) cancels ongoing straining animation and restores roaming', () => {
      const onDropPoop = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onDropPoop },
        autoStartTimers: false
      })

      engine.triggerPoop()
      expect(engine.getSnapshot().isPooping).toBe(true)

      engine.setPoopEnabled(false)
      expect(engine.getSnapshot().isPooping).toBe(false)
      expect(engine.getSnapshot().currentAction).toBe('roaming')

      vi.advanceTimersByTime(800)
      expect(onDropPoop).not.toHaveBeenCalled()
    })
  })

  describe('Decorators & Overlays (Combo, Rainbow, Water Reminder)', () => {
    it('5 clicks within 3s window triggers rainbow mode for 5s', () => {
      const onShowMessage = vi.fn()
      const onSpawnParticles = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onShowMessage, onSpawnParticles }
      })

      // 4 clicks
      for (let i = 0; i < 4; i++) {
        engine.handleClick()
        expect(engine.getSnapshot().isRainbow).toBe(false)
        vi.advanceTimersByTime(500)
      }

      // 5th click triggers rainbow
      engine.handleClick()
      expect(engine.getSnapshot().isRainbow).toBe(true)
      expect(onShowMessage).toHaveBeenCalledWith(
        expect.stringMatching(/🌈 彩虹鱼出现了！！|✨ 传说中的彩鱼！|🎊 隐藏彩蛋解锁！/),
        4000
      )
      expect(onSpawnParticles).toHaveBeenCalledWith(
        ['🌈', '✨', '🎉', '⭐', '💫'],
        6,
        'rainbow'
      )

      // Advance 5s -> rainbow expires
      vi.advanceTimersByTime(5000)
      expect(engine.getSnapshot().isRainbow).toBe(false)
    })

    it('combo counter resets after 3s without clicks', () => {
      const engine = createPetEngine({ scheduler })

      // 4 clicks
      for (let i = 0; i < 4; i++) {
        engine.handleClick()
      }
      expect(engine.getSnapshot().isRainbow).toBe(false)

      // Advance 3s -> combo timer expires
      vi.advanceTimersByTime(3000)

      // 1 click now starts new combo (1x), doesn't trigger rainbow
      engine.handleClick()
      expect(engine.getSnapshot().isRainbow).toBe(false)
    })

    it('water reminder triggers after 45 minutes and confirmWater clears and reschedules', () => {
      const onShowMessage = vi.fn()
      const onSpawnParticles = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onShowMessage, onSpawnParticles }
      })

      expect(engine.getSnapshot().showWaterReminder).toBe(false)

      // Advance 45 minutes
      vi.advanceTimersByTime(45 * 60 * 1000)
      expect(engine.getSnapshot().showWaterReminder).toBe(true)
      expect(onSpawnParticles).toHaveBeenCalledWith(['💧', '💦', '💧'], 4, 'heart')

      // Confirm water
      engine.confirmWater()
      expect(engine.getSnapshot().showWaterReminder).toBe(false)
      expect(onShowMessage).toHaveBeenCalledWith('棒棒！多喝水 💪', 2500)
      expect(onSpawnParticles).toHaveBeenCalledWith(['💧', '✨', '💪', '⭐'], 5, 'rainbow')

      // Next reminder arrives after another 45 minutes
      vi.advanceTimersByTime(45 * 60 * 1000)
      expect(engine.getSnapshot().showWaterReminder).toBe(true)
    })
  })

  describe('Sleep Mode & Inactivity', () => {
    it('inactivity for 3 minutes triggers sleep and periodic Zzz particles', () => {
      const onSpawnParticles = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onSpawnParticles }
      })

      expect(engine.getSnapshot().isSleeping).toBe(false)

      // 2.5 minutes inactivity -> still awake
      vi.advanceTimersByTime(2.5 * 60 * 1000)
      expect(engine.getSnapshot().isSleeping).toBe(false)

      // 3 minutes total -> falls asleep
      vi.advanceTimersByTime(0.5 * 60 * 1000)
      expect(engine.getSnapshot().isSleeping).toBe(true)
      expect(engine.getSnapshot().currentAction).toBe('sleeping')
      expect(engine.getSnapshot().movementIntent).toBe('paused')

      // Periodic Zzz every 1.5s
      vi.advanceTimersByTime(1500)
      expect(onSpawnParticles).toHaveBeenCalledWith(['z', 'Z', 'z'], 1, 'zzz')
    })

    it('mouse activity or click wakes up sleeping pet and resets sleep timer', () => {
      const onShowMessage = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onShowMessage }
      })

      // Fall asleep
      vi.advanceTimersByTime(3 * 60 * 1000)
      expect(engine.getSnapshot().isSleeping).toBe(true)

      // Wake up via activity
      engine.onActivity()
      expect(engine.getSnapshot().isSleeping).toBe(false)
      expect(engine.getSnapshot().currentAction).toBe('roaming')
      expect(engine.getSnapshot().movementIntent).toBe('roam')
      expect(onShowMessage).toHaveBeenCalledWith('呼～被吵醒了...', 2000)

      // 2 minutes later still awake
      vi.advanceTimersByTime(2 * 60 * 1000)
      expect(engine.getSnapshot().isSleeping).toBe(false)
    })
  })

  describe('Lifecycle & Subscriptions', () => {
    it('subscribers are notified when snapshot changes', () => {
      const engine = createPetEngine({ scheduler })
      const listener = vi.fn()
      const unsubscribe = engine.subscribe(listener)

      engine.setHovered(true)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isHovered: true })
      )

      unsubscribe()
      engine.setHovered(false)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('destroy() cancels all scheduled timers', () => {
      const cancelAllSpy = vi.spyOn(scheduler, 'cancelAll')
      const engine = createPetEngine({ scheduler })

      engine.destroy()
      expect(cancelAllSpy).toHaveBeenCalled()
    })
  })
})
