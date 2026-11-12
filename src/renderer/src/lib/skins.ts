import {
  CLASSIC_FISH_PALETTES,
  type FishMood,
  type FishSkinPalette,
  type Palette
} from './species'

export type { FishMood, FishSkinPalette }

export interface FishSkin {
  id: string
  name: string
  palette: FishSkinPalette
}

/** 兼容老版本 SKINS 列表：直接映射自经典鱼的调色板 */
export const SKINS: readonly FishSkin[] = CLASSIC_FISH_PALETTES.map((p: Palette) => ({
  id: p.id,
  name: p.name,
  palette: p.colors
}))

export const DEFAULT_SKIN: FishSkin = SKINS[0]

/** 未知 id 回退默认皮肤 */
export function resolveSkin(id: string): FishSkin {
  return SKINS.find((skin) => skin.id === id) ?? DEFAULT_SKIN
}
