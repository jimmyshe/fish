<template>
  <div class="pet-wrapper" @mousedown.left="startDrag" @contextmenu.prevent="onRightClick">

    <!-- 对话气泡 -->
    <div class="bubble-wrap" :class="{ 'sleeping-bubble': isSleeping }">
      <div class="speech-bubble" :class="effectiveMoodClass">
        <div class="bubble-text" :class="{ 'interact-flash': !!interactMessage }">
          {{ displayMessage }}
        </div>
        <div class="bubble-subtext" v-if="displaySubMessage">{{ displaySubMessage }}</div>
      </div>
    </div>

    <!-- 飘浮粒子层（爱心 / Zzz） -->
    <div class="particles-layer">
      <span
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :class="p.type"
        :style="{ left: p.x + 'px', bottom: p.bottom + 'px', animationDuration: p.dur + 's', fontSize: p.size + 'px' }"
      >{{ p.char }}</span>
    </div>

    <!-- 小鱼 SVG -->
    <div
      class="fish-wrap"
      :class="[effectiveMoodClass, { 'is-hovered': isHovered, 'is-rainbow': isRainbow }]"
      @mouseenter="onFishHover"
      @mouseleave="onFishLeave"
    >
      <svg
        ref="fishSvgRef"
        class="fish-svg"
        viewBox="0 0 120 80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- 鱼尾 -->
        <g class="fish-tail">
          <polygon points="18,40 0,20 0,60" :fill="tailColor" />
          <polygon points="18,40 4,24 4,56" fill="rgba(255,255,255,0.2)" />
        </g>

        <!-- 鱼身 -->
        <ellipse cx="60" cy="40" rx="40" ry="24" :fill="bodyColor" />
        <!-- 鱼身高光 -->
        <ellipse cx="58" cy="32" rx="22" ry="10" fill="rgba(255,255,255,0.25)" />

        <!-- 背鳍 -->
        <ellipse cx="55" cy="18" rx="16" ry="7" :fill="finColor" transform="rotate(-15, 55, 18)" />

        <!-- 腹鳍 -->
        <ellipse cx="50" cy="62" rx="10" ry="5" :fill="finColor" transform="rotate(15, 50, 62)" />

        <!-- 眼睛白色 -->
        <circle cx="84" cy="34" r="8" fill="white" />

        <!-- 眼睛：睡着时闭眼，受惊时瞪眼，平时跟随鼠标 -->
        <template v-if="isSleeping">
          <!-- 闭眼：横线 -->
          <path d="M 80 34 Q 84 37 88 34" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </template>
        <template v-else-if="isScared">
          <!-- 受惊：瞪大眼 + 竖形瞳孔 -->
          <ellipse :cx="eyeX" :cy="eyeY" rx="3" ry="5" fill="#1a1a2e" />
          <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="1.5" fill="white" />
        </template>
        <template v-else>
          <!-- 正常：圆形瞳孔跟随鼠标 -->
          <circle :cx="eyeX" :cy="eyeY" r="5" fill="#1a1a2e" />
          <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="2" fill="white" />
        </template>

        <!-- 嘴巴 -->
        <path v-if="isScared" d="M 98 46 Q 103 50 108 46" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else-if="isSleeping" d="M 99 45 Q 103 47 107 45" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path v-else-if="effectiveMood === 'happy'" d="M 98 42 Q 106 48 98 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else-if="effectiveMood === 'normal'" d="M 98 45 Q 106 45 98 45" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else-if="effectiveMood === 'nervous'" d="M 98 48 Q 103 44 108 48" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else d="M 98 50 Q 106 44 98 44" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>

        <!-- 加班时的泪水 -->
        <g v-if="effectiveMood === 'sad' && !isScared && !isSleeping">
          <ellipse cx="88" cy="45" rx="2" ry="3" fill="#74b9ff" opacity="0.8" class="tear tear1"/>
          <ellipse cx="86" cy="52" rx="1.5" ry="2.5" fill="#74b9ff" opacity="0.6" class="tear tear2"/>
        </g>

        <!-- 快下班时的汗水 -->
        <g v-if="effectiveMood === 'nervous' && !isScared && !isSleeping">
          <ellipse cx="76" cy="25" rx="2" ry="3" fill="#a8d8f0" opacity="0.8" class="sweat" />
        </g>

        <!-- 受惊时的惊汗 -->
        <g v-if="isScared">
          <ellipse cx="72" cy="22" rx="2.5" ry="4" fill="#ff7675" opacity="0.9" class="sweat" />
          <ellipse cx="80" cy="18" rx="1.5" ry="3" fill="#ff7675" opacity="0.7" class="sweat" style="animation-delay:0.2s"/>
        </g>

        <!-- 彩虹模式皇冠 -->
        <g v-if="isRainbow">
          <path d="M 70 14 L 74 6 L 78 14 L 82 6 L 86 14" stroke="#fdcb6e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>

        <!-- 鱼鳞纹理 -->
        <path d="M 55 30 Q 63 26 68 33" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
        <path d="M 48 36 Q 56 32 61 39" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
        <path d="M 55 44 Q 63 48 68 43" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
      </svg>

      <!-- 连击数指示器 -->
      <div class="combo-badge" v-if="comboCount >= 2">
        {{ comboCount }}x COMBO!
      </div>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettings" class="settings-overlay" @mousedown.stop>
      <div class="settings-panel">
        <div class="settings-title">⏰ 设置下班时间</div>
        <input
          v-model="tempTime"
          type="time"
          class="time-input"
          @keydown.enter="saveSettings"
        />
        <div class="settings-buttons">
          <button class="btn-cancel" @click="showSettings = false">取消</button>
          <button class="btn-save" @click="saveSettings">保存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── 基础状态 ──────────────────────────────────────
