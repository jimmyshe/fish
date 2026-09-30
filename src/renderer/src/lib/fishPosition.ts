/** 鱼元素容器尺寸（气泡 + 鱼的组合区域），与 DesktopPet.vue 的 .pet-wrapper 保持一致 */
export const FISH_CONTAINER_WIDTH = 320
export const FISH_CONTAINER_HEIGHT = 200

/** 默认锚点：屏幕右下角附近（沿用旧小窗的默认落点） */
export const FISH_DEFAULT_MARGIN_X = 340
export const FISH_DEFAULT_MARGIN_Y = 220

export interface FishPosition {
  x: number
  y: number
}

/**
 * 初始位置：配置值有效（≥0）则沿用持久化位置，
 * 否则落回屏幕右下角附近。
 */
export function resolveInitialFishPosition(
  configX: number,
  configY: number,
  screenWidth: number,
  screenHeight: number
): FishPosition {
  if (configX >= 0 && configY >= 0) {
    return clampFishPosition(configX, configY, screenWidth, screenHeight)
  }
  return {
    x: screenWidth - FISH_DEFAULT_MARGIN_X,
    y: screenHeight - FISH_DEFAULT_MARGIN_Y
  }
}

/** 把鱼元素位置收敛到屏幕范围内（容器整体不跑出屏幕） */
export function clampFishPosition(
  x: number,
  y: number,
  screenWidth: number,
  screenHeight: number
): FishPosition {
  return {
    x: Math.min(Math.max(x, 0), Math.max(screenWidth - FISH_CONTAINER_WIDTH, 0)),
    y: Math.min(Math.max(y, 0), Math.max(screenHeight - FISH_CONTAINER_HEIGHT, 0))
  }
}
