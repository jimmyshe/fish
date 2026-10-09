import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAlwaysOnTopWatchdog } from './alwaysOnTop'

const expectedLevel = process.platform === 'darwin' ? undefined : 'screen-saver'

function makeWindow(overrides: { alwaysOnTop?: boolean; destroyed?: boolean } = {}) {
  return {
    isAlwaysOnTop: vi.fn(() => overrides.alwaysOnTop ?? true),
    isDestroyed: vi.fn(() => overrides.destroyed ?? false),
    setAlwaysOnTop: vi.fn(),
    moveTop: vi.fn()
  }
}

describe('alwaysOnTop 看门狗', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('周期性重新声明置顶并把窗口抬到置顶层级顶部', () => {
    const win = makeWindow()
    startAlwaysOnTopWatchdog(() => win as never, 3000)

    vi.advanceTimersByTime(9000)

    expect(win.setAlwaysOnTop).toHaveBeenCalledTimes(3)
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, expectedLevel)
    expect(win.moveTop).toHaveBeenCalledTimes(3)
  })

  it('用户通过菜单关闭置顶后跳过，不与之对抗', () => {
    const win = makeWindow({ alwaysOnTop: false })
    startAlwaysOnTopWatchdog(() => win as never, 3000)

    vi.advanceTimersByTime(9000)

    expect(win.setAlwaysOnTop).not.toHaveBeenCalled()
    expect(win.moveTop).not.toHaveBeenCalled()
  })

  it('窗口不存在或已销毁时跳过', () => {
    const destroyed = makeWindow({ destroyed: true })
    const stop = startAlwaysOnTopWatchdog(() => null, 3000)
    vi.advanceTimersByTime(3000)
    stop()

    startAlwaysOnTopWatchdog(() => destroyed as never, 3000)
    vi.advanceTimersByTime(6000)

    expect(destroyed.setAlwaysOnTop).not.toHaveBeenCalled()
    expect(destroyed.moveTop).not.toHaveBeenCalled()
  })

  it('stop 后不再触发', () => {
    const win = makeWindow()
    const stop = startAlwaysOnTopWatchdog(() => win as never, 3000)

    vi.advanceTimersByTime(3000)
    stop()
    vi.advanceTimersByTime(9000)

    expect(win.moveTop).toHaveBeenCalledTimes(1)
  })
})