const workEndTime = ref('18:00')
const currentTime = ref(new Date())
const showSettings = ref(false)
const tempTime = ref('18:00')

// ── 鼠标追踪 ──────────────────────────────────────
const fishSvgRef = ref<SVGElement | null>(null)
const mousePos = ref({ x: 0, y: 0 })
const isHovered = ref(false)

let lastMouseTime = 0
let lastMouseClientPos = { x: 0, y: 0 }

// ── 互动消息 ──────────────────────────────────────
const interactMessage = ref('')
let interactTimer: ReturnType<typeof setTimeout> | null = null

function showMsg(msg: string, duration = 2000) {
  interactMessage.value = msg
  if (interactTimer) clearTimeout(interactTimer)
  interactTimer = setTimeout(() => { interactMessage.value = '' }, duration)
}

// ── 飘浮粒子 ──────────────────────────────────────
interface Particle { id: number; x: number; bottom: number; char: string; dur: number; size: number; type: string }
const particles = ref<Particle[]>([])
let particleId = 0

function spawnParticles(chars: string[], count: number, type = 'heart') {
  for (let i = 0; i < count; i++) {
    const id = particleId++
    const p: Particle = {
      id,
      x: 175 + (Math.random() - 0.5) * 70,
      bottom: 55 + Math.random() * 20,
      char: chars[Math.floor(Math.random() * chars.length)],
      dur: 0.8 + Math.random() * 0.7,
      size: 14 + Math.random() * 8,
      type,
    }
    particles.value.push(p)
    setTimeout(() => {
      particles.value = particles.value.filter(x => x.id !== id)
    }, p.dur * 1000 + 150)
  }
}

// ── 拖拽状态 ──────────────────────────────────────
let isDragging = false
let prevX = 0, prevY = 0
let tapStartX = 0, tapStartY = 0

// ── 受惊模式 ──────────────────────────────────────
const isScared = ref(false)
let scaredTimer: ReturnType<typeof setTimeout> | null = null

