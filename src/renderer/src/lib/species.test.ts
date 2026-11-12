import { describe, expect, it } from 'vitest'
import {
  SPECIES_LIST,
  DEFAULT_SPECIES,
  CLASSIC_FISH_PALETTES,
  resolveSpecies,
  resolvePalette,
  type FishMood
} from './species'

const ALL_MOODS: FishMood[] = ['sad', 'nervous', 'happy', 'normal', 'scared', 'sleeping']
const HEX = /^#[0-9a-f]{6}$/i

describe('SPECIES_LIST 物种注册表 (ADR 0008)', () => {
  it('首项是默认经典小鱼物种', () => {
    expect(DEFAULT_SPECIES.id).toBe('classic-fish')
    expect(DEFAULT_SPECIES.modelId).toBe('classic-fish')
  })

  it('物种 id 唯一', () => {
    const ids = SPECIES_LIST.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('经典小鱼的调色板齐全：6 心情 × 身/尾/鳍，色值均为合法 hex', () => {
    for (const palette of CLASSIC_FISH_PALETTES) {
      expect(palette.previewColor).toMatch(HEX)
      for (const mood of ALL_MOODS) {
        for (const part of ['body', 'tail', 'fin'] as const) {
          expect(palette.colors[mood][part], `${palette.id}/${mood}/${part}`).toMatch(HEX)
        }
      }
    }
  })
})

describe('resolveSpecies', () => {
  it('已知物种 id 返回对应物种', () => {
    for (const sp of SPECIES_LIST) {
      expect(resolveSpecies(sp.id)).toBe(sp)
    }
  })

  it('未知 id / undefined 回退默认物种', () => {
    expect(resolveSpecies('unknown')).toBe(DEFAULT_SPECIES)
    expect(resolveSpecies('')).toBe(DEFAULT_SPECIES)
    expect(resolveSpecies(undefined)).toBe(DEFAULT_SPECIES)
  })
})

describe('resolvePalette', () => {
  it('已知调色方案 id 返回对应调色方案', () => {
    for (const p of CLASSIC_FISH_PALETTES) {
      expect(resolvePalette(DEFAULT_SPECIES, p.id).id).toBe(p.id)
    }
  })

  it('未知调色 id 回退物种的默认调色方案', () => {
    const fallback = resolvePalette(DEFAULT_SPECIES, 'non-existent')
    expect(fallback.id).toBe(DEFAULT_SPECIES.defaultPaletteId)
  })
})

