import type { UiohookKeyboardEvent, UiohookKey } from 'uiohook-napi'

const MODIFIERS = ['Ctrl', 'Alt', 'Shift'] as const

export function normalizeFeedShortcut(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const parts = input.toUpperCase().split('+').map((part) => part.trim())
  const key = parts.pop()
  if (!key || !/^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4]))$/.test(key)) return null

  const modifiers = MODIFIERS.filter((modifier) => parts.includes(modifier.toUpperCase()))
  if (modifiers.length !== parts.length || !(modifiers.includes('Ctrl') || modifiers.includes('Alt'))) {
    return null
  }
  return [...modifiers, key].join('+')
}

/** 投喂快捷键及其修饰键按下不计入搬砖活动，也不会唤醒小鱼。 */
export function isFeedShortcutInput(
  event: UiohookKeyboardEvent,
  shortcut: string,
  keys: typeof UiohookKey
): boolean {
  const parts = shortcut.split('+')
  const key = parts.pop() as keyof typeof UiohookKey

  const ctrl = parts.includes('Ctrl')
  const alt = parts.includes('Alt')
  const shift = parts.includes('Shift')
  if (ctrl && (event.keycode === keys.Ctrl || event.keycode === keys.CtrlRight)) return true
  if (alt && (event.keycode === keys.Alt || event.keycode === keys.AltRight)) return true
  if (shift && (event.keycode === keys.Shift || event.keycode === keys.ShiftRight)) return true

  return event.keycode === keys[key] && event.ctrlKey === ctrl && event.altKey === alt &&
    event.shiftKey === shift && !event.metaKey
}
