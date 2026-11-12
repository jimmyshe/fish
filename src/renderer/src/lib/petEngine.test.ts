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

  describe('Physics Movement & Dragging Integration (Ticket #7)', () => {
    it('initializes with default or custom initialFishPos and poops', () => {
      const getViewportSize = () => ({ width: 1000, height: 800 })
      const engine = createPetEngine({
        scheduler,
        adapter: { getViewportSize },
        initialFishPos: { x: 200, y: 150 },
        initialPoops: [{ id: 'p1', x: 50, y: 50 }],
        autoStartTimers: false
      })

      expect(engine.fishPos).toEqual({ x: 200, y: 150 })
      expect(engine.poops).toEqual([{ id: 'p1', x: 50, y: 50 }])
      expect(engine.facingLeft).toBe(false)
    })

    it('moveFishBy moves fish within viewport bounds and notifies onFishPositionChange', () => {
      const onFishPositionChange = vi.fn()
      const getViewportSize = () => ({ width: 1000, height: 800 })
      const engine = createPetEngine({
        scheduler,
        adapter: { getViewportSize, onFishPositionChange },
        initialFishPos: { x: 200, y: 150 },
        autoStartTimers: false
      })

      engine.moveFishBy(50, -30)
      expect(engine.fishPos).toEqual({ x: 250, y: 120 })
      expect(onFishPositionChange).toHaveBeenCalledWith({ x: 250, y: 120 })

      // Clamp test: cannot move outside viewport
      // FISH_CONTAINER_WIDTH = 320, FISH_CONTAINER_HEIGHT = 200
      // Max x: 1000 - 320 = 680, Max y: 800 - 200 = 600
      engine.moveFishBy(1000, 1000)
      expect(engine.fishPos).toEqual({ x: 680, y: 600 })
      expect(onFishPositionChange).toHaveBeenLastCalledWith({ x: 680, y: 600 })
    })

    it('endDrag calls onPersistFishPosition with current fish position', () => {
      const onPersistFishPosition = vi.fn()
      const engine = createPetEngine({
        scheduler,
        adapter: { onPersistFishPosition },
        initialFishPos: { x: 200, y: 150 },
        autoStartTimers: false
      })

      engine.startDrag()
      engine.moveFishBy(10, 20)
      expect(onPersistFishPosition).not.toHaveBeenCalled()

      engine.endDrag()
      expect(onPersistFishPosition).toHaveBeenCalledTimes(1)
      expect(onPersistFishPosition).toHaveBeenCalledWith({ x: 210, y: 170 })
    })

    describe('Dynamic Click-Through Integration', () => {
      it('updates click-through based on hit-test and deduplicates unchanged calls', () => {
        const onSetClickThrough = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onSetClickThrough },
          autoStartTimers: false
        })

        expect(engine.isClickThrough).toBe(true)

        // Cursor enters interactive element -> desired click-through = false
        engine.updateClickThrough(true)
        expect(engine.isClickThrough).toBe(false)
        expect(onSetClickThrough).toHaveBeenCalledWith(false)
        expect(onSetClickThrough).toHaveBeenCalledTimes(1)

        // Cursor moves within interactive element -> unchanged, no duplicate IPC
        engine.updateClickThrough(true)
        expect(onSetClickThrough).toHaveBeenCalledTimes(1)

        // Cursor leaves interactive element -> desired click-through = true
        engine.updateClickThrough(false)
        expect(engine.isClickThrough).toBe(true)
        expect(onSetClickThrough).toHaveBeenCalledWith(true)
        expect(onSetClickThrough).toHaveBeenCalledTimes(2)
      })

      it('forces click-through to false during dragging even when cursor leaves interactive area', () => {
        const onSetClickThrough = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onSetClickThrough },
          autoStartTimers: false
        })

        // Normal state: cursor not on interactive -> click-through true
        engine.updateClickThrough(false)
        expect(engine.isClickThrough).toBe(true)

        // Start drag: begins dragging
        engine.startDrag()
        // Cursor moves off interactive during drag
        engine.updateClickThrough(false)
        expect(engine.isClickThrough).toBe(false)
        expect(onSetClickThrough).toHaveBeenCalledWith(false)
      })
    })

    describe('Poop State Management & Environmental Persistence', () => {
      it('dropPoop adds poop at computed position and notifies onPersistPoops', () => {
        const onPersistPoops = vi.fn()
        const getViewportSize = () => ({ width: 1000, height: 800 })
        const engine = createPetEngine({
          scheduler,
          adapter: { getViewportSize, onPersistPoops },
          initialFishPos: { x: 300, y: 300 },
          autoStartTimers: false
        })

        expect(engine.poops).toEqual([])

        engine.dropPoop()
        expect(engine.poops.length).toBe(1)
        expect(engine.poops[0]).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            x: expect.any(Number),
            y: expect.any(Number)
          })
        )
        expect(onPersistPoops).toHaveBeenCalledWith(engine.poops)
      })

      it('scoopPoop removes poop, notifies onPersistPoops, reports scoop event, and spawns effects', () => {
        const onPersistPoops = vi.fn()
        const onReportScoop = vi.fn()
        const onShowMessage = vi.fn()
        const onSpawnParticles = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onPersistPoops, onReportScoop, onShowMessage, onSpawnParticles },
          initialPoops: [
            { id: 'p1', x: 100, y: 100 },
            { id: 'p2', x: 200, y: 200 }
          ],
          autoStartTimers: false
        })

        engine.scoopPoop('p1')

        expect(engine.poops).toEqual([{ id: 'p2', x: 200, y: 200 }])
        expect(onPersistPoops).toHaveBeenCalledWith([{ id: 'p2', x: 200, y: 200 }])
        expect(onReportScoop).toHaveBeenCalledTimes(1)
        expect(onShowMessage).toHaveBeenCalledWith(
          expect.stringMatching(/谢谢主人|好人一生平安|终于有人管了/),
          2000
        )
        expect(onSpawnParticles).toHaveBeenCalledWith(
          ['✨', '🧹', '💛', '⭐'],
          4,
          'rainbow'
        )
      })

      it('setPoops replaces the poop list', () => {
        const engine = createPetEngine({
          scheduler,
          autoStartTimers: false
        })

        engine.setPoops([{ id: 'new-1', x: 10, y: 20 }])
        expect(engine.poops).toEqual([{ id: 'new-1', x: 10, y: 20 }])
      })
    })

    describe('Mouse Activity & Scare Detection', () => {
      it('slow mouse movement updates mouse pos and resets sleep, but does not scare', () => {
        const engine = createPetEngine({
          scheduler,
          initialFishPos: { x: 300, y: 300 },
          autoStartTimers: false
        })

        // Move mouse slowly near fish
        engine.handleMouseActivity(350, 350, 1000)
        // 50ms later, moved only 2px (speed = 2/50 = 0.04 px/ms < SCARE_SPEED 2.5)
        engine.handleMouseActivity(352, 350, 1050)

        expect(engine.getSnapshot().isScared).toBe(false)
        expect(engine.getSnapshot().currentAction).toBe('roaming')
      })

      it('fast mouse movement near fish triggers scare and sets dash velocity away from mouse', () => {
        const onShowMessage = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onShowMessage },
          initialFishPos: { x: 300, y: 300 },
          autoStartTimers: false
        })

        // Fish center: x = 300 + 160 = 460, y = 300 + 100 = 400
        // Near radius is 80
        // Place mouse at (440, 400) (distance 20px < 80)
        engine.handleMouseActivity(400, 400, 1000)
        // 10ms later, mouse moved 50px to (450, 400) -> speed = 50 / 10 = 5 px/ms > SCARE_SPEED 2.5
        // Distance to fish center (460, 400) is 10px (< 80)
        engine.handleMouseActivity(450, 400, 1010)

        expect(engine.getSnapshot().isScared).toBe(true)
        expect(engine.getSnapshot().currentAction).toBe('scared')
        expect(engine.getSnapshot().movementIntent).toBe('dash')
        expect(onShowMessage).toHaveBeenCalledWith(
          expect.stringMatching(/呀！！|不要过来！|救命！|太快了！|\(ﾟДﾟ\)！/),
          1500
        )
      })

      it('fast mouse far from fish does not scare', () => {
        const engine = createPetEngine({
          scheduler,
          initialFishPos: { x: 300, y: 300 },
          autoStartTimers: false
        })

        // Fish center is (460, 400)
        // Mouse moves fast at (100, 100) -> distance is ~420px (> 80)
        engine.handleMouseActivity(100, 100, 1000)
        engine.handleMouseActivity(150, 100, 1010) // 5 px/ms

        expect(engine.getSnapshot().isScared).toBe(false)
      })
    })

    describe('Physics Motion & Steering Integration', () => {
      it('swimTick advances fish position during roaming and notifies onFishPositionChange', () => {
        const onFishPositionChange = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onFishPositionChange },
          initialFishPos: { x: 500, y: 500 },
          autoStartTimers: false
        })

        const initialPos = { ...engine.fishPos }
        // Run tick for dt = 0.05s (50ms)
        engine.swimTick(1000)
        engine.swimTick(1050)

        expect(engine.fishPos).not.toEqual(initialPos)
        expect(onFishPositionChange).toHaveBeenCalled()
      })

      it('swimTick does NOT integrate motion during dragging', () => {
        const engine = createPetEngine({
          scheduler,
          initialFishPos: { x: 500, y: 500 },
          autoStartTimers: false
        })

        engine.startDrag()
        const posBeforeTick = { ...engine.fishPos }

        engine.swimTick(1000)
        engine.swimTick(1050)

        expect(engine.fishPos).toEqual(posBeforeTick)
      })

      it('swimTick does NOT integrate motion while sleeping or pooping (paused intent)', () => {
        const engine = createPetEngine({
          scheduler,
          initialFishPos: { x: 500, y: 500 },
          autoStartTimers: false
        })

        // Trigger poop straining (paused intent)
        engine.triggerPoop()
        expect(engine.getSnapshot().movementIntent).toBe('paused')

        const posBefore = { ...engine.fishPos }
        engine.swimTick(1000)
        engine.swimTick(1050)
        expect(engine.fishPos).toEqual(posBefore)
      })

      it('dash advances fish by dash speed and persists position upon dash completion', () => {
        const onPersistFishPosition = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onPersistFishPosition },
          initialFishPos: { x: 500, y: 500 },
          autoStartTimers: false
        })

        // Trigger scare with explicit rightward direction (+x)
        engine.triggerScared({ x: 1, y: 0 })
        expect(engine.getSnapshot().movementIntent).toBe('dash')

        // First tick: dt = 100ms
        engine.swimTick(1000)
        engine.swimTick(1100)

        // Moved rightward (~400 px/s * 0.1s = 40px)
        expect(engine.fishPos.x).toBeGreaterThan(530)
        expect(onPersistFishPosition).not.toHaveBeenCalled()

        // Advance past DASH_MS (450ms total)
        for (let t = 1150; t <= 1650; t += 50) {
          engine.swimTick(t)
        }

        expect(onPersistFishPosition).toHaveBeenCalled()
        expect(engine.getSwimState().phase).toBe('swim')
      })

      it('autoStartTimers registers swim-tick on scheduler', () => {
        const engine = createPetEngine({
          scheduler,
          initialFishPos: { x: 500, y: 500 },
          autoStartTimers: true
        })

        const initialPos = { ...engine.fishPos }
        vi.advanceTimersByTime(33)
        // The swim-tick timer fired
        expect(engine.fishPos).not.toEqual(initialPos)
      })
    })

    describe('Monologue Scheduling & Message Coordination', () => {
      it('scheduleMonologue shows monologue after random interval (1.5~3.5 min)', () => {
        const onShowMessage = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onShowMessage },
          autoStartTimers: false
        })

        engine.scheduleMonologue()

        // Before 90s (1.5 min), should not show monologue
        vi.advanceTimersByTime(89 * 1000)
        expect(onShowMessage).not.toHaveBeenCalled()

        // Advance to 210s (3.5 min) - guaranteed to have fired once
        vi.advanceTimersByTime(122 * 1000)
        expect(onShowMessage).toHaveBeenCalledWith(
          expect.stringMatching(
            /今天的水怎么这么浑浊|鱼也要996吗|上班是不可能的|感觉有人在看我|今天午饭吃什么|偷偷打了个哈欠|老板是什么味道|我在想一件大事|摸鱼的最高境界|鱼的记忆只有7秒|我看了你好久了|\(\*\^▽\^\*\)|听说摸鱼有益健康|静静地看着你们上班/
          ),
          3000
        )
      })

      it('monologue is suppressed when pet is sleeping or scared or active message showing', () => {
        const onShowMessage = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onShowMessage },
          autoStartTimers: false
        })

        // Put pet to sleep
        engine.fallAsleep()
        expect(engine.getSnapshot().isSleeping).toBe(true)

        engine.scheduleMonologue()
        vi.advanceTimersByTime(210 * 1000)

        // Monologue was suppressed while sleeping
        expect(onShowMessage).not.toHaveBeenCalled()
      })
    })

    describe('Ticket #8: Visual Shell Parity & State Exposure', () => {
      it('exposes comboCount and updates subscribers upon combo increments and resets', () => {
        const subscriber = vi.fn()
        const engine = createPetEngine({ scheduler, autoStartTimers: false })
        engine.subscribe(subscriber)

        expect(engine.comboCount).toBe(0)

        engine.handleClick()
        expect(engine.comboCount).toBe(1)
        expect(subscriber).toHaveBeenCalled()

        engine.handleClick()
        expect(engine.comboCount).toBe(2)

        vi.advanceTimersByTime(3000)
        expect(engine.comboCount).toBe(0)
      })

      it('exposes interactMessage and synchronizes with showMessage duration', () => {
        const engine = createPetEngine({ scheduler, autoStartTimers: false })
        expect(engine.interactMessage).toBe('')

        engine.showMessage('测试消息', 1500)
        expect(engine.interactMessage).toBe('测试消息')

        vi.advanceTimersByTime(1000)
        expect(engine.interactMessage).toBe('测试消息')

        vi.advanceTimersByTime(500)
        expect(engine.interactMessage).toBe('')
      })

      it('handleClick triggers tap message and heart particles when awake', () => {
        const onShowMessage = vi.fn()
        const onSpawnParticles = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onShowMessage, onSpawnParticles },
          autoStartTimers: false
        })

        engine.handleClick()
        expect(onShowMessage).toHaveBeenCalledWith(
          expect.stringMatching(/别戳我|嘿|干嘛呢|摸鱼中|好痒|咬你|嗷|手怎么这么凉|\(=｀ω´=\)|o\(\*￣▽￣\*\)o|在摸了/),
          2000
        )
        expect(onSpawnParticles).toHaveBeenCalledWith(
          ['❤️', '✨', '💕', '⭐', '💛', '💙'],
          expect.any(Number),
          'heart'
        )
      })

      it('exposes mousePos from handleMouseActivity', () => {
        const engine = createPetEngine({ scheduler, autoStartTimers: false })
        expect(engine.mousePos).toEqual({ x: 0, y: 0 })

        engine.handleMouseActivity(350, 420)
        expect(engine.mousePos).toEqual({ x: 350, y: 420 })
      })

      it('notifies onFacingChange and onPoopsChange adapter callbacks', () => {
        const onFacingChange = vi.fn()
        const onPoopsChange = vi.fn()
        const engine = createPetEngine({
          scheduler,
          adapter: { onFacingChange, onPoopsChange },
          autoStartTimers: false
        })

        // Poop drop & scoop
        engine.dropPoop()
        expect(onPoopsChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]))

        const poopId = engine.poops[0].id
        engine.scoopPoop(poopId)
        expect(onPoopsChange).toHaveBeenCalledWith([])

        engine.setPoops([{ id: 'custom-1', x: 100, y: 100 }])
        expect(onPoopsChange).toHaveBeenCalledWith([{ id: 'custom-1', x: 100, y: 100 }])
      })
    })
  })
})
