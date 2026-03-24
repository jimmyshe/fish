<template>
  <div class="pet-wrapper" @mousedown.left="startDrag" @contextmenu.prevent="onRightClick">

    <!-- 对话气泡 -->
    <div class="bubble-wrap">
      <div class="speech-bubble" :class="mood">
        <div class="bubble-text" :class="{ 'interact-flash': !!interactMessage }">
          {{ interactMessage || timeMessage }}
        </div>
        <div class="bubble-subtext" v-if="!interactMessage && subMessage">{{ subMessage }}</div>
      </div>
    </div>

    <!-- 点击飘出的爱心 -->
    <div class="hearts-layer">
      <span
        v-for="h in floatingHearts"
        :key="h.id"
        class="floating-heart"
        :style="{ left: h.x + 'px', animationDuration: h.dur + 's' }"
      >{{ h.char }}</span>
    </div>

    <!-- 小鱼 SVG -->
    <div
      class="fish-wrap"
      :class="[mood, { 'is-hovered': isHovered }]"
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
        <!-- 眼睛瞳孔（跟随鼠标） -->
        <circle :cx="eyeX" :cy="eyeY" r="5" fill="#1a1a2e" />
        <!-- 眼睛高光 -->
        <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="2" fill="white" />

        <!-- 嘴巴 - 根据心情变化 -->
        <path v-if="mood === 'happy'" d="M 98 42 Q 106 48 98 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else-if="mood === 'normal'" d="M 98 45 Q 106 45 98 45" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else-if="mood === 'nervous'" d="M 98 48 Q 103 44 108 48" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path v-else d="M 98 50 Q 106 44 98 44" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>

        <!-- 加班时的泪水 -->
        <g v-if="mood === 'sad'">
          <ellipse cx="88" cy="45" rx="2" ry="3" fill="#74b9ff" opacity="0.8" class="tear tear1"/>
          <ellipse cx="86" cy="52" rx="1.5" ry="2.5" fill="#74b9ff" opacity="0.6" class="tear tear2"/>
        </g>

        <!-- 快下班时的汗水 -->
        <g v-if="mood === 'nervous'">
          <ellipse cx="76" cy="25" rx="2" ry="3" fill="#a8d8f0" opacity="0.8" class="sweat" />
        </g>

        <!-- 鱼鳞纹理 -->
        <path d="M 55 30 Q 63 26 68 33" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
        <path d="M 48 36 Q 56 32 61 39" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
        <path d="M 55 44 Q 63 48 68 43" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
      </svg>
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

// 状态
const workEndTime = ref('18:00')
const currentTime = ref(new Date())
const showSettings = ref(false)
const tempTime = ref('18:00')

// 鼠标互动状态
const fishSvgRef = ref<SVGElement | null>(null)
const mousePos = ref({ x: 0, y: 0 })
const isHovered = ref(false)
const interactMessage = ref('')
let interactTimer: ReturnType<typeof setTimeout> | null = null

// 飘浮爱心
interface Heart { id: number; x: number; char: string; dur: number }
const floatingHearts = ref<Heart[]>([])
let heartId = 0

// 拖拽状态
let isDragging = false
let prevX = 0
let prevY = 0
let tapStartX = 0
let tapStartY = 0

// 计算剩余时间（分钟）
const remainingMinutes = computed(() => {
  const now = currentTime.value
  const [endHour, endMin] = workEndTime.value.split(':').map(Number)

  const endMs = endHour * 60 * 60 * 1000 + endMin * 60 * 1000
  const nowMs = now.getHours() * 60 * 60 * 1000 + now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000

  return Math.floor((endMs - nowMs) / 60000)
})

// 心情状态
const mood = computed(() => {
  const min = remainingMinutes.value
  if (min < 0) return 'sad'       // 加班了
  if (min <= 30) return 'nervous' // 快下班了，紧张
  if (min <= 120) return 'happy'  // 2小时内，开心
  return 'normal'                 // 还早，平静
})

// 鱼的颜色
const bodyColor = computed(() => {
  const colors: Record<string, string> = {
    sad: '#a29bfe',
    nervous: '#fd79a8',
    happy: '#fdcb6e',
    normal: '#74b9ff'
  }
  return colors[mood.value]
})

const tailColor = computed(() => {
  const colors: Record<string, string> = {
    sad: '#6c5ce7',
    nervous: '#e84393',
    happy: '#e17055',
    normal: '#0984e3'
  }
  return colors[mood.value]
})

const finColor = computed(() => {
  const colors: Record<string, string> = {
    sad: '#9b8af4',
    nervous: '#fc5c8a',
    happy: '#ffeaa7',
    normal: '#a8d8f0'
  }
  return colors[mood.value]
})