function triggerScared() {
  if (isScared.value) return
  isScared.value = true
  const msgs = ['呀！！', '不要过来！', '救命！', '太快了！', '(ﾟДﾟ)！']
  showMsg(msgs[Math.floor(Math.random() * msgs.length)], 1500)
  spawnParticles(['！', '💦', '😱'], 3, 'scare')
  if (scaredTimer) clearTimeout(scaredTimer)
  scaredTimer = setTimeout(() => { isScared.value = false }, 1800)
}

// ── 睡眠模式 ──────────────────────────────────────
const isSleeping = ref(false)
let sleepTimer: ReturnType<typeof setTimeout> | null = null
let zzzInterval: ReturnType<typeof setInterval> | null = null
const SLEEP_TIMEOUT = 3 * 60 * 1000 // 3分钟无操作

function resetSleepTimer() {
  if (isSleeping.value) {
    wakeUp()
    return
  }
  if (sleepTimer) clearTimeout(sleepTimer)
  sleepTimer = setTimeout(() => { fallAsleep() }, SLEEP_TIMEOUT)
}

function fallAsleep() {
  isSleeping.value = true
  // 定时飘出 Zzz
  zzzInterval = setInterval(() => {
    if (isSleeping.value) {
      spawnParticles(['z', 'Z', 'z'], 1, 'zzz')
    }
  }, 1500)
}

function wakeUp() {
  isSleeping.value = false
  if (zzzInterval) { clearInterval(zzzInterval); zzzInterval = null }
  showMsg('呼～被吵醒了...', 2000)
  resetSleepTimer()
}

// ── 连击彩蛋 ──────────────────────────────────────
const comboCount = ref(0)
const isRainbow = ref(false)
let comboResetTimer: ReturnType<typeof setTimeout> | null = null
let rainbowTimer: ReturnType<typeof setTimeout> | null = null

function addCombo() {
  comboCount.value++
  if (comboResetTimer) clearTimeout(comboResetTimer)
  comboResetTimer = setTimeout(() => { comboCount.value = 0 }, 3000)

  if (comboCount.value >= 5) {
    comboCount.value = 0
    triggerRainbow()
  }
}

function triggerRainbow() {
  if (isRainbow.value) return
  isRainbow.value = true
  const msgs = ['🌈 彩虹鱼出现了！！', '✨ 传说中的彩鱼！', '🎊 隐藏彩蛋解锁！']
  showMsg(msgs[Math.floor(Math.random() * msgs.length)], 4000)
  spawnParticles(['🌈', '✨', '🎉', '⭐', '💫'], 6, 'rainbow')
  if (rainbowTimer) clearTimeout(rainbowTimer)
  rainbowTimer = setTimeout(() => { isRainbow.value = false }, 5000)
}

// ── 随机自言自语 ──────────────────────────────────
const monologues = [
  '今天的水怎么这么浑浊...',
  '鱼也要996吗？',
  '上班是不可能的，这辈子...',
  '感觉有人在看我...',
  '今天午饭吃什么好呢',
  '（偷偷打了个哈欠）',
  '老板是什么味道的...',
  '我在想一件大事',
  '摸鱼的最高境界是什么',
  '鱼的记忆只有7秒... 等等刚才说啥来着',
  '我看了你好久了',
  '(*^▽^*)',
  '听说摸鱼有益健康',
  '静静地看着你们上班',
]

function scheduleMonologue() {
  const delay = (90 + Math.random() * 120) * 1000 // 1.5~3.5 分钟
  setTimeout(() => {
    if (!isSleeping.value && !interactMessage.value && !isScared.value) {
      showMsg(monologues[Math.floor(Math.random() * monologues.length)], 3000)
    }
    scheduleMonologue()
  }, delay)
}

// ── 自主漂移 ──────────────────────────────────────
function scheduleDrift() {
  const delay = (35 + Math.random() * 35) * 1000 // 35~70秒
  setTimeout(() => {
    if (!isDragging && !isSleeping.value && window.api) {
      const dx = Math.round((Math.random() - 0.5) * 160)
      const dy = Math.round((Math.random() - 0.5) * 80)
      animateDrift(dx, dy)
    }
    scheduleDrift()
  }, delay)
}

