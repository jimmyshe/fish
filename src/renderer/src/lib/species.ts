import type { PetMood } from './petTime'

/**
 * 物种与调色方案注册表：renderer 属主（ADR 0008）。
 * - 物种 (Species): 宠物的基本解剖形态与模型骨架，决定渲染用的模型组件。
 * - 调色 (Palette): 某物种专属支持的具名颜色方案（6 有效心情 × 各部位色值）。
 * 主进程只把 speciesId / paletteId 当不透明字符串持久化，不消费本模块。
 */

/** 有效心情：4 基础心情 + 受惊/睡眠两个覆盖层，是调色板的键全集 */
export type FishMood = PetMood | 'scared' | 'sleeping'

export interface FishSkinPalette {
  [mood in FishMood]: { body: string; tail: string; fin: string }
}

export interface Palette {
  id: string
  name: string
  previewColor: string
  colors: FishSkinPalette
}

/** 传给模型组件的只读单向 Props（ADR 0008） */
export interface PetModelProps {
  effectiveMood: FishMood
  facingLeft: boolean
  mousePos: { x: number; y: number }
  isScared: boolean
  isSleeping: boolean
  isPooping: boolean
  isRainbow: boolean
  palette?: FishSkinPalette
}

export interface PetSpecies {
  id: string
  name: string
  icon: string
  modelId: string
  /** 该物种支持的调色方案列表；为空表示单调色物种，只用专属原色 */
  palettes: readonly Palette[]
  /** 默认调色方案 id */
  defaultPaletteId: string
  /** 专属/固定外观代表色（若没有调色板时作为预览色） */
  previewColor?: string
}

export const CLASSIC_FISH_PALETTES: readonly Palette[] = [
  {
    id: 'default',
    name: '默认',
    previewColor: '#74b9ff',
    colors: {
      sad: { body: '#a29bfe', tail: '#6c5ce7', fin: '#9b8af4' },
      nervous: { body: '#fd79a8', tail: '#e84393', fin: '#fc5c8a' },
      happy: { body: '#fdcb6e', tail: '#e17055', fin: '#ffeaa7' },
      normal: { body: '#74b9ff', tail: '#0984e3', fin: '#a8d8f0' },
      scared: { body: '#ff7675', tail: '#d63031', fin: '#fab1a0' },
      sleeping: { body: '#b2bec3', tail: '#636e72', fin: '#dfe6e9' }
    }
  },
  {
    id: 'koi',
    name: '金鲤',
    previewColor: '#ff9d4d',
    colors: {
      sad: { body: '#d8a878', tail: '#a87848', fin: '#e8cdb0' },
      nervous: { body: '#ff7e6b', tail: '#e0523f', fin: '#ffb8a8' },
      happy: { body: '#ffb648', tail: '#f08c1e', fin: '#ffe3b3' },
      normal: { body: '#ff9d4d', tail: '#e0762e', fin: '#ffd3a8' },
      scared: { body: '#ff6b5b', tail: '#c0392b', fin: '#ffb3a7' },
      sleeping: { body: '#c2a888', tail: '#8f7a5c', fin: '#dccfb8' }
    }
  },
  {
    id: 'sakura',
    name: '樱花',
    previewColor: '#ffb7c5',
    colors: {
      sad: { body: '#d8a8c0', tail: '#a87898', fin: '#e8d0dc' },
      nervous: { body: '#ff8fa5', tail: '#e05c7e', fin: '#ffc4d1' },
      happy: { body: '#ffc9d6', tail: '#f08ca8', fin: '#fff0f4' },
      normal: { body: '#ffb7c5', tail: '#e8789a', fin: '#ffe3ea' },
      scared: { body: '#ff6b8a', tail: '#d63060', fin: '#ffb3c4' },
      sleeping: { body: '#c8a8b8', tail: '#98788a', fin: '#dcc8d2' }
    }
  },
  {
    id: 'ink',
    name: '水墨',
    previewColor: '#4a5560',
    colors: {
      sad: { body: '#566078', tail: '#37405a', fin: '#8a95b0' },
      nervous: { body: '#8a6a6a', tail: '#5f4242', fin: '#b59898' },
      happy: { body: '#6b7a8a', tail: '#45525f', fin: '#a5b2c0' },
      normal: { body: '#4a5560', tail: '#2d3742', fin: '#8a97a5' },
      scared: { body: '#a85a5a', tail: '#7a3535', fin: '#c89090' },
      sleeping: { body: '#4a4f55', tail: '#2a2e33', fin: '#7a8188' }
    }
  },
  {
    id: 'cyber',
    name: '赛博',
    previewColor: '#00c8d4',
    colors: {
      sad: { body: '#5a6ad8', tail: '#374399', fin: '#99a5e8' },
      nervous: { body: '#ff4dcf', tail: '#d100a0', fin: '#ff9ee6' },
      happy: { body: '#33f5ff', tail: '#00b8d9', fin: '#b3f9ff' },
      normal: { body: '#00c8d4', tail: '#00879c', fin: '#9be8ee' },
      scared: { body: '#ff3355', tail: '#cc0022', fin: '#ff8899' },
      sleeping: { body: '#3a4a55', tail: '#223038', fin: '#5f7580' }
    }
  }
]

export const SPECIES_LIST: readonly PetSpecies[] = [
  {
    id: 'classic-fish',
    name: '经典小鱼',
    icon: '🐟',
    modelId: 'classic-fish',
    palettes: CLASSIC_FISH_PALETTES,
    defaultPaletteId: 'default',
    previewColor: '#74b9ff'
  },
  {
    id: 'orca',
    name: '虎鲸',
    icon: '🐋',
    modelId: 'orca',
    palettes: [],
    defaultPaletteId: 'default',
    previewColor: '#2d3436'
  }
]

export const DEFAULT_SPECIES = SPECIES_LIST[0]

export function resolveSpecies(speciesId?: string): PetSpecies {
  return SPECIES_LIST.find((s) => s.id === speciesId) ?? DEFAULT_SPECIES
}

export function resolvePalette(species: PetSpecies, paletteId?: string): Palette {
  return (
    species.palettes.find((p) => p.id === paletteId) ??
    species.palettes.find((p) => p.id === species.defaultPaletteId) ??
    species.palettes[0] ?? {
      id: 'default',
      name: '原色',
      previewColor: species.previewColor ?? '#74b9ff',
      colors: CLASSIC_FISH_PALETTES[0].colors
    }
  )
}

