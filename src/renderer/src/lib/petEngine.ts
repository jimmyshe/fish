import { PetScheduler } from '../composables/PetScheduler'
import {
  action,
  condition,
  prioritySelector,
  sequence,
  type BehaviorNode
} from './behaviorTree'
import { clampFishPosition, resolveInitialFishPosition } from './fishPosition'
import {
  MOTION,
  avoidanceForce,
  computeFacing,
  dashDirection,
  edgeForce,
  fishCenter,
  integrateVelocity,
  shouldScare,
  stepWanderAngle,
  FISH_CONTAINER,
  type Vec
} from './fishMotion'
import { nextPoopDelayMs, poopDropPosition, type Poop } from './poop'

export type MovementIntent = 'user-drag' | 'dash' | 'paused' | 'roam'
export type PetActionName = 'dragging' | 'scared' | 'sleeping' | 'pooping' | 'roaming'

export interface SwimState {
  phase: 'swim' | 'pause' | 'dash'
  vx: number
  vy: number
  angle: number
  cruise: number
  phaseLeftMs: number
}

export interface BehaviorSnapshot {
  currentAction: PetActionName
  movementIntent: MovementIntent
  isSleeping: boolean
  isScared: boolean
  isPooping: boolean
  isHovered: boolean
  isRainbow: boolean
  showWaterReminder: boolean
}

export interface PetEngineAdapter {
  getViewportSize?: () => { width: number; height: number }
  onFishPositionChange?: (pos: { x: number; y: number }) => void
  onPersistFishPosition?: (pos: { x: number; y: number }) => void
  onSetClickThrough?: (clickThrough: boolean) => void
  onPersistPoops?: (poops: Poop[]) => void
  onReportScoop?: () => void
  onDropPoop?: () => void
  onShowMessage?: (msg: string, duration?: number) => void
  onSpawnParticles?: (chars: string[], count: number, type: string) => void
}

export interface PetEngineOptions {
  adapter?: PetEngineAdapter
  scheduler?: PetScheduler
  poopEnabled?: boolean
  autoStartTimers?: boolean
  initialFishPos?: { x: number; y: number }
  initialPoops?: Poop[]
}

interface TreeContext {
  isDragging: boolean
  isScared: boolean
  isSleeping: boolean
  isPooping: boolean
  currentAction: PetActionName
  movementIntent: MovementIntent
}

const SLEEP_TIMEOUT_MS = 3 * 60 * 1000 // 3 min
const SCARED_DURATION_MS = 1800 // 1800 ms
const POOP_STRAINING_MS = 800 // 800 ms
const COMBO_WINDOW_MS = 3000 // 3 s
const RAINBOW_DURATION_MS = 5000 // 5 s
const WATER_REMINDER_INTERVAL_MS = 45 * 60 * 1000 // 45 min
const ZZZ_INTERVAL_MS = 1500 // 1.5 s

const SCARE_MESSAGES = ['呀！！', '不要过来！', '救命！', '太快了！', '(ﾟДﾟ)！']
const POOP_RELIEF_MESSAGES = ['舒服了', '别看', '……', '谁把灯打开']
const SCOOP_MESSAGES = ['谢谢主人', '好人一生平安', '终于有人管了']
const RAINBOW_MESSAGES = ['🌈 彩虹鱼出现了！！', '✨ 传说中的彩鱼！', '🎊 隐藏彩蛋解锁！']
const MONOLOGUES = [
  '今天的水怎么这么浑浊...',
  '鱼也要996吗？',
  '上班是不可能的，这辈子...',
  '感觉有人在看我...',
  '今天午饭吃什么好呢',
  '（偷偷打了个哈欠）',
  '老板是什么味道的...',
  '我在想一件大事',
  '摸鱼的最高境界是什么',
  '鱼的记忆只有7秒... 等等刚才说啥来着',
  '我看了你好久了',
  '(*^▽^*)',
  '听说摸鱼有益健康',
  '静静地看着你们上班'
]

export class PetEngine {
  private readonly adapter: PetEngineAdapter
  private readonly scheduler: PetScheduler
  private readonly rootTree: BehaviorNode<TreeContext>
  private readonly subscribers = new Set<(snapshot: BehaviorSnapshot) => void>()

  // Internal states
  private _isDragging = false
  private _isScared = false
  private _isSleeping = false
  private _isPooping = false
  private _isHovered = false
  private _isRainbow = false
  private _showWaterReminder = false
  private _poopEnabled: boolean
  private _comboCount = 0
  private poopSeq = 0

