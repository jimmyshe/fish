import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

/**
 * 构建期注入服务器信息（ADR 0004）：CI 打包时从 GitHub variables 提供 env，
 * 经 define 烧进 main bundle；未设置时替换为 undefined，auth.ts/apiClient.ts
 * 模块常量的 `process.env.X ?? 默认值` 落回硬编码默认；dev 模式同理由本地环境变量覆盖。
 */
function envDefine(name: string): string {
  const value = process.env[name]
  // GitHub variables 未设置时 ${{ vars.X }} 求值为空字符串而非 undefined，空串同样视为未设置
  return value === undefined || value === '' ? 'undefined' : JSON.stringify(value)
}

export default defineConfig({
  main: {
    define: {
      'process.env.POCKET_ID_ISSUER': envDefine('POCKET_ID_ISSUER'),
      'process.env.FISH_OIDC_CLIENT_ID': envDefine('FISH_OIDC_CLIENT_ID'),
      'process.env.FISH_API_RESOURCE': envDefine('FISH_API_RESOURCE'),
      'process.env.FISH_API_BASE_URL': envDefine('FISH_API_BASE_URL')
    },
    // openid-client 是纯 ESM 包，externalize 后 CJS main 无法 require，须打进 bundle
    plugins: [externalizeDepsPlugin({ exclude: ['openid-client'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          network: resolve('src/renderer/network.html')
        }
      }
    },
    plugins: [vue()]
  }
})
