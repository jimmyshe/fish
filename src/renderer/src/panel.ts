import { createApp } from 'vue'
import MainPanel from './components/MainPanel.vue'
import './styles/base.css'

// 主面板入口：MainPanel 直接作为页面根组件（初始 tab 由 location.search 决定）
createApp(MainPanel).mount('#app')
