import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UiohookKeyboardEvent, UiohookKey } from 'uiohook-napi'
import { isFeedShortcutInput } from './feedShortcut'
import {
  createMouseMoveThrottle,
  isGlobalMouseTrackingSupported,
  MOUSE_MOVE_INTERVAL_MS
} from './globalMouse'

it('投喂组合和修饰键不算活动，普通按键仍计入', () => {
  const keys = { Ctrl: 29, Alt: 56, F: 33, G: 34 } as typeof UiohookKey
  const event: UiohookKeyboardEvent = {
    type: 4, time: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, keycode: keys.F
  }
  const shortcut = 'Ctrl+Alt+F'
  const matches = (patch: Partial<UiohookKeyboardEvent>) => isFeedShortcutInput({ ...event, ...patch }, shortcut, keys)

  expect(matches({ keycode: keys.Ctrl })).toBe(true)
  expect(matches({ keycode: keys.Alt })).toBe(true)
  expect(matches({ ctrlKey: true, altKey: true })).toBe(true)
  expect(matches({})).toBe(false)
  expect(matches({ ctrlKey: true, altKey: true, keycode: keys.G })).toBe(false)
})

describe('createMouseMoveThrottle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('窗口期内的连续事件只发最新坐标一次', () => {
    const send = vi.fn()
    const push = createMouseMoveThrottle(MOUSE_MOVE_INTERVAL_MS, send)

    push(1, 1)
    push(50, 60)
    push(100, 200)
    expect(send).not.toHaveBeenCalled() // 节流窗口内不立即发

    vi.advanceTimersByTime(MOUSE_MOVE_INTERVAL_MS)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(100, 200) // 只保留最新坐标
  })

  it('间隔超过节流窗口的事件各自发送', () => {
    const send = vi.fn()
    const push = createMouseMoveThrottle(MOUSE_MOVE_INTERVAL_MS, send)

    push(10, 10)
    vi.advanceTimersByTime(MOUSE_MOVE_INTERVAL_MS)
    push(20, 20)
    vi.advanceTimersByTime(MOUSE_MOVE_INTERVAL_MS)

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenNthCalledWith(1, 10, 10)
    expect(send).toHaveBeenNthCalledWith(2, 20, 20)
  })

  it('约 30Hz：一秒内高频事件至多发出约 30 次', () => {
    const send = vi.fn()
    const push = createMouseMoveThrottle(MOUSE_MOVE_INTERVAL_MS, send)

    for (let i = 0; i < 500; i++) {
      push(i, i)
      vi.advanceTimersByTime(2) // 500Hz 输入
    }
    expect(send.mock.calls.length).toBeLessThanOrEqual(31)
    expect(send.mock.calls.length).toBeGreaterThan(20)
  })
})

describe('isGlobalMouseTrackingSupported', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform)
    vi.unstubAllEnvs()
  })

  it('Linux Wayland 会话：不支持（静默降级为窗口内追踪）', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    vi.stubEnv('XDG_SESSION_TYPE', 'wayland')
    expect(isGlobalMouseTrackingSupported()).toBe(false)
  })

  it('Linux X11 会话：支持', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    vi.stubEnv('XDG_SESSION_TYPE', 'x11')
    expect(isGlobalMouseTrackingSupported()).toBe(true)
  })

  it('Windows：支持', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(isGlobalMouseTrackingSupported()).toBe(true)
  })
})