// 眼睛瞳孔跟随鼠标
const eyeOffset = computed(() => {
  const el = fishSvgRef.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const scaleX = rect.width / 120
  const scaleY = rect.height / 80
  // 眼白中心在 SVG 坐标 (84, 34) 对应的屏幕坐标
  const eyeCX = rect.left + 84 * scaleX
  const eyeCY = rect.top + 34 * scaleY
  const dx = mousePos.value.x - eyeCX
  const dy = mousePos.value.y - eyeCY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: 0, y: 0 }
  const maxOffset = 2.5
  const factor = Math.min(dist / 100, 1) * maxOffset
  return { x: (dx / dist) * factor, y: (dy / dist) * factor }
})

// 眼睛位置（心情 + 鼠标偏移）
const eyeX = computed(() => (mood.value === 'sad' ? 83 : 85) + eyeOffset.value.x)
const eyeY = computed(() => 35 + eyeOffset.value.y)
const eyeHighlightX = computed(() => eyeX.value + 1)
const eyeHighlightY = computed(() => eyeY.value - 2)

// 主要消息
const timeMessage = computed(() => {
  const min = remainingMinutes.value
  if (min < 0) {
    const overMin = Math.abs(min)
    const h = Math.floor(overMin / 60)
    const m = overMin % 60
    if (h > 0) return `加班 ${h}小时${m > 0 ? m + '分' : ''}了！`
    return `加班 ${m} 分钟了！`
  }
  if (min === 0) return '到点下班啦！'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `还有 ${h}小时${m > 0 ? m + '分' : ''}`
  return `还有 ${m} 分钟`
})

// 副消息
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

// 定时更新
let timer: ReturnType<typeof setInterval>

onMounted(async () => {
  // 获取保存的下班时间
  if (window.api) {
    workEndTime.value = await window.api.getWorkEndTime()
    tempTime.value = workEndTime.value

    // 监听设置面板打开事件
    window.api.onOpenSettings(() => {
      tempTime.value = workEndTime.value
      showSettings.value = true
    })
  }

  timer = setInterval(() => {
    currentTime.value = new Date()
  }, 10000) // 每10秒更新一次

  // 鼠标移动/抬起全局监听
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopDrag)
})

onUnmounted(() => {
  clearInterval(timer)
  if (interactTimer) clearTimeout(interactTimer)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopDrag)
})

// 拖拽 & 点击检测
function startDrag(e: MouseEvent): void {
  if (showSettings.value) return
  isDragging = true
  prevX = e.screenX
  prevY = e.screenY
  tapStartX = e.screenX
  tapStartY = e.screenY
}

function onMouseMove(e: MouseEvent): void {
  // 更新鼠标位置用于眼睛追踪
  mousePos.value = { x: e.clientX, y: e.clientY }
  if (!isDragging) return
  const dx = e.screenX - prevX
  const dy = e.screenY - prevY
  prevX = e.screenX
  prevY = e.screenY
  if (window.api && (dx !== 0 || dy !== 0)) {
    window.api.moveWindow(dx, dy)
  }
}

function stopDrag(e: MouseEvent): void {
  if (isDragging) {
    const dx = Math.abs(e.screenX - tapStartX)
    const dy = Math.abs(e.screenY - tapStartY)
    // 移动 < 5px 视为点击
    if (dx < 5 && dy < 5) {
      onFishClick()
    }
  }
  isDragging = false
}

// 鼠标悬停
function onFishHover(): void {
  isHovered.value = true
}
function onFishLeave(): void {
  isHovered.value = false
}

// 点击互动
const tapMessages = [
  '别戳我！', '嘿！', '干嘛呢~', '摸鱼中，勿扰',
  '好痒啊！', '喂！', '再戳我就咬你！', '有事吗？',
  '(=｀ω´=)', 'o(*￣▽￣*)o', '在摸了在摸了！', '嗷！'
]
const heartChars = ['❤️', '✨', '💕', '⭐', '💛', '💙']

function onFishClick(): void {
  // 随机消息
  const msg = tapMessages[Math.floor(Math.random() * tapMessages.length)]
  interactMessage.value = msg
  if (interactTimer) clearTimeout(interactTimer)
  interactTimer = setTimeout(() => { interactMessage.value = '' }, 2000)

  // 飘出 2~3 个爱心/星星
  const count = 2 + Math.floor(Math.random() * 2)
  for (let i = 0; i < count; i++) {
    const id = heartId++
    const heart: Heart = {
      id,
      x: 170 + (Math.random() - 0.5) * 60, // 鱼的大概中心X偏移
      char: heartChars[Math.floor(Math.random() * heartChars.length)],
      dur: 0.8 + Math.random() * 0.6
    }
    floatingHearts.value.push(heart)
    setTimeout(() => {
      floatingHearts.value = floatingHearts.value.filter(h => h.id !== id)
    }, heart.dur * 1000 + 100)
  }
}

// 右键菜单
function onRightClick(): void {
  if (window.api) {
    window.api.showContextMenu()
  }
}