  private _fishPos: { x: number; y: number }
  private _facingLeft = false
  private _poops: Poop[] = []
  private clickThrough = true

  private mousePos: Vec = { x: 0, y: 0 }
  private hasMouseData = false
  private lastMouseTime = 0
  private lastMouseClientPos: Vec = { x: 0, y: 0 }

  private swimState: SwimState = {
    phase: 'swim',
    vx: 0,
    vy: 0,
    angle: Math.random() * Math.PI * 2,
    cruise: MOTION.CRUISE_MIN,
    phaseLeftMs: MOTION.SWIM_LEG_MIN_MS
  }
  private lastTickAt = 0
  private hasInteractMessage = false

  private currentSnapshot: BehaviorSnapshot

  constructor(options: PetEngineOptions = {}) {
    this.adapter = options.adapter ?? {}
    this.scheduler = options.scheduler ?? new PetScheduler()
    this._poopEnabled = options.poopEnabled ?? true
    this._poops = options.initialPoops ? [...options.initialPoops] : []

    const viewport = this.getViewportSize()
    this._fishPos = resolveInitialFishPosition(
      options.initialFishPos?.x ?? -1,
      options.initialFishPos?.y ?? -1,
      viewport.width,
      viewport.height
    )

    // Build the 5-level Root PrioritySelector:
    // DraggingAction > ScaredDashAction > SleepingAction > PoopStrainingSequence > RoamingAction
    const draggingAction = sequence<TreeContext>([
      condition((ctx) => ctx.isDragging),
      action((ctx) => {
        ctx.currentAction = 'dragging'
        ctx.movementIntent = 'user-drag'
        return 'SUCCESS'
      })
    ])

    const scaredDashAction = sequence<TreeContext>([
      condition((ctx) => ctx.isScared),
      action((ctx) => {
        ctx.currentAction = 'scared'
        ctx.movementIntent = 'dash'
        return 'SUCCESS'
      })
    ])

    const sleepingAction = sequence<TreeContext>([
      condition((ctx) => ctx.isSleeping),
      action((ctx) => {
        ctx.currentAction = 'sleeping'
        ctx.movementIntent = 'paused'
        return 'SUCCESS'
      })
    ])

    const poopStrainingSequence = sequence<TreeContext>([
      condition((ctx) => ctx.isPooping),
      action((ctx) => {
        ctx.currentAction = 'pooping'
        ctx.movementIntent = 'paused'
        return 'SUCCESS'
      })
    ])

    const roamingAction = action<TreeContext>((ctx) => {
      ctx.currentAction = 'roaming'
      ctx.movementIntent = 'roam'
      return 'SUCCESS'
    })

    this.rootTree = prioritySelector<TreeContext>([
      draggingAction,
      scaredDashAction,
      sleepingAction,
      poopStrainingSequence,
      roamingAction
    ])

    this.currentSnapshot = this.evaluateSnapshot()

    if (options.autoStartTimers !== false) {
      this.resetSleepTimer()
      this.scheduleWaterReminder()
      this.scheduleMonologue()
      this.scheduler.every('swim-tick', MOTION.TICK_MS, () => this.swimTick())
      if (this._poopEnabled) {
        this.schedulePoop()
      }
    }
  }

  get snapshot(): BehaviorSnapshot {
    return this.currentSnapshot
  }

  getSnapshot(): BehaviorSnapshot {
    return this.currentSnapshot
  }

  get fishPos(): { x: number; y: number } {
    return this._fishPos
  }

  get facingLeft(): boolean {
    return this._facingLeft
  }

  get poops(): Poop[] {
    return this._poops
  }

  get isClickThrough(): boolean {
    return this.clickThrough
  }

