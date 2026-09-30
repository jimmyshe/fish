import { FISH_CONTAINER_HEIGHT, FISH_CONTAINER_WIDTH, type FishPosition } from './fishPosition'

/**
 * 鱼的运动模块：漫游 / 避鼠 / 逃窜的转向力模型。
 * 全部为纯函数：组件持有运动状态，每个 tick 调用 integrate 推进。
 */

export const MOTION = {
  TICK_MS: 33, // ~30Hz
  CRUISE_MIN: 40, // 巡航速度 px/s
  CRUISE_MAX: 80,
  MAX_SPEED: 150, // 避让加速时的速度上限
  TURN_RATE: 3, // 转向速率（1/s）：速度向量朝目标速度逼近的系数
  WANDER_JITTER: 0.15, // 每 tick 漫游角随机抖动（弧度）
  AVOID_RADIUS: 320, // 回避场半径：鼠标进入即产生推离力
  AVOID_STRENGTH: 600, // 回避加速度 px/s²（贴脸最大）
  NEAR_RADIUS: 80, // 贴脸半径：快速进入触发受惊逃窜
  EDGE_MARGIN: 120, // 边缘软斥力带宽
  EDGE_STRENGTH: 600,
  DASH_SPEED: 400, // 逃窜冲刺速度 px/s
  DASH_MS: 450,
  SWIM_LEG_MIN_MS: 8000, // 一段连续游动的时长
  SWIM_LEG_MAX_MS: 20000,
  PAUSE_MIN_MS: 2000, // 停歇时长
  PAUSE_MAX_MS: 5000,
  FACE_DEADZONE: 5, // 水平速度死区：低于则保持上次朝向，避免抖动
  SCARE_SPEED: 2.5 // 受惊速度阈值 px/ms（沿用旧判定）
} as const

export interface Vec {
  x: number
  y: number
}

export const FISH_CONTAINER: Vec = { x: FISH_CONTAINER_WIDTH, y: FISH_CONTAINER_HEIGHT }

/** 鱼容器中心点（距离判定以中心为准） */
export function fishCenter(pos: FishPosition): Vec {
  return { x: pos.x + FISH_CONTAINER_WIDTH / 2, y: pos.y + FISH_CONTAINER_HEIGHT / 2 }
}

/**
 * 鼠标回避场：鼠标在回避半径内时，产生随距离线性衰减的推离加速度。
 * 鼠标无数据（null）或恰在中心（方向不定）时返回零向量。
 */
export function avoidanceForce(center: Vec, mouse: Vec | null, radius: number, strength: number): Vec {
  if (!mouse) return { x: 0, y: 0 }
  const dx = center.x - mouse.x
  const dy = center.y - mouse.y
  const dist = Math.hypot(dx, dy)
  if (dist >= radius || dist === 0) return { x: 0, y: 0 }
  const mag = strength * (1 - dist / radius)
  return { x: (dx / dist) * mag, y: (dy / dist) * mag }
}

/** 边缘软斥力：容器靠近屏幕边缘（margin 带宽内）时受到向内的加速度，中心区域为零 */
export function edgeForce(pos: Vec, container: Vec, screen: Vec, margin: number, strength: number): Vec {
  let fx = 0
  let fy = 0
  if (pos.x < margin) fx += strength * (1 - pos.x / margin)
  const gapRight = screen.x - container.x - pos.x
  if (gapRight < margin) fx -= strength * (1 - gapRight / margin)
  if (pos.y < margin) fy += strength * (1 - pos.y / margin)
  const gapBottom = screen.y - container.y - pos.y
  if (gapBottom < margin) fy -= strength * (1 - gapBottom / margin)
  return { x: fx, y: fy }
}

/**
 * 速度积分：先朝目标速度平滑转向，再叠加各转向力，最后按上限截断。
 * dt 单位秒，返回新速度向量。
 */
export function integrateVelocity(
  vel: Vec,
  desired: Vec,
  forces: Vec[],
  dt: number,
  maxSpeed: number,
  turnRate: number
): Vec {
  const t = Math.min(1, turnRate * dt)
  let vx = vel.x + (desired.x - vel.x) * t
  let vy = vel.y + (desired.y - vel.y) * t
  for (const f of forces) {
    vx += f.x * dt
    vy += f.y * dt
  }
  const speed = Math.hypot(vx, vy)
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed
    vy = (vy / speed) * maxSpeed
  }
  return { x: vx, y: vy }
}

/** 漫游角抖动：每 tick 随机游走，rand 可注入以便测试 */
export function stepWanderAngle(angle: number, jitter: number, rand: () => number = Math.random): number {
  return angle + (rand() - 0.5) * jitter
}

/** 朝向：水平速度过小时保持上次朝向，避免抖动 */
export function computeFacing(vx: number, prev: 1 | -1, deadzone: number): 1 | -1 {
  if (Math.abs(vx) < deadzone) return prev
  return vx < 0 ? -1 : 1
}

/** 逃窜方向：远离鼠标（单位向量）；鼠标无数据或恰在中心时随机方向 */
export function dashDirection(center: Vec, mouse: Vec | null, rand: () => number = Math.random): Vec {
  if (mouse) {
    const dx = center.x - mouse.x
    const dy = center.y - mouse.y
    const dist = Math.hypot(dx, dy)
    if (dist >= 1) return { x: dx / dist, y: dy / dist }
  }
  const angle = rand() * Math.PI * 2
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

/**
 * 受惊判定：鼠标「快速」（速度超阈值）且「贴近」（进入贴脸半径）才触发。
 * 慢慢靠近只是把鱼推开（回避场），不惊吓它。
 */
export function shouldScare(speedPxPerMs: number, dist: number, nearRadius: number, scareSpeed: number): boolean {
  return dist < nearRadius && speedPxPerMs > scareSpeed
}
