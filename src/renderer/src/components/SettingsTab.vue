<template>
  <!-- 设置 tab：全部即时生效（无草稿/保存流）；状态属主是主进程 configStore，
       挂载先拉一次 getConfig，之后订阅 config-changed 广播 -->
  <div class="settings-tab">
    <div class="form-row">
      <span>上班时间</span>
      <input
        v-model="workStartTime"
        type="time"
        class="time-input"
        @change="onWorkStartTimeChange"
      />
    </div>
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
      <span>💰 窝囊费跳表</span>
      <input v-model="salaryTickerEnabled" type="checkbox" @change="onSalaryTickerChange" />
    </label>
    <div class="form-row">
      <span>💵 日薪（元）</span>
      <input
        v-model.number="dailyWage"
        type="number"
        min="0"
        step="10"
        class="time-input wage-input"
        @change="onDailyWageChange"
      />
    </div>
    <label class="form-row toggle">
      <span>💩 拉屎</span>
      <input v-model="poopEnabled" type="checkbox" @change="onPoopChange" />
    </label>
    <div class="form-row">
      <div>
        <label for="feed-shortcut">喂鱼快捷键</label>
        <p id="feed-shortcut-hint" class="shortcut-hint" aria-live="polite">
          {{ feedShortcutError || (feedShortcutRegistered ? '在主屏光标处投放鱼粮' : '快捷键不可用，请更换组合') }}
        </p>
      </div>
      <input
        id="feed-shortcut"
        v-model="feedShortcut"
        type="text"
        maxlength="28"
        class="time-input shortcut-input"
        aria-describedby="feed-shortcut-hint"
        :placeholder="DEFAULT_FEED_SHORTCUT"
        :disabled="savingFeedShortcut"
        spellcheck="false"
        @change="onFeedShortcutChange"
        @keydown.enter.prevent="onFeedShortcutChange"
      />
    </div>
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

    <!-- 第一层：物种选择（ADR 0008） -->
    <div class="form-row species-row">
      <span>🐾 物种：{{ currentSpecies.name }}</span>
      <div class="species-picker">
        <button
          v-for="species in SPECIES_LIST"
          :key="species.id"
          type="button"
          class="species-pill"
          :class="{ active: currentSpecies.id === species.id }"
          @click="onSpeciesChange(species.id)"
        >
          <span>{{ species.icon }}</span>
          <span>{{ species.name }}</span>
        </button>
      </div>
    </div>

    <!-- 第二层：调色方案选择（ADR 0008） -->
    <div class="form-row">
      <span>🎨 调色：{{ currentPalette.name }}</span>
      <div class="palette-picker">
        <template v-if="currentSpecies.palettes.length > 0">
          <button
            v-for="p in currentSpecies.palettes"
            :key="p.id"
            type="button"
            class="skin-swatch"
            :class="{ active: currentPalette.id === p.id }"
            :style="{ background: p.previewColor }"
            :title="p.name"
            @click="onPaletteChange(p.id)"
          ></button>
        </template>
        <template v-else>
          <span class="custom-note" :style="{ color: currentSpecies.previewColor }">
            专属原色
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { DEFAULT_FEED_SHORTCUT, type Config } from '../../../shared/config'
import { SPECIES_LIST, resolveSpecies, resolvePalette } from '../lib/species'

const workStartTime = ref('09:00')
const workEndTime = ref('18:00')
const workEndReminderEnabled = ref(true)
const salaryTickerEnabled = ref(true)
const dailyWage = ref(200)
const poopEnabled = ref(true)
const savedFeedShortcut = ref(DEFAULT_FEED_SHORTCUT)
const feedShortcut = ref(DEFAULT_FEED_SHORTCUT)
const feedShortcutRegistered = ref(true)
const feedShortcutError = ref('')
const savingFeedShortcut = ref(false)
const globalMouseTracking = ref(true)
const autoLaunch = ref(false)
// 置顶不持久化（默认开启）：走独立的 get/set IPC，不在 config 广播里
const alwaysOnTop = ref(true)

// 物种与调色方案（ADR 0008 二层解耦）
const speciesId = ref('classic-fish')
const paletteId = ref('default')

const currentSpecies = computed(() => resolveSpecies(speciesId.value))
const currentPalette = computed(() => resolvePalette(currentSpecies.value, paletteId.value))

