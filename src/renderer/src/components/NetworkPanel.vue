<template>
  <!-- 联网面板：独立 BrowserWindow 的页面根内容（不再是游乐场窗口浮层；
       窗口拖动/关闭由 OS 负责，无需命中检测与拖拽接线） -->
  <div class="network-panel">
    <div class="panel-title">🏆 铲屎排行榜</div>
    <button class="panel-close" @click="closeWindow">✕</button>

    <template v-if="authState.signedIn">
      <div class="auth-status">🐟 已登录：{{ authState.username }}</div>
      <!-- 我的计数/名次：失败或加载中给占位，不弹窗 -->
      <div class="stats-line" v-if="me">
        铲屎 {{ me.count }} 次 · {{ me.rank ? `总榜第 ${me.rank} 名` : '未上榜' }}
      </div>
      <div class="stats-line stats-placeholder" v-else>联网数据加载失败，点刷新重试</div>
      <label class="lb-toggle" v-if="me">
        <input
          type="checkbox"
          :checked="me.showOnLeaderboard"
          @change="onToggleShowOnLeaderboard"
        />
        在排行榜上显示我
      </label>
      <!-- 排行榜：总榜 Top 100，本人行高亮 -->
      <div class="leaderboard" v-if="leaderboard && leaderboard.entries.length">
        <div
          v-for="e in leaderboard.entries"
          :key="e.rank"
          class="lb-row"
          :class="{ 'lb-me': e.username === authState.username }"
        >
          <span class="lb-rank">{{ e.rank }}</span>
          <span class="lb-name">{{ e.username }}</span>
          <span class="lb-count">{{ e.count }}</span>
        </div>
      </div>
      <button class="btn-save auth-btn" :disabled="refreshing" @click="onRefresh">
        {{ refreshing ? '刷新中…' : '🔄 刷新' }}
      </button>
      <button class="btn-cancel auth-btn" @click="onLogout">退出登录</button>
    </template>
    <template v-else>
      <div class="auth-status">登录后参与铲屎排行榜</div>
      <button class="btn-save auth-btn" :disabled="authBusy" @click="onLogin">
        {{ authBusy ? '等待浏览器登录…' : '🔑 登录 PocketID' }}
      </button>
    </template>
    <div v-if="authError" class="auth-error">{{ authError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { AuthState, LeaderboardResponse, MeResponse } from '../../../shared/api'
import { usePetScheduler } from '../composables/usePetScheduler'

// 轮询定时器经 PetScheduler 注册；窗口销毁即整个 app 卸载，cancelAll 自动停（关闭即停）
const scheduler = usePetScheduler()

// ── 登录 ─────────────────────────────────────────
// auth 状态属主在主进程；这里先拉一次再订阅推送（同 onPoopEnabledChanged 先例）
const authState = ref<AuthState>({ signedIn: false })
const authBusy = ref(false)
const authError = ref('')

function closeWindow(): void {
  window.close()
}

async function onLogin() {
  if (!window.api || authBusy.value) return
  authBusy.value = true
  authError.value = ''
  try {
    await window.api.login()
  } catch {
    authError.value = '登录失败或已取消，请重试'
  } finally {
    authBusy.value = false
  }
}

async function onLogout() {
  if (!window.api) return
  authError.value = ''
  await window.api.logout()
}

// ── 联网数据：我的计数 / 排行榜 / opt-out ─────────
// 数据属主是服务器；本地只缓存最近一次成功结果，失败保留旧值、无数据给占位。
const me = ref<MeResponse | null>(null)
const leaderboard = ref<LeaderboardResponse | null>(null)
const LEADERBOARD_POLL_MS = 5 * 60 * 1000 // 榜单轮询间隔：5 分钟

async function loadOnlineStats() {
  if (!window.api || !authState.value.signedIn) return
  const [m, l] = await Promise.all([window.api.getMe(), window.api.getLeaderboard()])
  if (m) me.value = m
  if (l) leaderboard.value = l
}

// 手动刷新：与 5 分钟轮询共用 loadOnlineStats；拉取期间按钮置灰
const refreshing = ref(false)

async function onRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadOnlineStats()
  } finally {
    refreshing.value = false
  }
}

// 窗口打开（组件挂载）且已登录：立即拉一次 + 之后每 5 分钟；登出即停并清空
watch(() => authState.value.signedIn, (signedIn) => {
  scheduler.cancel('leaderboard-poll')
  if (signedIn) {
    void loadOnlineStats()
    scheduler.every('leaderboard-poll', LEADERBOARD_POLL_MS, () => { void loadOnlineStats() })
  } else {
    me.value = null
    leaderboard.value = null
  }
})

async function onToggleShowOnLeaderboard(e: Event) {
  if (!window.api) return
  await window.api.setShowOnLeaderboard((e.target as HTMLInputElement).checked)
  // 以服务器值为准刷新（失败时 getMe 返回 null，UI 保留旧值）
  await loadOnlineStats()
}

let unsubscribeAuth: (() => void) | null = null

onMounted(async () => {
  if (window.api) {
    authState.value = await window.api.getAuthState()
    unsubscribeAuth = window.api.onAuthStateChanged((s) => { authState.value = s })
  }
})

onUnmounted(() => {
  unsubscribeAuth?.()
})
</script>

<style scoped>
/* ── 联网面板（独立窗口页面） ── */
.network-panel {
  padding: 20px 24px;
  min-height: 100vh;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.panel-title {
  font-size: 14px; font-weight: 700; color: #2d3436;
  margin-bottom: 14px; text-align: center;
}
.panel-close {
  position: absolute; top: 10px; right: 12px;
  border: none; background: none; cursor: pointer;
  font-size: 13px; color: #b2bec3; padding: 4px;
}
.panel-close:hover { color: #636e72; }

.auth-status {
  font-size: 12px; color: #636e72; margin-bottom: 8px; text-align: center;
}
.stats-line {
  font-size: 13px; font-weight: 700; color: #2d3436; margin-bottom: 8px; text-align: center;
}
.stats-placeholder { font-weight: 400; color: #b2bec3; }
.lb-toggle {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  font-size: 12px; color: #636e72; margin-bottom: 10px; cursor: pointer;
}
.leaderboard {
  max-height: 320px; overflow-y: auto; margin-bottom: 10px;
  border: 1px solid #e8ecf1; border-radius: 8px; padding: 4px 8px;
  background: white;
}
.lb-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #2d3436; padding: 3px 0;
}
.lb-row.lb-me { font-weight: 700; color: #0984e3; }
.lb-rank { width: 24px; text-align: right; color: #b2bec3; }
.lb-row.lb-me .lb-rank { color: #0984e3; }
.lb-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-count { font-weight: 600; }

.btn-cancel, .btn-save {
  padding: 6px 16px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 13px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  transition: opacity 0.2s;
}
.btn-cancel { background: #dfe6e9; color: #636e72; }
.btn-save   { background: #74b9ff; color: white; font-weight: 600; }
.btn-cancel:hover, .btn-save:hover { opacity: 0.85; }
.auth-btn { width: 100%; padding: 7px 0; }
.auth-btn + .auth-btn { margin-top: 8px; }
.auth-btn:disabled { opacity: 0.6; cursor: default; }
.auth-error {
  margin-top: 8px; font-size: 11px; color: #d63031; text-align: center;
}
</style>
