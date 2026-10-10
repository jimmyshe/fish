import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
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
