import fs from 'node:fs'
import path from 'node:path'

/**
 * 校验 renderer 目录下是否有裸调 setTimeout / setInterval 的行为。
 * 依据 AGENTS.md 规范：所有定时驱动行为必须由 PetScheduler 统一属主。
 */

const TARGET_DIR = path.resolve('src/renderer/src')
const EXCLUDE_FILE = 'PetScheduler.ts'

function walk(dir) {
  let files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(walk(fullPath))
    } else if (
      /\.(ts|vue|js)$/.test(entry.name) &&
      !entry.name.includes('.test.') &&
      !entry.name.endsWith(EXCLUDE_FILE)
    ) {
      files.push(fullPath)
    }
  }
  return files
}

const files = walk(TARGET_DIR)
const violations = []

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split('\n')
  lines.forEach((line, index) => {
    // 匹配裸调用 setTimeout(...) 或 setInterval(...)
    if (/\b(setTimeout|setInterval)\s*\(/.test(line)) {
      violations.push({
        file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
        line: index + 1,
        code: line.trim()
      })
    }
  })
}

if (violations.length > 0) {
  console.error('\n❌ 发现违规原生定时器调用！所有定时行为必须由 PetScheduler (usePetScheduler) 统一调度：\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.code}`)
  }
  console.error('')
  process.exit(1)
} else {
  console.log('✅ PetScheduler 定时器规范检查通过（无裸 setTimeout/setInterval）。')
}

