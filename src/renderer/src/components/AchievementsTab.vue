<template>
  <!-- 成就 tab：纯本地单机荣誉图鉴（状态属主是主进程 achievementStore，挂载拉取并订阅广播） -->
  <div class="achievements-tab">
    <div class="summary-card">
      <div class="summary-head">
        <span class="summary-title">🏅 收集进度</span>
        <span class="summary-count">已解锁 {{ unlockedCount }} / {{ totalCount }}（{{ percent }}%）</span>
      </div>
      <div class="progress-track summary-track">
        <div class="progress-fill" :style="{ width: percent + '%' }"></div>
      </div>
    </div>

    <div class="achievement-list">
      <div
        v-for="item in items"
        :key="item.def.id"
        class="achievement-card"
        :class="{ unlocked: item.isUnlocked, hidden: !item.isUnlocked && item.def.hidden }"
      >
        <div class="card-icon">
          {{ item.isUnlocked || !item.def.hidden ? item.def.icon : '🔒' }}
        </div>

        <div class="card-body">
          <div class="card-title-row">
            <span class="card-title">
              {{ item.isUnlocked || !item.def.hidden ? item.def.title : '？？？' }}
            </span>
          </div>
          <div class="card-desc">
            {{ item.isUnlocked ? item.def.description : item.def.hint }}
          </div>
          <div v-if="!item.isUnlocked && !item.def.hidden" class="card-progress">
            <div class="progress-track">
              <div
                class="progress-fill"
                :style="{ width: item.progressPercent + '%' }"
              ></div>
            </div>
            <span class="progress-text">{{ item.progress.current }} / {{ item.progress.target }}</span>
          </div>
        </div>

        <div class="card-status">
          <template v-if="item.isUnlocked">
            <span class="status-badge unlocked-badge">✓ 已达成</span>
            <span class="status-date">{{ item.unlockedDate }}</span>
          </template>
          <span v-else-if="item.def.hidden" class="status-badge hidden-badge">隐藏彩蛋</span>
          <span v-else class="status-badge locked-badge">未达成</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  ACHIEVEMENT_LIST,
  createDefaultAchievementState,
  getAchievementProgress,
  sortAchievementsForDisplay,
  type AchievementState
} from '../../../shared/achievements'

const state = ref<AchievementState>(createDefaultAchievementState())

function formatDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const totalCount = ACHIEVEMENT_LIST.length
const unlockedCount = computed(() => Object.keys(state.value.unlocked).length)
const percent = computed(() =>
  totalCount > 0 ? Math.round((unlockedCount.value / totalCount) * 100) : 0
)

const items = computed(() =>
  sortAchievementsForDisplay(state.value).map((def) => {
    const unlockedAt = state.value.unlocked[def.id]
    const isUnlocked = unlockedAt !== undefined
    const progress = getAchievementProgress(state.value, def.id)
    const progressPercent =
      progress.target > 0 ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0
    return {
      def,
      isUnlocked,
      unlockedDate: unlockedAt !== undefined ? formatDate(unlockedAt) : '',
      progress,
      progressPercent
    }
  })
)

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  if (!window.api) return
  state.value = await window.api.getAchievements()
  unsubscribe = window.api.onAchievementsChanged((next) => {
    state.value = next
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.achievements-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-card {
  background: white;
  border: 1px solid #e8ecf1;
  border-radius: 10px;
  padding: 12px 14px;
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.summary-title {
  font-size: 13px;
  font-weight: 700;
  color: #2d3436;
}

.summary-count {
  font-size: 12px;
  font-weight: 600;
  color: #0984e3;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: #edf1f5;
  border-radius: 999px;
  overflow: hidden;
}

.summary-track {
  height: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #74b9ff, #0984e3);
  border-radius: 999px;
  transition: width 0.25s ease;
}

.achievement-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.achievement-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e8ecf1;
  border-radius: 10px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.achievement-card.unlocked {
  border-color: #b8dcff;
  background: #f5faff;
}

.achievement-card.hidden {
  background: #fafbfc;
}

.card-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 8px;
  background: #f1f5f9;
}

.achievement-card.unlocked .card-icon {
  background: #e3f1ff;
}

.achievement-card:not(.unlocked) .card-icon {
  filter: grayscale(1);
  opacity: 0.6;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  color: #2d3436;
}

.achievement-card:not(.unlocked) .card-title {
  color: #636e72;
}

.card-desc {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.4;
  color: #636e72;
}

.card-progress {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  font-size: 11px;
  color: #636e72;
  white-space: nowrap;
}

.card-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
}

.unlocked-badge {
  background: #dff0ff;
  color: #0984e3;
}

.locked-badge {
  background: #f1f3f5;
  color: #95a5a6;
}

.hidden-badge {
  background: #f3ecff;
  color: #7c5cbf;
}

.status-date {
  font-size: 10px;
  color: #95a5a6;
}
</style>