function animateDrift(totalDx: number, totalDy: number) {
  const steps = 25
  const stepDx = totalDx / steps
  const stepDy = totalDy / steps
  let step = 0
  const iv = setInterval(() => {
    if (window.api) window.api.moveWindow(Math.round(stepDx), Math.round(stepDy))
    step++
    if (step >= steps) clearInterval(iv)
  }, 40)
}

// ── 计算属性 ──────────────────────────────────────
const remainingMinutes = computed(() => {
  const now = currentTime.value
  const [endHour, endMin] = workEndTime.value.split(':').map(Number)
  const endMs = endHour * 3600000 + endMin * 60000
  const nowMs = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000
  return Math.floor((endMs - nowMs) / 60000)
})

const mood = computed(() => {
  const min = remainingMinutes.value
  if (min < 0) return 'sad'
  if (min <= 30) return 'nervous'
  if (min <= 120) return 'happy'
  return 'normal'
})

// 有效心情（覆盖层：受惊 > 睡眠 > 原心情）
const effectiveMood = computed(() => {
  if (isScared.value) return 'scared'
  if (isSleeping.value) return 'sleeping'
  return mood.value
})

// 气泡样式类（sleeping/scared 用特殊色，其他用心情色）
const effectiveMoodClass = computed(() => effectiveMood.value)

const bodyColor = computed(() => ({
  sad: '#a29bfe', nervous: '#fd79a8', happy: '#fdcb6e', normal: '#74b9ff',
  scared: '#ff7675', sleeping: '#b2bec3'
})[effectiveMood.value] ?? '#74b9ff')

const tailColor = computed(() => ({
  sad: '#6c5ce7', nervous: '#e84393', happy: '#e17055', normal: '#0984e3',
  scared: '#d63031', sleeping: '#636e72'
})[effectiveMood.value] ?? '#0984e3')

const finColor = computed(() => ({
  sad: '#9b8af4', nervous: '#fc5c8a', happy: '#ffeaa7', normal: '#a8d8f0',
  scared: '#fab1a0', sleeping: '#dfe6e9'
})[effectiveMood.value] ?? '#a8d8f0')

// 眼睛瞳孔跟随鼠标
const eyeOffset = computed(() => {
  const el = fishSvgRef.value
  if (!el || isSleeping.value) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const eyeCX = rect.left + 84 * (rect.width / 120)
  const eyeCY = rect.top + 34 * (rect.height / 80)
  const dx = mousePos.value.x - eyeCX
  const dy = mousePos.value.y - eyeCY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: 0, y: 0 }
  const factor = Math.min(dist / 100, 1) * (isScared.value ? 1.5 : 2.5)
  return { x: (dx / dist) * factor, y: (dy / dist) * factor }
})

const eyeX = computed(() => (mood.value === 'sad' ? 83 : 85) + eyeOffset.value.x)
const eyeY = computed(() => 35 + eyeOffset.value.y)
const eyeHighlightX = computed(() => eyeX.value + 1)
const eyeHighlightY = computed(() => eyeY.value - 2)

// 气泡显示内容
const timeMessage = computed(() => {
  const min = remainingMinutes.value
  if (min < 0) {
    const o = Math.abs(min)
    const h = Math.floor(o / 60), m = o % 60
    return h > 0 ? `加班 ${h}小时${m > 0 ? m + '分' : ''}了！` : `加班 ${m} 分钟了！`
  }
  if (min === 0) return '到点下班啦！'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `还有 ${h}小时${m > 0 ? m + '分' : ''}` : `还有 ${m} 分钟`
})

const subMessage = computed(() => {
  const min = remainingMinutes.value
  if (min < 0) return '摸鱼人，快跑！'
  if (min === 0) return '收拾东西！'
  if (min <= 10) return '马上下班！冲！'
  if (min <= 30) return '准备收工啦~'
  if (min <= 60) return '快了快了...'
  if (min <= 120) return '继续加油 ~'
  return '好好摸鱼吧'
})

