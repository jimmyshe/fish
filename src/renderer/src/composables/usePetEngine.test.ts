import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePetEngine, hitInteractiveAt } from './usePetEngine'
import { createPetEngine } from '../lib/petEngine'
import { PetScheduler } from './PetScheduler'

describe('usePetEngine Composable (Ticket #8)', () => {
  let scheduler: PetScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new PetScheduler()
  })

  afterEach(() => {
    scheduler.cancelAll()
    vi.useRealTimers()
  })

  it('initializes reactive state from PetEngine snapshot and options', () => {
    const engine = createPetEngine({ scheduler, autoStartTimers: false })
    const {
      isSleeping,
      isScared,
      isPooping,
      isHovered,
      isRainbow,
      showWaterReminder,
      comboCount,
      facingLeft,
      interactMessage,
      poops
    } = usePetEngine({ engine })

    expect(isSleeping.value).toBe(false)
    expect(isScared.value).toBe(false)
    expect(isPooping.value).toBe(false)
    expect(isHovered.value).toBe(false)
    expect(isRainbow.value).toBe(false)
    expect(showWaterReminder.value).toBe(false)
    expect(comboCount.value).toBe(0)
    expect(facingLeft.value).toBe(false)
    expect(interactMessage.value).toBe('')
    expect(poops.value).toEqual([])
  })

  it('delegates user interaction events to the underlying PetEngine', () => {
    const engine = createPetEngine({ scheduler, autoStartTimers: false })
    const {
      onFishHover,
      onFishLeave,
      confirmWaterDrank,
      scoopPoop,
      isHovered,
      poops
    } = usePetEngine({ engine })

    // Hover
    onFishHover()
    expect(isHovered.value).toBe(true)

    onFishLeave()
    expect(isHovered.value).toBe(false)

    // Confirm water
    engine.getSnapshot() // sync
    confirmWaterDrank()
    expect(engine.getSnapshot().showWaterReminder).toBe(false)

    // Poop scooping
    engine.setPoops([{ id: 'p1', x: 20, y: 30 }])
    poops.value = [...engine.poops]
    scoopPoop('p1')
    expect(engine.poops).toEqual([])
  })

  it('derives effectiveMood, skin colors and speech bubble text', () => {
    const engine = createPetEngine({ scheduler, autoStartTimers: false })
    const {
      effectiveMood,
      effectiveMoodClass,
      bodyColor,
      displayMessage,
      displaySubMessage,
      showBubble,
      interactMessage
    } = usePetEngine({ engine })

    expect(effectiveMoodClass.value).toBe(effectiveMood.value)
    expect(typeof bodyColor.value).toBe('string')
    expect(showBubble.value).toBe(true)

    // Test interact message overrides
    engine.showMessage('摸鱼中...', 1500)
    expect(interactMessage.value).toBe('摸鱼中...')
    expect(displayMessage.value).toBe('摸鱼中...')
    expect(displaySubMessage.value).toBe('')

    // Fall asleep overrides mood to sleeping
    engine.fallAsleep()
    expect(effectiveMood.value).toBe('sleeping')
    expect(displayMessage.value).toBe('Z z z ...')
    expect(displaySubMessage.value).toBe('（睡着了，别吵我）')
  })

  it('hitInteractiveAt handles environments without document gracefully', () => {
    expect(hitInteractiveAt(100, 100)).toBe(false)
  })
})
