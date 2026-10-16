import type { PetMood } from './petTime'

/**
 * 皮肤注册表：renderer 属主（ADR 0006）。
 * 皮肤 = 具名完整调色板（6 有效心情 × 身/尾/鳍 = 18 色值），纯数据 + 查表，无颜色数学。
 * 主进程只把 skinId 当不透明字符串持久化，不消费本模块。
 */

/** 有效心情：4 基础心情 + 受惊/睡眠两个覆盖层，是调色板的键全集 */
export type FishMood = PetMood | 'scared' | 'sleeping'

export interface FishSkinPalette {
  [mood in FishMood]: { body: string; tail: string; fin: string }
}

export interface FishSkin {
  id: string
  name: string
  palette: FishSkinPalette
}

/** 注册表首项恒为默认皮肤：色值 = 旧硬编码表原样，保证零行为变化 */
export const SKINS: readonly FishSkin[] = [
  {
    id: 'default',
    name: '默认',
    palette: {
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
    palette: {
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
    palette: {
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
    palette: {
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
    palette: {
      sad: { body: '#5a6ad8', tail: '#374399', fin: '#99a5e8' },
      nervous: { body: '#ff4dcf', tail: '#d100a0', fin: '#ff9ee6' },
      happy: { body: '#33f5ff', tail: '#00b8d9', fin: '#b3f9ff' },
      normal: { body: '#00c8d4', tail: '#00879c', fin: '#9be8ee' },
      scared: { body: '#ff3355', tail: '#cc0022', fin: '#ff8899' },
      sleeping: { body: '#3a4a55', tail: '#223038', fin: '#5f7580' }
    }
  }
]

export const DEFAULT_SKIN: FishSkin = SKINS[0]

/** 未知 id 回退默认皮肤（渲染侧唯一回退点；config 加载合并时未知值不会在这里出现，但手工改 config.json 会） */
export function resolveSkin(id: string): FishSkin {
  return SKINS.find((skin) => skin.id === id) ?? DEFAULT_SKIN
}
