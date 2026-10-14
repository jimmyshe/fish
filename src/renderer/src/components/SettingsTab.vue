<template>
  <!-- 设置 tab：全部即时生效（无草稿/保存流）；状态属主是主进程 configStore，
       挂载先拉一次 getConfig，之后订阅 config-changed 广播 -->
  <div class="settings-tab">
    <div class="form-row">
      <span>下班时间</span>
      <input
        v-model="workEndTime"
        type="time"
        class="time-input"
        @change="onWorkEndTimeChange"
      />
    </div>
    <label class="form-row toggle">
      <span>下班提示</span>
      <input v-model="workEndReminderEnabled" type="checkbox" @change="onReminderChange" />
    </label>
    <label class="form-row toggle">
      <span>💩 拉屎</span>
      <input v-model="poopEnabled" type="checkbox" @change="onPoopChange" />
    </label>
    <label class="form-row toggle">
      <span>🖱 全局鼠标追踪</span>
      <input v-model="globalMouseTracking" type="checkbox" @change="onMouseTrackingChange" />
    </label>
    <label class="form-row toggle">
      <span>🚀 开机自启动</span>
      <input v-model="autoLaunch" type="checkbox" @change="onAutoLaunchChange" />
    </label>
    <label class="form-row toggle">
      <span>📌 窗口置顶</span>
      <input v-model="alwaysOnTop" type="checkbox" @change="onAlwaysOnTopChange" />
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Config } from '../../../shared/config'

const workEndTime = ref('18:00')
const workEndReminderEnabled = ref(true)
const poopEnabled = ref(true)
const globalMouseTracking = ref(true)
const autoLaunch = ref(false)
// 置顶不持久化（默认开启）：走独立的 get/set IPC，不在 config 广播里
const alwaysOnTop = ref(true)

function applyConfig(config: Config): void {
  workEndTime.value = config.workEndTime
  workEndReminderEnabled.value = config.workEndReminderEnabled
  poopEnabled.value = config.poopEnabled
  globalMouseTracking.value = config.globalMouseTracking
  autoLaunch.value = config.autoLaunch
}

let unsubscribeConfig: (() => void) | null = null

onMounted(async () => {
  if (!window.api) return
  applyConfig(await window.api.getConfig())
  alwaysOnTop.value = await window.api.getAlwaysOnTop()
  unsubscribeConfig = window.api.onConfigChanged(applyConfig)
})

onUnmounted(() => {
  unsubscribeConfig?.()
})

function onWorkEndTimeChange(): void {
  if (window.api && workEndTime.value) void window.api.setWorkEndTime(workEndTime.value)
}

function onReminderChange(): void {
  if (window.api) void window.api.setWorkEndReminderEnabled(workEndReminderEnabled.value)
}

function onPoopChange(): void {
  if (window.api) window.api.setPoopEnabled(poopEnabled.value)
}

function onMouseTrackingChange(): void {
  if (window.api) window.api.setGlobalMouseTracking(globalMouseTracking.value)
}

function onAutoLaunchChange(): void {
  if (window.api) window.api.setAutoLaunch(autoLaunch.value)
}

function onAlwaysOnTopChange(): void {
  if (window.api) window.api.setAlwaysOnTop(alwaysOnTop.value)
}
</script>

<style scoped>
.time-input {
  padding: 4px 10px;
  border: 2px solid #74b9ff;
  border-radius: 8px;
  font-size: 15px;
  text-align: center;
  outline: none;
  color: #2d3436;
  font-family: inherit;
}
.time-input:focus { border-color: #0984e3; }
</style>