// 保存设置
async function saveSettings(): Promise<void> {
  if (!tempTime.value) return
  workEndTime.value = tempTime.value
  if (window.api) {
    await window.api.setWorkEndTime(tempTime.value)
  }
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

.pet-wrapper:active {
  cursor: grabbing;
}

/* 气泡区域 */
.bubble-wrap {
  position: absolute;
  left: 0;
  top: 10px;
  width: 190px;
}

.speech-bubble {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 10px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  position: relative;
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.8);
  transition: all 0.5s ease;
}

/* 气泡三角 */
.speech-bubble::after {
  content: '';
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  border: 7px solid transparent;
  border-left-color: rgba(255, 255, 255, 0.95);
}

.speech-bubble.happy {
  border-color: rgba(253, 203, 110, 0.6);
  background: rgba(255, 252, 240, 0.95);
}
.speech-bubble.nervous {
  border-color: rgba(253, 121, 168, 0.6);
  background: rgba(255, 245, 248, 0.95);
}
.speech-bubble.sad {
  border-color: rgba(162, 155, 254, 0.6);
  background: rgba(248, 246, 255, 0.95);
}

.bubble-text {
  font-size: 15px;
  font-weight: 700;
  color: #2d3436;
  white-space: nowrap;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.bubble-subtext {
  font-size: 11px;
  color: #636e72;
  margin-top: 3px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

/* 爱心层 */
.hearts-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.floating-heart {
  position: absolute;
  bottom: 60px;
  font-size: 18px;
  animation: float-up linear forwards;
  pointer-events: none;
}

@keyframes float-up {
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  80%  { opacity: 0.8; transform: translateY(-50px) scale(1.2); }
  100% { opacity: 0; transform: translateY(-70px) scale(0.8); }
}

/* 点击气泡文字闪动 */
.interact-flash {
  animation: text-pop 0.2s ease-out;
}

@keyframes text-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* 鱼的区域 */
.fish-wrap {
  position: absolute;
  right: 0;
  width: 140px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fish-svg {
  width: 130px;
  height: 90px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  animation: swim 3s ease-in-out infinite;
  transition: filter 0.3s ease;
}

.fish-wrap.happy .fish-svg {
  animation: swim-happy 2s ease-in-out infinite;
}

.fish-wrap.nervous .fish-svg {
  animation: swim-nervous 0.8s ease-in-out infinite;
}

.fish-wrap.sad .fish-svg {
  animation: swim-sad 4s ease-in-out infinite;
}

/* 悬停：加速游动 + 发光 */
.fish-wrap.is-hovered .fish-svg {
  animation: swim-excited 0.6s ease-in-out infinite !important;
  filter: drop-shadow(0 4px 14px rgba(255, 200, 80, 0.7));
  cursor: pointer;
}

@keyframes swim-excited {
  0%, 100% { transform: translateY(0) rotate(-6deg) scale(1.05); }
  50%       { transform: translateY(-10px) rotate(6deg) scale(1.1); }
}

/* 鱼尾动画 */
.fish-tail {
  transform-origin: 18px 40px;
  animation: wag 0.8s ease-in-out infinite;
}

/* 泪水动画 */
.tear {
  animation: drip 1.5s ease-in infinite;
}
.tear2 {
  animation-delay: 0.5s;
}

/* 汗水动画 */
.sweat {
  animation: sweat-drop 1s ease-in infinite;
}

/* 游泳动画 */
@keyframes swim {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-10px) rotate(3deg); }
}

@keyframes swim-happy {
  0%, 100% { transform: translateY(0) rotate(-5deg) scale(1); }
  25% { transform: translateY(-12px) rotate(5deg) scale(1.02); }
  75% { transform: translateY(-6px) rotate(-2deg) scale(1.01); }
}

@keyframes swim-nervous {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-4px) rotate(2deg); }
}

@keyframes swim-sad {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-5px) rotate(1deg); }
}

@keyframes wag {
  0%, 100% { transform: skewY(5deg); }
  50% { transform: skewY(-5deg); }
}

@keyframes drip {
  0% { opacity: 0.8; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(15px); }
}

@keyframes sweat-drop {
  0% { opacity: 0; transform: translateY(-5px); }
  50% { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(10px); }
}

/* 设置弹窗 */
.settings-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.settings-panel {
  background: white;
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 220px;
  cursor: default;
}

.settings-title {
  font-size: 14px;
  font-weight: 700;
  color: #2d3436;
  margin-bottom: 14px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.time-input {
  width: 100%;
  padding: 8px 12px;
  border: 2px solid #74b9ff;
  border-radius: 8px;
  font-size: 20px;
  text-align: center;
  outline: none;
  color: #2d3436;
  margin-bottom: 14px;
}

.time-input:focus {
  border-color: #0984e3;
}

.settings-buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel, .btn-save {
  padding: 6px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  transition: opacity 0.2s;
}

.btn-cancel {
  background: #dfe6e9;
  color: #636e72;
}

.btn-save {
  background: #74b9ff;
  color: white;
  font-weight: 600;
}

.btn-cancel:hover, .btn-save:hover {
  opacity: 0.85;
}
</style>