const displayMessage = computed(() => {
  if (isSleeping.value) return 'Z z z ...'
  return interactMessage.value || timeMessage.value
})

const displaySubMessage = computed(() => {
  if (isSleeping.value) return '（睡着了，别吵我）'
  if (interactMessage.value) return ''
  return subMessage.value
})

// ── 生命周期 ──────────────────────────────────────
let clockTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  if (window.api) {
    workEndTime.value = await window.api.getWorkEndTime()
    tempTime.value = workEndTime.value
    window.api.onOpenSettings(() => {
      tempTime.value = workEndTime.value
      showSettings.value = true
    })
  }

  clockTimer = setInterval(() => { currentTime.value = new Date() }, 10000)

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopDrag)

  resetSleepTimer()
  scheduleMonologue()
  scheduleDrift()
})

onUnmounted(() => {
  clearInterval(clockTimer)
  if (zzzInterval) clearInterval(zzzInterval)
  ;[interactTimer, scaredTimer, sleepTimer, comboResetTimer, rainbowTimer]
    .forEach(t => t && clearTimeout(t))
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopDrag)
})

// ── 事件处理 ──────────────────────────────────────
function startDrag(e: MouseEvent) {
  if (showSettings.value) return
  isDragging = true
  prevX = e.screenX; prevY = e.screenY
  tapStartX = e.screenX; tapStartY = e.screenY
}

function onMouseMove(e: MouseEvent) {
  mousePos.value = { x: e.clientX, y: e.clientY }
  resetSleepTimer()

  // 检测鼠标速度 → 受惊
  const now = Date.now()
  const dt = now - lastMouseTime
  if (dt > 0 && dt < 80) {
    const dx = e.clientX - lastMouseClientPos.x
    const dy = e.clientY - lastMouseClientPos.y
    const speed = Math.sqrt(dx * dx + dy * dy) / dt
    if (speed > 2.5 && !isScared.value && !isSleeping.value) {
      triggerScared()
    }
  }
  lastMouseTime = now
  lastMouseClientPos = { x: e.clientX, y: e.clientY }

  if (!isDragging) return
  const dx = e.screenX - prevX
  const dy = e.screenY - prevY
  prevX = e.screenX; prevY = e.screenY
  if (window.api && (dx !== 0 || dy !== 0)) {
    window.api.moveWindow(dx, dy)
  }
}

function stopDrag(e: MouseEvent) {
  if (isDragging) {
    if (Math.abs(e.screenX - tapStartX) < 5 && Math.abs(e.screenY - tapStartY) < 5) {
      onFishClick()
    }
  }
  isDragging = false
}

function onFishHover() { isHovered.value = true }
function onFishLeave() { isHovered.value = false }

const tapMessages = [
  '别戳我！', '嘿！', '干嘛呢~', '摸鱼中，勿扰',
  '好痒啊！', '再戳我就咬你！', '(=｀ω´=)', 'o(*￣▽￣*)o',
  '在摸了在摸了！', '嗷！', '你手怎么这么凉...',
]

function onFishClick() {
  if (isSleeping.value) { wakeUp(); return }

  showMsg(tapMessages[Math.floor(Math.random() * tapMessages.length)], 2000)
  spawnParticles(['❤️', '✨', '💕', '⭐', '💛', '💙'], 2 + Math.floor(Math.random() * 2))
  addCombo()
}

function onRightClick() {
  if (window.api) window.api.showContextMenu()
}

async function saveSettings() {
  if (!tempTime.value) return
  workEndTime.value = tempTime.value
  if (window.api) await window.api.setWorkEndTime(tempTime.value)
  showSettings.value = false
}
</script>

