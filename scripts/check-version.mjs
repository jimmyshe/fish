import fs from 'node:fs'
import path from 'node:path'

/**
 * 校验客户端版本号在 package.json、package-lock.json 与 README.md 间保持一致；
 * CI 按 v* tag 触发时额外校验 tag 与 package.json 版本一致。
 */

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
const lock = JSON.parse(fs.readFileSync(path.resolve('package-lock.json'), 'utf8'))
const readmeFirstLine = fs.readFileSync(path.resolve('README.md'), 'utf8').split(/\r?\n/, 1)[0]

const pkgVersion = pkg.version
const lockVersion = lock.version
const lockRootVersion = lock.packages?.['']?.version
const readmeMatch = readmeFirstLine.match(/^# Fish Pet .*`v(\d+\.\d+\.\d+)`/)
const readmeVersion = readmeMatch?.[1]

const mismatches = []

if (lockVersion !== pkgVersion) {
  mismatches.push(`package-lock.json root version (${lockVersion}) != package.json (${pkgVersion})`)
}
if (lockRootVersion !== pkgVersion) {
  mismatches.push(
    `package-lock.json packages[""].version (${lockRootVersion}) != package.json (${pkgVersion})`
  )
}
if (readmeVersion !== pkgVersion) {
  mismatches.push(
    `README.md 标题版本号 (${readmeVersion ?? '未匹配'}) != package.json (${pkgVersion})`
  )
}

const refName = process.env.GITHUB_REF_NAME
if (refName && refName.startsWith('v') && refName !== `v${pkgVersion}`) {
  mismatches.push(`Git tag (${refName}) != v${pkgVersion}`)
}

if (mismatches.length > 0) {
  console.error('\n❌ 客户端版本号不一致：\n')
  for (const m of mismatches) {
    console.error(`  - ${m}`)
  }
  console.error('')
  process.exit(1)
} else {
  console.log(`✅ 版本号一致性检查通过 (v${pkgVersion})。`)
}