function applyConfig(config: Config): void {
  workStartTime.value = config.workStartTime ?? '09:00'
  workEndTime.value = config.workEndTime
  workEndReminderEnabled.value = config.workEndReminderEnabled
  salaryTickerEnabled.value = config.salaryTickerEnabled ?? true
  dailyWage.value = config.dailyWage ?? 200
  poopEnabled.value = config.poopEnabled
  if (savedFeedShortcut.value !== config.feedShortcut) {
    savedFeedShortcut.value = config.feedShortcut
    feedShortcut.value = config.feedShortcut
  }
  globalMouseTracking.value = config.globalMouseTracking
  autoLaunch.value = config.autoLaunch
  speciesId.value = config.speciesId ?? 'classic-fish'
  paletteId.value = config.paletteId ?? config.skinId ?? 'default'
}

let unsubscribeConfig: (() => void) | null = null

onMounted(async () => {
  if (!window.api) return
  applyConfig(await window.api.getConfig())
  unsubscribeConfig = window.api.onConfigChanged(applyConfig)
  const [isOnTop, isRegistered] = await Promise.all([
    window.api.getAlwaysOnTop(),
    window.api.getFeedShortcutRegistered()
  ])
  alwaysOnTop.value = isOnTop
  feedShortcutRegistered.value = isRegistered
})

onUnmounted(() => {
  unsubscribeConfig?.()
})

function onWorkStartTimeChange(): void {
  if (window.api && workStartTime.value) void window.api.setWorkStartTime(workStartTime.value)
}

function onWorkEndTimeChange(): void {
  if (window.api && workEndTime.value) void window.api.setWorkEndTime(workEndTime.value)
}

function onReminderChange(): void {
  if (window.api) void window.api.setWorkEndReminderEnabled(workEndReminderEnabled.value)
}

function onSalaryTickerChange(): void {
  if (window.api) void window.api.setSalaryTickerEnabled(salaryTickerEnabled.value)
}

function onDailyWageChange(): void {
  const safe = typeof dailyWage.value === 'number' && Number.isFinite(dailyWage.value) && dailyWage.value >= 0
    ? dailyWage.value
    : 0
  dailyWage.value = safe
  if (window.api) void window.api.setDailyWage(safe)
}

function onPoopChange(): void {
  if (window.api) window.api.setPoopEnabled(poopEnabled.value)
}

async function onFeedShortcutChange(): Promise<void> {
  if (!window.api || savingFeedShortcut.value) return
  savingFeedShortcut.value = true
  feedShortcutError.value = ''
  try {
    const result = await window.api.setFeedShortcut(feedShortcut.value)
    if (result === 'ok') {
      savedFeedShortcut.value = (await window.api.getConfig()).feedShortcut
      feedShortcutRegistered.value = true
    } else if (result === 'invalid') {
      feedShortcutError.value = '请用 Ctrl 或 Alt 加字母、数字或功能键'
    } else {
      feedShortcutError.value = '组合不可用，请换一个快捷键'
    }
  } catch {
    feedShortcutError.value = '保存失败，请重试'
  } finally {
    feedShortcut.value = savedFeedShortcut.value
    savingFeedShortcut.value = false
  }
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

function onSpeciesChange(newSpeciesId: string): void {
  speciesId.value = newSpeciesId
  const sp = resolveSpecies(newSpeciesId)
  paletteId.value = sp.defaultPaletteId
  if (window.api) {
    void window.api.setSpeciesId(newSpeciesId, sp.defaultPaletteId)
  }
}

function onPaletteChange(newPaletteId: string): void {
  paletteId.value = newPaletteId
  if (window.api) {
    void window.api.setPaletteId(newPaletteId)
  }
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
.wage-input { width: 96px; }
.shortcut-input { width: 130px; }
.shortcut-hint { margin: 4px 0 0; color: #636e72; font-size: 12px; }

/* 物种药丸选择器 */
.species-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.species-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  border: 1.5px solid #dfe6e9;
  background: #f8f9fa;
  font-size: 13px;
  color: #2d3436;
  cursor: pointer;
  transition: all 0.15s ease;
}
.species-pill:hover {
  border-color: #74b9ff;
  background: #f0f7ff;
}
.species-pill.active {
  border-color: #0984e3;
  background: #e8f4fd;
  color: #0984e3;
  font-weight: 600;
}

/* 调色板选择器：代表色 = normal 心情 body 色（所见即所得） */
.palette-picker {
  display: flex;
  gap: 6px;
  align-items: center;
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

.custom-note {
  font-size: 12px;
  font-weight: 600;
}
</style>
