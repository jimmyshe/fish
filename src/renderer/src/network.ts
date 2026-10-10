import { createApp } from 'vue'
import NetworkPanel from './components/NetworkPanel.vue'

// 联网窗口（排行榜）入口：NetworkPanel 直接作为页面根内容
createApp(NetworkPanel).mount('#app')