<style scoped>
.pet-wrapper {
  width: 320px;
  height: 200px;
  position: relative;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.pet-wrapper:active { cursor: grabbing; }

/* ── 气泡 ── */
.bubble-wrap {
  position: absolute;
  left: 0;
  top: 10px;
  width: 190px;
  transition: opacity 0.5s;
}
.bubble-wrap.sleeping-bubble { opacity: 0.75; }

.speech-bubble {
  background: rgba(255,255,255,0.95);
  border-radius: 16px;
  padding: 10px 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  position: relative;
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255,255,255,0.8);
  transition: all 0.4s ease;
}
.speech-bubble::after {
  content: '';
  position: absolute;
  right: -14px; top: 50%;
  transform: translateY(-50%);
  border: 7px solid transparent;
  border-left-color: rgba(255,255,255,0.95);
}
.speech-bubble.happy   { border-color: rgba(253,203,110,0.6); background: rgba(255,252,240,0.95); }
.speech-bubble.nervous { border-color: rgba(253,121,168,0.6); background: rgba(255,245,248,0.95); }
.speech-bubble.sad     { border-color: rgba(162,155,254,0.6); background: rgba(248,246,255,0.95); }
.speech-bubble.scared  { border-color: rgba(255,118,117,0.7); background: rgba(255,245,243,0.95); }
.speech-bubble.sleeping{ border-color: rgba(178,190,195,0.5); background: rgba(245,246,250,0.92); }

.bubble-text {
  font-size: 15px; font-weight: 700; color: #2d3436;
  white-space: nowrap;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.bubble-subtext {
  font-size: 11px; color: #636e72; margin-top: 3px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.interact-flash { animation: text-pop 0.2s ease-out; }
@keyframes text-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* ── 粒子层 ── */
.particles-layer {
  position: absolute; inset: 0;
  pointer-events: none; overflow: visible;
}
.particle {
  position: absolute;
  pointer-events: none;
  animation: float-up linear forwards;
}
.particle.zzz {
  animation: zzz-float ease-out forwards;
  color: #636e72; font-style: italic; font-weight: bold;
  font-family: 'Microsoft YaHei', sans-serif;
}
.particle.scare { animation: scare-pop ease-out forwards; }
.particle.rainbow { animation: rainbow-float ease-out forwards; }

@keyframes float-up {
  0%   { opacity: 1;   transform: translateY(0) scale(1); }
  80%  { opacity: 0.8; transform: translateY(-50px) scale(1.2); }
  100% { opacity: 0;   transform: translateY(-70px) scale(0.8); }
}
@keyframes zzz-float {
  0%   { opacity: 0;   transform: translateY(0) scale(0.6); }
  20%  { opacity: 0.9; }
  100% { opacity: 0;   transform: translateY(-40px) scale(1.2); }
}
@keyframes scare-pop {
  0%   { opacity: 1; transform: translateY(0) scale(1.2) rotate(-10deg); }
  100% { opacity: 0; transform: translateY(-35px) scale(0.8) rotate(10deg); }
}
@keyframes rainbow-float {
  0%   { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
  100% { opacity: 0; transform: translateY(-60px) scale(1.4) rotate(20deg); }
}

/* ── 鱼 ── */
.fish-wrap {
  position: absolute; right: 0;
  width: 140px; height: 100px;
  display: flex; align-items: center; justify-content: center;
}

.fish-svg {
  width: 130px; height: 90px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  animation: swim 3s ease-in-out infinite;
  transition: filter 0.3s ease;
}

/* 心情动画 */
.fish-wrap.happy    .fish-svg { animation: swim-happy   2s   ease-in-out infinite; }
.fish-wrap.nervous  .fish-svg { animation: swim-nervous 0.8s ease-in-out infinite; }
.fish-wrap.sad      .fish-svg { animation: swim-sad     4s   ease-in-out infinite; }
.fish-wrap.scared   .fish-svg { animation: swim-scared  0.1s ease-in-out infinite !important; filter: drop-shadow(0 0 8px rgba(255,100,80,0.6)); }
.fish-wrap.sleeping .fish-svg { animation: swim-sleep   5s   ease-in-out infinite !important; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1)) brightness(0.85); }

/* 悬停 */
.fish-wrap.is-hovered:not(.scared):not(.sleeping) .fish-svg {
  animation: swim-excited 0.6s ease-in-out infinite !important;
  filter: drop-shadow(0 4px 16px rgba(255,200,80,0.8));
  cursor: pointer;
}

/* 彩虹模式 */
.fish-wrap.is-rainbow .fish-svg {
  animation: swim-happy 1s ease-in-out infinite, rainbow-hue 0.6s linear infinite !important;
}

@keyframes swim         { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-10px) rotate(3deg)} }
@keyframes swim-happy   { 0%,100%{transform:translateY(0) rotate(-5deg) scale(1)} 25%{transform:translateY(-12px) rotate(5deg) scale(1.02)} 75%{transform:translateY(-6px) rotate(-2deg) scale(1.01)} }
@keyframes swim-nervous { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-4px) rotate(2deg)} }
@keyframes swim-sad     { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-5px) rotate(1deg)} }
@keyframes swim-scared  { 0%,100%{transform:translateX(0) rotate(0deg) scale(1.05)} 25%{transform:translateX(-4px) rotate(-4deg) scale(1.08)} 75%{transform:translateX(4px) rotate(4deg) scale(1.08)} }
@keyframes swim-sleep   { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-3px) rotate(1deg)} }
@keyframes swim-excited { 0%,100%{transform:translateY(0) rotate(-6deg) scale(1.05)} 50%{transform:translateY(-10px) rotate(6deg) scale(1.1)} }
@keyframes rainbow-hue  { from{filter:drop-shadow(0 4px 12px rgba(255,0,0,0.5)) hue-rotate(0deg)} to{filter:drop-shadow(0 4px 12px rgba(255,0,0,0.5)) hue-rotate(360deg)} }

