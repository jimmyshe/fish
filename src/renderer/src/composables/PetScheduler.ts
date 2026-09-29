/**
 * 定时器调度模块：宠物全部定时行为的唯一属主。
 *
 * Interface（调用方需要知道的全部）：
 *   - after(name, ms, fn)   一次性定时器
 *   - every(name, ms, fn)   周期定时器
 *   - cancel(name)          取消（未知名称视为 no-op）
 *
 * 不变量：
 *   - 同名 after/every 会替换挂起中的旧定时器；
 *     自调度链（回调内同名重挂）因此可被取消、随 cancelAll 终止。
 *   - 句柄所有权从不离开本模块，调用方不持有、不清理任何句柄。
 */

type TimerKind = 'timeout' | 'interval'

interface TimerEntry {
  kind: TimerKind
  handle: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>
}

export class PetScheduler {
  private readonly timers = new Map<string, TimerEntry>()

  after(name: string, ms: number, fn: () => void): void {
    const handle = setTimeout(() => {
      this.timers.delete(name)
      fn()
    }, ms)
    this.replace(name, { kind: 'timeout', handle })
  }

  every(name: string, ms: number, fn: () => void): void {
    this.replace(name, { kind: 'interval', handle: setInterval(fn, ms) })
  }

  cancel(name: string): void {
    const entry = this.timers.get(name)
    if (!entry) return
    this.clearEntry(entry)
    this.timers.delete(name)
  }

  cancelAll(): void {
    for (const entry of this.timers.values()) {
      this.clearEntry(entry)
    }
    this.timers.clear()
  }

  private replace(name: string, entry: TimerEntry): void {
    this.cancel(name)
    this.timers.set(name, entry)
  }

  private clearEntry(entry: TimerEntry): void {
    if (entry.kind === 'timeout') {
      clearTimeout(entry.handle as ReturnType<typeof setTimeout>)
    } else {
      clearInterval(entry.handle as ReturnType<typeof setInterval>)
    }
  }
}
