<template>
  <!-- 主面板：设置 + 排行榜的唯一 UI 归属；普通 OS 窗口，拖动/关闭由 OS 负责 -->
  <div class="main-panel">
    <nav class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: tab === 'settings' }"
        @click="tab = 'settings'"
      >⚙️ 设置</button>
      <button
        class="tab-btn"
        :class="{ active: tab === 'leaderboard' }"
        @click="tab = 'leaderboard'"
      >🏆 排行榜</button>
    </nav>
    <main class="tab-content">
      <SettingsTab v-if="tab === 'settings'" />
      <LeaderboardTab v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { MainPanelTab } from '../../../shared/api'
import SettingsTab from './SettingsTab.vue'
import LeaderboardTab from './LeaderboardTab.vue'

// 初始 tab 来自打开时的 ?tab= 查询参数；窗口已打开时托盘再点经 panel-switch-tab 推送切换
const tab = ref<MainPanelTab>('settings')
let unsubscribeSwitch: (() => void) | null = null

onMounted(() => {
  const initial = new URLSearchParams(location.search).get('tab')
  if (initial === 'settings' || initial === 'leaderboard') {
    tab.value = initial
  }
  if (window.api) {
    unsubscribeSwitch = window.api.onSwitchPanelTab((t) => { tab.value = t })
  }
})

onUnmounted(() => {
  unsubscribeSwitch?.()
})
</script>

<style scoped>
.main-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 10px 12px 0;
  border-bottom: 1px solid #e8ecf1;
}
.tab-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #636e72;
  font-family: inherit;
  transition: color 0.15s;
}
.tab-btn:hover { color: #2d3436; }
.tab-btn.active {
  color: #0984e3;
  font-weight: 700;
  border-bottom-color: #74b9ff;
}
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
</style>