/* 鱼尾 */
.fish-tail { transform-origin: 18px 40px; animation: wag 0.8s ease-in-out infinite; }
@keyframes wag { 0%,100%{transform:skewY(5deg)} 50%{transform:skewY(-5deg)} }

/* 泪/汗/受惊 */
.tear       { animation: drip 1.5s ease-in infinite; }
.tear2      { animation-delay: 0.5s; }
.sweat      { animation: sweat-drop 1s ease-in infinite; }
@keyframes drip       { 0%{opacity:.8;transform:translateY(0)} 100%{opacity:0;transform:translateY(15px)} }
@keyframes sweat-drop { 0%{opacity:0;transform:translateY(-5px)} 50%{opacity:.9} 100%{opacity:0;transform:translateY(10px)} }

/* 连击徽章 */
.combo-badge {
  position: absolute;
  bottom: -8px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(135deg, #fd79a8, #e17055);
  color: white;
  font-size: 10px; font-weight: 800;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(253,121,168,0.5);
  animation: badge-pulse 0.4s ease-in-out infinite alternate;
  font-family: 'Microsoft YaHei', sans-serif;
}
@keyframes badge-pulse { from{transform:translateX(-50%) scale(1)} to{transform:translateX(-50%) scale(1.1)} }

/* ── 设置弹窗 ── */
.settings-overlay {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.settings-panel {
  background: white; border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  min-width: 220px; cursor: default;
}
.settings-title {
  font-size: 14px; font-weight: 700; color: #2d3436;
  margin-bottom: 14px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.time-input {
  width: 100%; padding: 8px 12px;
  border: 2px solid #74b9ff; border-radius: 8px;
  font-size: 20px; text-align: center;
  outline: none; color: #2d3436; margin-bottom: 14px;
}
.time-input:focus { border-color: #0984e3; }
.settings-buttons { display: flex; gap: 10px; justify-content: flex-end; }
.btn-cancel, .btn-save {
  padding: 6px 16px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 13px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  transition: opacity 0.2s;
}
.btn-cancel { background: #dfe6e9; color: #636e72; }
.btn-save   { background: #74b9ff; color: white; font-weight: 600; }
.btn-cancel:hover, .btn-save:hover { opacity: 0.85; }
</style>
