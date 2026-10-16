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
    <div class="form-row">
      <span>🎨 皮肤：{{ currentSkin.name }}</span>
      <div class="skin-picker">
        <button
          v-for="skin in SKINS"
          :key="skin.id"
          type="button"
          class="skin-swatch"
          :class="{ active: currentSkin.id === skin.id }"
          :style="{ background: skin.palette.normal.body }"
          :title="skin.name"
          @click="onSkinChange(skin.id)"
        ></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Config } from '../../../shared/config'
import { resolveSkin, SKINS } from '../lib/skins'

const workEndTime = ref('18:00')
const workEndReminderEnabled = ref(true)
const poopEnabled = ref(true)
const globalMouseTracking = ref(true)
const autoLaunch = ref(false)
// 置顶不持久化（默认开启）：走独立的 get/set IPC，不在 config 广播里
const alwaysOnTop = ref(true)
// 皮肤：未知 id 经 resolveSkin 回退默认（与 DesktopPet 渲染侧同一回退点）
const skinId = ref('default')
const currentSkin = computed(() => resolveSkin(skinId.value))

function applyConfig(config: Config): void {
  workEndTime.value = config.workEndTime
  workEndReminderEnabled.value = config.workEndReminderEnabled
  poopEnabled.value = config.poopEnabled
  globalMouseTracking.value = config.globalMouseTracking
  autoLaunch.value = config.autoLaunch
  skinId.value = config.skinId
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

function onSkinChange(id: string): void {
  if (window.api) void window.api.setSkinId(id)
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

/* 皮肤色板：代表色 = normal 心情 body 色（所见即所得） */
.skin-picker {
  display: flex;
  gap: 6px;
}
.skin-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #dfe6e9;
  padding: 0;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.skin-swatch:hover { transform: scale(1.15); }
.skin-swatch.active { border-color: #0984e3; transform: scale(1.15); }
</style>
