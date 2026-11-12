// 生成全套应用图标、安装器图标与托盘图标：
// - build/icon.ico (Windows 复合多尺寸 16, 24, 32, 48, 64, 128, 256)
// - build/icon.png (Linux 512x512 高清包图标)
// - src/main/app-icon.png (256x256 运行期窗口图标)
// - src/main/tray-icon.png (32x32 系统托盘图标)
// 用法：npm run generate:icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const BODY = [0x74, 0xb9, 0xff]
const TAIL = [0x09, 0x84, 0xe3]
const EYE_WHITE = [0xff, 0xff, 0xff]
const EYE_DARK = [0x1a, 0x1a, 0x2e]

/** 点是否在三角形内（重心法） */
function triangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by)
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy)
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return neg && pos ? 0 : 1
}

/**
 * 按照指定像素边长生成透明背景的经典小鱼 PNG
 * @param {number} SIZE 目标像素边长
 * @returns {Buffer} PNG 编码字节流
 */
export function generateFishPng(SIZE) {
  const SS = SIZE <= 32 ? 4 : (SIZE <= 64 ? 4 : 2)
  const N = SIZE * SS
  const k = SS
  const scale = SIZE / 32

  const buf = new Uint8Array(N * N * 4)

  function plot(buf, x, y, color, alpha) {
    if (x < 0 || x >= N || y < 0 || y >= N) return
    const i = (y * N + x) * 4
    buf[i] = Math.round(color[0] * alpha + buf[i] * (1 - alpha))
    buf[i + 1] = Math.round(color[1] * alpha + buf[i + 1] * (1 - alpha))
    buf[i + 2] = Math.round(color[2] * alpha + buf[i + 2] * (1 - alpha))
    buf[i + 3] = Math.round((alpha + (buf[i + 3] / 255) * (1 - alpha)) * 255)
  }

  // 形状参数（以 32x32 为基准等比缩放）
  const tail = [
    [13 * scale * k, 15.5 * scale * k],
    [2 * scale * k, 9 * scale * k],
    [2 * scale * k, 24 * scale * k]
  ]
  const BODY_C = [19.5 * scale * k, 16 * scale * k]
  const BODY_R = [11.5 * scale * k, 7.5 * scale * k]
  const EYE_C = [25 * scale * k, 13.5 * scale * k]
  const EYE_R = 3 * scale * k
  const PUPIL_R = 1.7 * scale * k

  const is32 = (SIZE === 32)

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cx = x + 0.5
      const cy = y + 0.5

      // 尾部
      if (triangle(cx, cy, ...tail.flat())) {
        plot(buf, x, y, TAIL, 1)
      }

      // 身体与眼睛
      if (is32) {
        // 与既有 32x32 tray-icon.png 保持 100% 像素级一致
        const dx = (cx - BODY_C[0]) / BODY_R[0]
        const dy = (cy - BODY_C[1]) / BODY_R[1]
        const e = dx * dx + dy * dy - 1
        if (e < 0.06) {
          plot(buf, x, y, BODY, e < -0.06 ? 1 : 0.5)
        }
        const dEye = Math.hypot(cx - EYE_C[0], cy - EYE_C[1])
        if (dEye < EYE_R) {
          plot(buf, x, y, EYE_WHITE, dEye > EYE_R - 1 ? 0.5 : 1)
        }
        if (dEye < PUPIL_R) {
          plot(buf, x, y, EYE_DARK, dEye > PUPIL_R - 0.8 ? 0.5 : 1)
        }
      } else {
        // 任意尺寸高平滑抗锯齿
        const dx = (cx - BODY_C[0]) / BODY_R[0]
        const dy = (cy - BODY_C[1]) / BODY_R[1]
        const dist = Math.hypot(dx, dy)
        if (dist <= 1.0) {
          plot(buf, x, y, BODY, 1)
        } else if (dist <= 1.0 + 1 / (scale * k)) {
          const a = 1 - (dist - 1.0) / (1 / (scale * k))
          plot(buf, x, y, BODY, a)
        }

        const dEye = Math.hypot(cx - EYE_C[0], cy - EYE_C[1])
        if (dEye <= EYE_R) {
          plot(buf, x, y, EYE_WHITE, 1)
        } else if (dEye <= EYE_R + 1) {
          plot(buf, x, y, EYE_WHITE, 1 - (dEye - EYE_R))
        }

        if (dEye <= PUPIL_R) {
          plot(buf, x, y, EYE_DARK, 1)
        } else if (dEye <= PUPIL_R + 1) {
          plot(buf, x, y, EYE_DARK, 1 - (dEye - PUPIL_R))
        }
      }
    }
  }

  // 盒式降采样 SS×SS -> 1
  const out = new Uint8Array(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0
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

  // 编码 PNG
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
  const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
  for (let y = 0; y < SIZE; y++) {
    raw[y * (1 + SIZE * 4)] = 0
    Buffer.from(out.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (1 + SIZE * 4) + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/**
 * 将多尺寸 PNG 流封装为 Windows .ico 复合图标
 * @param {Array<{ size: number, buffer: Buffer }>} entries
 * @returns {Buffer}
 */
export function buildIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = ICO
  header.writeUInt16LE(count, 4) // 图标张数

  let currentOffset = 6 + count * 16
  const dirEntries = []
  for (const item of entries) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(item.size >= 256 ? 0 : item.size, 0) // 0 表示 256px
    entry.writeUInt8(item.size >= 256 ? 0 : item.size, 1)
    entry.writeUInt8(0, 2) // 0 表示无颜色表或 >= 8bpp
    entry.writeUInt8(0, 3) // 保留
    entry.writeUInt16LE(1, 4) // planes = 1
    entry.writeUInt16LE(32, 6) // bpp = 32
    entry.writeUInt32LE(item.buffer.length, 8) // 数据长度
    entry.writeUInt32LE(currentOffset, 12) // 文件内绝对偏移
    dirEntries.push(entry)
    currentOffset += item.buffer.length
  }

  return Buffer.concat([header, ...dirEntries, ...entries.map((x) => x.buffer)])
}

// 执行生成并输出到各目录
console.log('Generating Fish Pet application icons...')

// 1. 确保 build 目录存在
mkdirSync(join(ROOT, 'build'), { recursive: true })

// 2. 生成 Windows 复合多尺寸 ICO (16, 24, 32, 48, 64, 128, 256)
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoEntries = icoSizes.map((size) => {
  const buffer = generateFishPng(size)
  console.log(`  - Rendered ${size}x${size} PNG (${buffer.length} bytes)`)
  return { size, buffer }
})
const icoBuffer = buildIco(icoEntries)
const icoDest = join(ROOT, 'build/icon.ico')
writeFileSync(icoDest, icoBuffer)
console.log(`✓ Written ${icoDest} (${icoBuffer.length} bytes)`)

// 3. 生成 Linux 512x512 PNG 图标
const linuxPng = generateFishPng(512)
const linuxPngDest = join(ROOT, 'build/icon.png')
writeFileSync(linuxPngDest, linuxPng)
console.log(`✓ Written ${linuxPngDest} (${linuxPng.length} bytes)`)

// 4. 生成 32x32 系统托盘图标
const trayPng = icoEntries.find((e) => e.size === 32).buffer
const trayDest = join(ROOT, 'src/main/tray-icon.png')
writeFileSync(trayDest, trayPng)
console.log(`✓ Written ${trayDest} (${trayPng.length} bytes)`)

// 5. 生成 256x256 运行期窗口图标
const appIconPng = icoEntries.find((e) => e.size === 256).buffer
const appIconDest = join(ROOT, 'src/main/app-icon.png')
writeFileSync(appIconDest, appIconPng)
console.log(`✓ Written ${appIconDest} (${appIconPng.length} bytes)`)

console.log('All icons generated successfully.')

