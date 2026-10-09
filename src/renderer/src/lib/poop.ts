import { fishCenter, type Vec } from './fishMotion'
import type { FishPosition } from './fishPosition'

// Poop 类型定义在 shared/config（三进程共用，config.poops 持久化用同一类型）
import type { Poop } from '../../../shared/config'
export type { Poop }

/**
 * 排泄模块：拉屎间隔与落点的纯函数。
 * 屎列表与渲染归 DesktopPet 组件持有，本模块只提供可测的计算。
 */

export const POOP = {
  MIN_INTERVAL_MS: 15 * 60 * 1000, // 定时排泄最小间隔
  MAX_INTERVAL_MS: 30 * 60 * 1000, // 定时排泄最大间隔
  TAIL_OFFSET_X: 70, // 落点相对鱼中心的水平偏移（朝鱼尾方向）
  DROP_OFFSET_Y: 30 // 落点相对鱼中心的垂直偏移（向下）
} as const

/** 下一泡的随机间隔（毫秒），rand 可注入以便测试 */
export function nextPoopDelayMs(rand: () => number = Math.random): number {
  return POOP.MIN_INTERVAL_MS + rand() * (POOP.MAX_INTERVAL_MS - POOP.MIN_INTERVAL_MS)
}

/** 拉屎落点（屏幕坐标）：鱼尾后方偏下，随朝向镜像 */
export function poopDropPosition(fishPos: FishPosition, facing: 1 | -1): Vec {
  const center = fishCenter(fishPos)
  return {
    x: center.x - facing * POOP.TAIL_OFFSET_X,
    y: center.y + POOP.DROP_OFFSET_Y
  }
}

/** 序列化为纯对象：Vue 响应式代理无法通过 IPC 结构化克隆（抛 DOMException），持久化前必须转换 */
export function serializePoops(poops: Poop[]): Poop[] {
  return poops.map(p => ({ id: p.id, x: p.x, y: p.y }))
}
