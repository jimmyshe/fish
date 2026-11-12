import { PetScheduler } from '../composables/PetScheduler'
import {
  action,
  condition,
  prioritySelector,
  sequence,
  type BehaviorNode
} from './behaviorTree'
import { nextPoopDelayMs } from './poop'

export type MovementIntent = 'user-drag' | 'dash' | 'paused' | 'roam'
export type PetActionName = 'dragging' | 'scared' | 'sleeping' | 'pooping' | 'roaming'

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
  onDropPoop?: () => void
  onShowMessage?: (msg: string, duration?: number) => void
  onSpawnParticles?: (chars: string[], count: number, type: string) => void
}

export interface PetEngineOptions {
  adapter?: PetEngineAdapter
  scheduler?: PetScheduler
  poopEnabled?: boolean
  autoStartTimers?: boolean
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
const RAINBOW_MESSAGES = ['🌈 彩虹鱼出现了！！', '✨ 传说中的彩鱼！', '🎊 隐藏彩蛋解锁！']

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

  private currentSnapshot: BehaviorSnapshot

  constructor(options: PetEngineOptions = {}) {
    this.adapter = options.adapter ?? {}
    this.scheduler = options.scheduler ?? new PetScheduler()
    this._poopEnabled = options.poopEnabled ?? true

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
    this.tick()
  }

  // ── Hover ───────────────────────────────────────────

  setHovered(hovered: boolean): void {
    if (this._isHovered === hovered) return
    this._isHovered = hovered
    this.tick()
  }

  // ── Scared Mode ─────────────────────────────────────

  triggerScared(): void {
    if (this._isScared) return
    this._isScared = true

    // Timer to restore
    this.scheduler.after('scared', SCARED_DURATION_MS, () => {
      this._isScared = false
      this.tick()
    })

    const msg = SCARE_MESSAGES[Math.floor(Math.random() * SCARE_MESSAGES.length)]
    this.adapter.onShowMessage?.(msg, 1500)
    this.adapter.onSpawnParticles?.(['！', '💦', '😱'], 3, 'scare')

    if (this._poopEnabled) {
      this.adapter.onDropPoop?.()
    }

    this.tick()
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

  private fallAsleep(): void {
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
    this.adapter.onShowMessage?.('呼～被吵醒了...', 2000)
    this.resetSleepTimer()
    this.tick()
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
    this.adapter.onShowMessage?.(msg, 4000)
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
    this.adapter.onShowMessage?.('棒棒！多喝水 💪', 2500)
    this.adapter.onSpawnParticles?.(['💧', '✨', '💪', '⭐'], 5, 'rainbow')
    this.scheduleWaterReminder()
    this.tick()
  }

  // ── Poop Branching ──────────────────────────────────

  private schedulePoop(): void {
    this.scheduler.after('poop', nextPoopDelayMs(), () => {
      this.triggerPoop()
    })
  }

  triggerPoop(): void {
    if (this._isSleeping || this._isScared) {
      // 梦游拉屎或受惊到点：不唤醒、无使劲动画，直接掉落
      this.adapter.onDropPoop?.()
    } else {
      // 漫游中：进入使劲序列
      this._isPooping = true
      this.tick()

      this.scheduler.after('poop-drop', POOP_STRAINING_MS, () => {
        this._isPooping = false
        this.adapter.onDropPoop?.()
        const msg = POOP_RELIEF_MESSAGES[Math.floor(Math.random() * POOP_RELIEF_MESSAGES.length)]
        this.adapter.onShowMessage?.(msg, 2000)
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
