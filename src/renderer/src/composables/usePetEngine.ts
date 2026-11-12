import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { createPetEngine, PetEngine, type BehaviorSnapshot } from '../lib/petEngine'
import { PetScheduler } from './PetScheduler'
import { petTime } from '../lib/petTime'
import { resolveSkin } from '../lib/skins'
import {
  resolveSpecies,
  resolvePalette,
  type PetModelProps
} from '../lib/species'
import { resolveInitialFishPosition } from '../lib/fishPosition'
import { serializePoops, type Poop } from '../lib/poop'
import { useDrag } from './useDrag'
import type { Vec } from '../lib/fishMotion'

export interface Particle {
  id: number
  x: number
  bottom: number
  char: string
  dur: number
  size: number
  type: string
}

export interface UsePetEngineOptions {
  engine?: PetEngine
  scheduler?: PetScheduler
}

const INTERACTIVE_SELECTOR = '.fish-wrap, .bubble-wrap, .poop'

export function hitInteractiveAt(x: number, y: number): boolean {
  if (typeof document === 'undefined') return false
  const el = document.elementFromPoint(x, y)
  return !!(el && el.closest(INTERACTIVE_SELECTOR))
}

export function usePetEngine(options: UsePetEngineOptions = {}) {
  const scheduler = options.scheduler ?? new PetScheduler()
  const particles = ref<Particle[]>([])
  let particleId = 0

  function spawnParticles(chars: string[], count: number, type = 'heart') {
    for (let i = 0; i < count; i++) {
      const id = particleId++
      const dur = 0.8 + Math.random() * 0.7
      const p: Particle = {
        id,
        x: 175 + (Math.random() - 0.5) * 70,
        bottom: 55 + Math.random() * 20,
        char: chars[Math.floor(Math.random() * chars.length)],
        dur,
        size: 14 + Math.random() * 8,
        type
      }
      particles.value.push(p)
      scheduler.after(`particle:${id}`, dur * 1000 + 150, () => {
        particles.value = particles.value.filter((x) => x.id !== id)
      })
    }
  }

  // Configuration & Time
  const workEndTime = ref('18:00')
  const workEndReminderEnabled = ref(true)
  const speciesId = ref('classic-fish')
  const paletteId = ref('default')
  const skinId = ref('default')
  const currentTime = ref(new Date())

  // Engine instance
  const engine =
    options.engine ??
    createPetEngine({
      adapter: {
        getViewportSize: () =>
          typeof window !== 'undefined'
            ? { width: window.innerWidth, height: window.innerHeight }
            : { width: 1920, height: 1080 },
        onFishPositionChange: (pos) => {
          fishPos.value = { ...pos }
        },
        onFacingChange: (left) => {
          facingLeft.value = left
        },
        onPersistFishPosition: (pos) => {
          if (typeof window !== 'undefined' && window.api) {
            window.api.setFishPosition(pos.x, pos.y)
          }
        },
        onSetClickThrough: (ct) => {
          if (typeof window !== 'undefined' && window.api) {
            window.api.setClickThrough(ct)
          }
        },
        onPersistPoops: (pList) => {
          if (typeof window !== 'undefined' && window.api) {
            window.api.setPoops(serializePoops(pList))
          }
        },
        onPoopsChange: (pList) => {
          poops.value = [...pList]
        },
        onReportScoop: () => {
          if (typeof window !== 'undefined' && window.api) {
            window.api.reportScoop()
          }
        },
        onShowMessage: (msg) => {
          interactMessage.value = msg
        },
        onSpawnParticles: (chars, count, type) => {
          spawnParticles(chars, count, type)
        }
      }
    })

  // Reactive engine mirrors
  const snapshot = ref<BehaviorSnapshot>(engine.getSnapshot())
  const fishPos = ref({ ...engine.fishPos })
  const facingLeft = ref(engine.facingLeft)
  const poops = ref<Poop[]>([...engine.poops])
  const comboCount = ref(engine.comboCount)
  const interactMessage = ref(engine.interactMessage)
  const mousePos = ref<Vec>({ x: 0, y: 0 })
  const fishSvgRef = ref<SVGElement | null>(null)

  const unsubEngine = engine.subscribe((s) => {
    snapshot.value = s
    comboCount.value = engine.comboCount
    interactMessage.value = engine.interactMessage
  })

  // Behavioral flags derived from snapshot
  const isSleeping = computed(() => snapshot.value.isSleeping)
  const isScared = computed(() => snapshot.value.isScared)
  const isPooping = computed(() => snapshot.value.isPooping)
  const isHovered = computed(() => snapshot.value.isHovered)
  const isRainbow = computed(() => snapshot.value.isRainbow)
  const showWaterReminder = computed(() => snapshot.value.showWaterReminder)

  // Style and time-based computed properties
  const fishStyle = computed(() => ({
    transform: `translate(${fishPos.value.x}px, ${fishPos.value.y}px)`
  }))

  const timeInfo = computed(() => petTime(currentTime.value, workEndTime.value))
  const mood = computed(() => timeInfo.value.mood)

  const effectiveMood = computed(() => {
    if (isScared.value) return 'scared'
    if (isSleeping.value) return 'sleeping'
    return mood.value
  })

  const effectiveMoodClass = computed(() => effectiveMood.value)

  const currentSpecies = computed(() => resolveSpecies(speciesId.value))
  const currentPalette = computed(() => resolvePalette(currentSpecies.value, paletteId.value))
  const skinPalette = computed(() => currentPalette.value.colors)
  const bodyColor = computed(() => skinPalette.value[effectiveMood.value].body)
  const tailColor = computed(() => skinPalette.value[effectiveMood.value].tail)
  const finColor = computed(() => skinPalette.value[effectiveMood.value].fin)

  const modelProps = computed<PetModelProps>(() => ({
    effectiveMood: effectiveMood.value,
    facingLeft: facingLeft.value,
    mousePos: mousePos.value,
    isScared: isScared.value,
    isSleeping: isSleeping.value,
    isPooping: isPooping.value,
    isRainbow: isRainbow.value,
    palette: skinPalette.value
  }))

  const displayMessage = computed(() => {
    if (isSleeping.value) return 'Z z z ...'
    if (interactMessage.value) return interactMessage.value
    return workEndReminderEnabled.value ? timeInfo.value.message : ''
  })

  const displaySubMessage = computed(() => {
    if (isSleeping.value) return '（睡着了，别吵我）'
    if (interactMessage.value || !workEndReminderEnabled.value) return ''
    return timeInfo.value.subMessage
  })

  const showBubble = computed(
    () =>
      showWaterReminder.value ||
      isSleeping.value ||
      !!interactMessage.value ||
      workEndReminderEnabled.value
  )

  // Pupil tracking
  const eyeOffset = computed(() => {
    const el = fishSvgRef.value
    if (!el || isSleeping.value) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const anchorX = facingLeft.value ? 120 - 84 : 84
    const eyeCX = rect.left + anchorX * (rect.width / 120)
    const eyeCY = rect.top + 34 * (rect.height / 80)
    const dx = mousePos.value.x - eyeCX
    const dy = mousePos.value.y - eyeCY
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return { x: 0, y: 0 }
    const factor = Math.min(dist / 100, 1) * (isScared.value ? 1.5 : 2.5)
    const dir = facingLeft.value ? -1 : 1
    return { x: (dx / dist) * factor * dir, y: (dy / dist) * factor }
  })

  const eyeX = computed(() => (mood.value === 'sad' ? 83 : 85) + eyeOffset.value.x)
  const eyeY = computed(() => 35 + eyeOffset.value.y)
  const eyeHighlightX = computed(() => eyeX.value + 1)
  const eyeHighlightY = computed(() => eyeY.value - 2)

  // Mouse activity & dragging
  let lastGlobalMouseAt = 0

  function handleMouseMove(e: MouseEvent) {
    if (Date.now() - lastGlobalMouseAt < 1000) return
    mousePos.value = { x: e.clientX, y: e.clientY }
    engine.handleMouseActivity(e.clientX, e.clientY)
  }

  const { startDrag: triggerDrag } = useDrag({
    onTap: () => {
      engine.endDrag()
      engine.handleClick()
    },
    onMouseMove: handleMouseMove,
    onDragMove: (dx, dy) => engine.moveFishBy(dx, dy),
    onDragEnd: () => engine.endDrag()
  })

  function startDrag(e: MouseEvent) {
    engine.startDrag()
    triggerDrag(e)
  }

  function onFishHover() {
    engine.setHovered(true)
  }

  function onFishLeave() {
    engine.setHovered(false)
  }

  function confirmWaterDrank() {
    engine.confirmWater()
  }

  function scoopPoop(id: string) {
    engine.scoopPoop(id)
  }

  function handleHitTest(e: MouseEvent) {
    engine.updateClickThrough(hitInteractiveAt(e.clientX, e.clientY))
  }

  function persistFishPosition() {
    if (typeof window !== 'undefined' && window.api) {
      window.api.setFishPosition(engine.fishPos.x, engine.fishPos.y)
    }
  }

  // Lifecycle
  const unsubscribeGlobal: Array<() => void> = []

  if (getCurrentInstance()) {
    onMounted(async () => {
      let currentPoopEnabled = true

      if (typeof window !== 'undefined' && window.api) {
        const config = await window.api.getConfig()
        workEndTime.value = config.workEndTime
        workEndReminderEnabled.value = config.workEndReminderEnabled
        speciesId.value = config.speciesId ?? 'classic-fish'
        paletteId.value = config.paletteId ?? config.skinId ?? 'default'
        skinId.value = paletteId.value
        currentPoopEnabled = config.poopEnabled

        unsubscribeGlobal.push(
          window.api.onConfigChanged((updated) => {
            workEndTime.value = updated.workEndTime
            workEndReminderEnabled.value = updated.workEndReminderEnabled
            if (updated.speciesId) speciesId.value = updated.speciesId
            if (updated.paletteId) {
              paletteId.value = updated.paletteId
              skinId.value = updated.paletteId
            } else if (updated.skinId) {
              paletteId.value = updated.skinId
              skinId.value = updated.skinId
            }
            if (updated.poopEnabled !== currentPoopEnabled) {
              currentPoopEnabled = updated.poopEnabled
              engine.setPoopEnabled(updated.poopEnabled)
            }
          })
        )

        const saved = await window.api.getFishPosition()
        const initialPos = resolveInitialFishPosition(
          saved.x,
          saved.y,
          window.innerWidth,
          window.innerHeight
        )
        engine.setFishPosition(initialPos)

        unsubscribeGlobal.push(
          window.api.onGlobalMouseMove((pos) => {
            lastGlobalMouseAt = Date.now()
            mousePos.value = { x: pos.x, y: pos.y }
            engine.handleMouseActivity(pos.x, pos.y)
            engine.updateClickThrough(
              hitInteractiveAt(pos.x - window.screenX, pos.y - window.screenY)
            )
          })
        )

        unsubscribeGlobal.push(
          window.api.onGlobalMouseClick((pos) => {
            console.debug('[globalMouse] click', pos)
          })
        )

        const savedPoops = await window.api.getPoops()
        engine.setPoops(savedPoops)
        engine.setPoopEnabled(config.poopEnabled)
      }

      if (typeof document !== 'undefined') {
        document.addEventListener('mousemove', handleHitTest)
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', persistFishPosition)
      }

      scheduler.every('clock', 10000, () => {
        currentTime.value = new Date()
      })
    })

    onUnmounted(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousemove', handleHitTest)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', persistFishPosition)
      }
      unsubscribeGlobal.forEach((off) => off())
      scheduler.cancelAll()
      unsubEngine()
      if (!options.engine) {
        engine.destroy()
      }
    })
  }

  return {
    engine,
    scheduler,
    speciesId,
    paletteId,
    currentSpecies,
    currentPalette,
    modelProps,
    mousePos,
    fishPos,
    fishStyle,
    facingLeft,
    showBubble,
    displayMessage,
    displaySubMessage,
    particles,
    effectiveMood,
    effectiveMoodClass,
    bodyColor,
    tailColor,
    finColor,
    eyeX,
    eyeY,
    eyeHighlightX,
    eyeHighlightY,
    isSleeping,
    isScared,
    isHovered,
    isRainbow,
    isPooping,
    showWaterReminder,
    comboCount,
    poops,
    fishSvgRef,
    interactMessage,
    startDrag,
    onFishHover,
    onFishLeave,
    confirmWaterDrank,
    scoopPoop
  }
}