  getViewportSize(): { width: number; height: number } {
    return (
      this.adapter.getViewportSize?.() ??
      (typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 1920, height: 1080 })
    )
  }

  moveFishBy(dx: number, dy: number): void {
    const viewport = this.getViewportSize()
    this._fishPos = clampFishPosition(
      this._fishPos.x + dx,
      this._fishPos.y + dy,
      viewport.width,
      viewport.height
    )
    this.adapter.onFishPositionChange?.(this._fishPos)
  }

  setFishPosition(pos: { x: number; y: number }): void {
    const viewport = this.getViewportSize()
    this._fishPos = clampFishPosition(pos.x, pos.y, viewport.width, viewport.height)
    this.adapter.onFishPositionChange?.(this._fishPos)
  }

  updateClickThrough(hitInteractive: boolean): void {
    const desired = this._isDragging ? false : !hitInteractive
    if (desired === this.clickThrough) return
    this.clickThrough = desired
    this.adapter.onSetClickThrough?.(desired)
  }

  subscribe(listener: (snapshot: BehaviorSnapshot) => void): () => void {
    this.subscribers.add(listener)
    return () => {
      this.subscribers.delete(listener)
    }
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      sub(this.currentSnapshot)
    }
  }

  private evaluateSnapshot(): BehaviorSnapshot {
    const ctx: TreeContext = {
      isDragging: this._isDragging,
      isScared: this._isScared,
      isSleeping: this._isSleeping,
      isPooping: this._isPooping,
      currentAction: 'roaming',
      movementIntent: 'roam'
    }

    this.rootTree(ctx)

    return {
      currentAction: ctx.currentAction,
      movementIntent: ctx.movementIntent,
      isSleeping: this._isSleeping,
      isScared: this._isScared,
      isPooping: this._isPooping,
      isHovered: this._isHovered,
      isRainbow: this._isRainbow,
      showWaterReminder: this._showWaterReminder
    }
  }

  private tick(): void {
    this.currentSnapshot = this.evaluateSnapshot()
    this.notifySubscribers()
  }

  // ── Dragging ────────────────────────────────────────

  startDrag(): void {
    if (this._isDragging) return
    this._isDragging = true
    this.tick()
  }

  endDrag(): void {
    if (!this._isDragging) return
    this._isDragging = false
    this.adapter.onPersistFishPosition?.(this._fishPos)
    this.tick()
  }

  getSwimState(): SwimState {
    return this.swimState
  }

  // ── Hover ───────────────────────────────────────────

  setHovered(hovered: boolean): void {
    if (this._isHovered === hovered) return
    this._isHovered = hovered
    this.tick()
  }

  // ── Mouse & Scared ──────────────────────────────────

  handleMouseActivity(x: number, y: number, now?: number): void {
    this.mousePos = { x, y }
    this.hasMouseData = true
    this.onActivity()

    const currentNow = now ?? Date.now()
    const dt = currentNow - this.lastMouseTime
    if (dt > 0 && dt < 80 && !this._isScared && !this._isSleeping) {
      const dx = x - this.lastMouseClientPos.x
      const dy = y - this.lastMouseClientPos.y
      const speed = Math.hypot(dx, dy) / dt
      const c = fishCenter(this._fishPos)
      const dist = Math.hypot(x - c.x, y - c.y)
      if (shouldScare(speed, dist, MOTION.NEAR_RADIUS, MOTION.SCARE_SPEED)) {
        const dashDir = dashDirection(c, this.mousePos)
        this.triggerScared(dashDir)
      }
    }
    this.lastMouseTime = currentNow
    this.lastMouseClientPos = { x, y }
  }

  triggerScared(dashDir?: Vec): void {
    if (this._isScared) return
    this._isScared = true

    const dir =
      dashDir ??
      dashDirection(fishCenter(this._fishPos), this.hasMouseData ? this.mousePos : null)
    this.swimState.phase = 'dash'
    this.swimState.vx = dir.x * MOTION.DASH_SPEED
    this.swimState.vy = dir.y * MOTION.DASH_SPEED
    this.swimState.phaseLeftMs = MOTION.DASH_MS

    // Timer to restore
    this.scheduler.after('scared', SCARED_DURATION_MS, () => {
      this._isScared = false
      this.tick()
    })

    const msg = SCARE_MESSAGES[Math.floor(Math.random() * SCARE_MESSAGES.length)]
    this.showMessage(msg, 1500)
    this.adapter.onSpawnParticles?.(['！', '💦', '😱'], 3, 'scare')

    if (this._poopEnabled) {
      this.dropPoop()
    }

    this.tick()
  }

  private randRange(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }

  // ── Physics & Steering ──────────────────────────────

  swimTick(now?: number): void {
    const currentNow = now ?? Date.now()
    if (this.lastTickAt === 0) {
      this.lastTickAt = currentNow - MOTION.TICK_MS
    }
    const dt = Math.min(Math.max((currentNow - this.lastTickAt) / 1000, 0), 0.1)
    this.lastTickAt = currentNow
    if (dt <= 0) return

    const intent = this.currentSnapshot.movementIntent
    if (intent === 'user-drag' || intent === 'paused') {
      return
    }

    this.swimState.phaseLeftMs -= dt * 1000

    if (this.swimState.phase === 'dash') {
      this.moveFishBy(this.swimState.vx * dt, this.swimState.vy * dt)
      const facing = computeFacing(this.swimState.vx, this._facingLeft ? -1 : 1, MOTION.FACE_DEADZONE)
      this._facingLeft = facing === -1

      if (this.swimState.phaseLeftMs <= 0) {
        this.adapter.onPersistFishPosition?.(this._fishPos)
        this.swimState.phase = 'swim'
        this.swimState.phaseLeftMs = this.randRange(MOTION.SWIM_LEG_MIN_MS, MOTION.SWIM_LEG_MAX_MS)
        this.swimState.cruise = this.randRange(MOTION.CRUISE_MIN, MOTION.CRUISE_MAX)
      }
      return
    }

    if (this.swimState.phase === 'swim' && this.swimState.phaseLeftMs <= 0) {
      this.swimState.phase = 'pause'
      this.swimState.phaseLeftMs = this.randRange(MOTION.PAUSE_MIN_MS, MOTION.PAUSE_MAX_MS)
      this.swimState.vx = 0
      this.swimState.vy = 0
      this.adapter.onPersistFishPosition?.(this._fishPos) // 停歇即停靠点：落盘
    } else if (this.swimState.phaseLeftMs <= 0) {
      // pause 结束：恢复漫游
      this.swimState.phase = 'swim'
      this.swimState.phaseLeftMs = this.randRange(MOTION.SWIM_LEG_MIN_MS, MOTION.SWIM_LEG_MAX_MS)
      this.swimState.cruise = this.randRange(MOTION.CRUISE_MIN, MOTION.CRUISE_MAX)
    }

    if (this.swimState.phase === 'pause') {
      return
    }

    this.swimState.angle = stepWanderAngle(this.swimState.angle, MOTION.WANDER_JITTER)
    const desired = {
      x: Math.cos(this.swimState.angle) * this.swimState.cruise,
      y: Math.sin(this.swimState.angle) * this.swimState.cruise
    }
    const mouse = this.hasMouseData ? this.mousePos : null
    const viewport = this.getViewportSize()
    const vel = integrateVelocity(
      { x: this.swimState.vx, y: this.swimState.vy },
      desired,
      [
        avoidanceForce(fishCenter(this._fishPos), mouse, MOTION.AVOID_RADIUS, MOTION.AVOID_STRENGTH),
        edgeForce(
          this._fishPos,
          FISH_CONTAINER,
          { x: viewport.width, y: viewport.height },
          MOTION.EDGE_MARGIN,
          MOTION.EDGE_STRENGTH
        )
      ],
      dt,
      MOTION.MAX_SPEED,
      MOTION.TURN_RATE
    )
    this.swimState.vx = vel.x
    this.swimState.vy = vel.y
    this.moveFishBy(vel.x * dt, vel.y * dt)

    const facing = computeFacing(this.swimState.vx, this._facingLeft ? -1 : 1, MOTION.FACE_DEADZONE)
    this._facingLeft = facing === -1
  }

  // ── Sleep Mode ──────────────────────────────────────

  private resetSleepTimer(): void {
    if (this._isSleeping) {
      this.wakeUp()
      return
    }
    this.scheduler.after('sleep', SLEEP_TIMEOUT_MS, () => {
      this.fallAsleep()
    })
  }

  fallAsleep(): void {
    this._isSleeping = true
    this.scheduler.every('zzz', ZZZ_INTERVAL_MS, () => {
      if (this._isSleeping) {
        this.adapter.onSpawnParticles?.(['z', 'Z', 'z'], 1, 'zzz')
      }
    })
    this.tick()
  }

  wakeUp(): void {
    if (!this._isSleeping) return
    this._isSleeping = false
    this.scheduler.cancel('zzz')
    this.showMessage('呼～被吵醒了...', 2000)
    this.resetSleepTimer()
    this.tick()
  }

  showMessage(msg: string, duration = 2000): void {
    this.hasInteractMessage = true
    this.adapter.onShowMessage?.(msg, duration)
    this.scheduler.after('interact', duration, () => {
      this.hasInteractMessage = false
    })
  }

  scheduleMonologue(): void {
    const delay = (90 + Math.random() * 120) * 1000 // 1.5~3.5 分钟
    this.scheduler.after('monologue', delay, () => {
      if (!this._isSleeping && !this._isScared && !this.hasInteractMessage) {
        const msg = MONOLOGUES[Math.floor(Math.random() * MONOLOGUES.length)]
        this.showMessage(msg, 3000)
      }
      this.scheduleMonologue()
    })
  }

  onActivity(): void {
    this.resetSleepTimer()
  }

  handleClick(): void {
    this.onActivity()
    this.addCombo()
  }

  // ── Combo / Rainbow ─────────────────────────────────

  private addCombo(): void {
    this._comboCount++
    this.scheduler.after('combo', COMBO_WINDOW_MS, () => {
      this._comboCount = 0
    })

    if (this._comboCount >= 5) {
      this._comboCount = 0
      this.triggerRainbow()
    }
  }

  private triggerRainbow(): void {
    if (this._isRainbow) return
    this._isRainbow = true

    this.scheduler.after('rainbow', RAINBOW_DURATION_MS, () => {
      this._isRainbow = false
      this.tick()
    })

    const msg = RAINBOW_MESSAGES[Math.floor(Math.random() * RAINBOW_MESSAGES.length)]
    this.showMessage(msg, 4000)
    this.adapter.onSpawnParticles?.(['🌈', '✨', '🎉', '⭐', '💫'], 6, 'rainbow')
    this.tick()
  }

  // ── Water Reminder ──────────────────────────────────

  private scheduleWaterReminder(): void {
    this.scheduler.after('water', WATER_REMINDER_INTERVAL_MS, () => {
      this._showWaterReminder = true
      this.adapter.onSpawnParticles?.(['💧', '💦', '💧'], 4, 'heart')
      this.tick()
    })
  }

  confirmWater(): void {
    this._showWaterReminder = false
    this.showMessage('棒棒！多喝水 💪', 2500)
    this.adapter.onSpawnParticles?.(['💧', '✨', '💪', '⭐'], 5, 'rainbow')
    this.scheduleWaterReminder()
    this.tick()
  }

  // ── Poop Branching ──────────────────────────────────

  dropPoop(): void {
    const pos = poopDropPosition(this._fishPos, this._facingLeft ? -1 : 1)
    const viewport = this.getViewportSize()
    const newPoop: Poop = {
      id: `${Date.now()}-${this.poopSeq++}`,
      x: Math.min(Math.max(pos.x, 12), viewport.width - 12),
      y: Math.min(Math.max(pos.y, 12), viewport.height - 12)
    }
    this._poops = [...this._poops, newPoop]
    this.adapter.onDropPoop?.()
    this.adapter.onPersistPoops?.(this._poops)
  }

  scoopPoop(id: string): void {
    this._poops = this._poops.filter((p) => p.id !== id)
    this.adapter.onPersistPoops?.(this._poops)
    this.adapter.onReportScoop?.()
    const msg = SCOOP_MESSAGES[Math.floor(Math.random() * SCOOP_MESSAGES.length)]
    this.showMessage(msg, 2000)
    this.adapter.onSpawnParticles?.(['✨', '🧹', '💛', '⭐'], 4, 'rainbow')
  }

  setPoops(poops: Poop[]): void {
    this._poops = [...poops]
  }

  private schedulePoop(): void {
    this.scheduler.after('poop', nextPoopDelayMs(), () => {
      this.triggerPoop()
    })
  }

  triggerPoop(): void {
    if (this._isSleeping || this._isScared) {
      // 梦游拉屎或受惊到点：不唤醒、无使劲动画，直接掉落
      this.dropPoop()
    } else {
      // 漫游中：进入使劲序列
      this._isPooping = true
      this.tick()

      this.scheduler.after('poop-drop', POOP_STRAINING_MS, () => {
        this._isPooping = false
        this.dropPoop()
        const msg = POOP_RELIEF_MESSAGES[Math.floor(Math.random() * POOP_RELIEF_MESSAGES.length)]
        this.showMessage(msg, 2000)
        this.tick()
      })
    }

    if (this._poopEnabled) {
      this.schedulePoop()
    }
  }

  setPoopEnabled(enabled: boolean): void {
    this._poopEnabled = enabled
    if (enabled) {
      this.schedulePoop()
    } else {
      this.scheduler.cancel('poop')
      this.scheduler.cancel('poop-drop')
      if (this._isPooping) {
        this._isPooping = false
        this.tick()
      }
    }
  }

  // ── Lifecycle ───────────────────────────────────────

  destroy(): void {
    this.scheduler.cancelAll()
    this.subscribers.clear()
  }
}

export function createPetEngine(options?: PetEngineOptions): PetEngine {
  return new PetEngine(options)
}
