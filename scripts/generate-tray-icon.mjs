// 生成托盘图标 src/main/tray-icon.png（32×32 透明底小鱼）。
// 形状取自 DesktopPet.vue 的鱼 SVG：左尾三角 + 椭圆身 + 右眼。
// 4× 超采样后盒式降采样，边缘更平滑。用法：npm run generate:tray-icon
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 32
const SS = 4 // 超采样倍数
const N = SIZE * SS

// 与鱼 SVG 同色系
const BODY = [0x74, 0xb9, 0xff]
const TAIL = [0x09, 0x84, 0xe3]
const EYE_WHITE = [0xff, 0xff, 0xff]
const EYE_DARK = [0x1a, 0x1a, 0x2e]

const px = N // 每行字节数（RGBA）

/** 在超采样画布上画一个像素点（带颜色混合） */
function plot(buf, x, y, color, alpha) {
  if (x < 0 || x >= N || y < 0 || y >= N) return
  const i = (y * N + x) * 4
  buf[i] = Math.round(color[0] * alpha + buf[i] * (1 - alpha))
  buf[i + 1] = Math.round(color[1] * alpha + buf[i + 1] * (1 - alpha))
  buf[i + 2] = Math.round(color[2] * alpha + buf[i + 2] * (1 - alpha))
  buf[i + 3] = Math.round((alpha + (buf[i + 3] / 255) * (1 - alpha)) * 255)
}

/** 椭圆 SDF：内部为负 */
function ellipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy - 1
}

/** 点是否在三角形内（重心法），返回带边缘过渡的覆盖率 0~1 */
function triangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by)
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy)
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return neg && pos ? 0 : 1
}

// 超采样画布：全透明
const buf = new Uint8Array(N * N * 4)
for (let i = 3; i < buf.length; i += 4) buf[i] = 0

// 形状参数（32×32 坐标系，SS 放大到画布）
const k = SS
// 鱼尾：左尖三角（SVG: 18,40 / 0,20 / 0,60 → 32 网格）
const tail = [
  [13 * k, 15.5 * k],
  [2 * k, 9 * k],
  [2 * k, 24 * k]
]
// 鱼身：椭圆（SVG 身 cx60 cy40 rx40 ry24 等比缩到 32 网格）
const BODY_C = [19.5 * k, 16 * k]
const BODY_R = [11.5 * k, 7.5 * k]
// 眼睛（SVG: 白圆 84,34 r8；瞳孔 84,34 r5）
const EYE_C = [25 * k, 13.5 * k]
const EYE_R = 3 * k
const PUPIL_R = 1.7 * k

for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const cx = x + 0.5
    const cy = y + 0.5
    // 尾（带 1px 过渡边）
    if (triangle(cx, cy, ...tail.flat())) {
      plot(buf, x, y, TAIL, 1)
    }
    // 身（SDF 过渡带 ~1px）
    const e = ellipse(cx, cy, ...BODY_C, ...BODY_R)
    if (e < 0.06) {
      plot(buf, x, y, BODY, e < -0.06 ? 1 : 0.5)
    }
    // 眼白 + 瞳孔
    const dEye = Math.hypot(cx - EYE_C[0], cy - EYE_C[1])
    if (dEye < EYE_R) {
      plot(buf, x, y, EYE_WHITE, dEye > EYE_R - 1 ? 0.5 : 1)
    }
    if (dEye < PUPIL_R) {
      plot(buf, x, y, EYE_DARK, dEye > PUPIL_R - 0.8 ? 0.5 : 1)
    }
  }
}

// 盒式降采样 SS×SS → 1
const out = new Uint8Array(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * N + (x * SS + sx)) * 4
        const aa = buf[i + 3] / 255
        a += aa
        r += buf[i] * aa
        g += buf[i + 1] * aa
        b += buf[i + 2] * aa
      }
    }
    const n = SS * SS
    const o = (y * SIZE + x) * 4
    out[o] = a > 0 ? Math.round(r / a) : 0
    out[o + 1] = a > 0 ? Math.round(g / a) : 0
    out[o + 2] = a > 0 ? Math.round(b / a) : 0
    out[o + 3] = Math.round((a / n) * 255)
  }
}

// ── 编码 PNG ──
const crcTable = new Int32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(bytes) {
  let c = 0xffffffff
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
// 每行前置 filter byte 0
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0
  Buffer.from(out.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (1 + SIZE * 4) + 1)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const dest = join(dirname(fileURLToPath(import.meta.url)), '../src/main/tray-icon.png')
writeFileSync(dest, png)
console.log(`written ${dest} (${png.length} bytes)`)
