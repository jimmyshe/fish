import { describe, expect, it } from 'vitest'
import { DEFAULT_SKIN, resolveSkin, SKINS, type FishMood } from './skins'

const ALL_MOODS: FishMood[] = ['sad', 'nervous', 'happy', 'normal', 'scared', 'sleeping']
const HEX = /^#[0-9a-f]{6}$/i

describe('SKINS 注册表', () => {
  it('首项是默认皮肤（resolveSkin 的回退目标）', () => {
    expect(DEFAULT_SKIN.id).toBe('default')
  })

  it('id 唯一', () => {
    const ids = SKINS.map((skin) => skin.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每套皮肤调色板齐全：6 心情 × 身/尾/鳍，色值均为合法 hex', () => {
    for (const skin of SKINS) {
      for (const mood of ALL_MOODS) {
        for (const part of ['body', 'tail', 'fin'] as const) {
          expect(skin.palette[mood][part], `${skin.id}/${mood}/${part}`).toMatch(HEX)
        }
      }
    }
  })

  it('默认皮肤与旧硬编码表逐值相等（零行为变化护栏）', () => {
    expect(DEFAULT_SKIN.palette.normal).toEqual({ body: '#74b9ff', tail: '#0984e3', fin: '#a8d8f0' })
    expect(DEFAULT_SKIN.palette.sad).toEqual({ body: '#a29bfe', tail: '#6c5ce7', fin: '#9b8af4' })
    expect(DEFAULT_SKIN.palette.scared).toEqual({ body: '#ff7675', tail: '#d63031', fin: '#fab1a0' })
  })
})

describe('resolveSkin', () => {
  it('已知 id 返回对应皮肤', () => {
    for (const skin of SKINS) {
      expect(resolveSkin(skin.id)).toBe(skin)
    }
  })

  it('未知 id / 空串回退默认皮肤', () => {
    expect(resolveSkin('nope')).toBe(DEFAULT_SKIN)
    expect(resolveSkin('')).toBe(DEFAULT_SKIN)
  })
})
