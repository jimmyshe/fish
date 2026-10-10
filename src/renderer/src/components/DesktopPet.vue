<template>
  <!-- 游乐场：覆盖整个主屏的透明层；鱼是其中的定位元素 -->
  <div class="playground">
    <div
      class="pet-wrapper"
      :style="fishStyle"
    >

    <!-- 对话气泡 -->
    <div class="bubble-wrap" :class="{ 'sleeping-bubble': isSleeping && !showWaterReminder }">
      <div class="speech-bubble" :class="[effectiveMoodClass, { 'water-alert': showWaterReminder }]">
        <template v-if="showWaterReminder">
          <div class="bubble-text water-pulse">💧 该喝水啦！</div>
          <div class="bubble-subtext">点下面确认才能消失哦~</div>
          <button class="water-btn" @mousedown.stop @click.stop="confirmWaterDrank">✓ 我喝了！</button>
        </template>
        <template v-else>
          <div class="bubble-text" :class="{ 'interact-flash': !!interactMessage }">
            {{ displayMessage }}
          </div>
          <div class="bubble-subtext" v-if="displaySubMessage">{{ displaySubMessage }}</div>
        </template>
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

    <!-- 小鱼 SVG；点击/拖拽/右键的命中区域只有鱼本体，透明 padding 一律穿透 -->
    <div
      class="fish-wrap"
      :class="[effectiveMoodClass, { 'is-hovered': isHovered, 'is-rainbow': isRainbow, 'face-left': facingLeft, 'is-pooping': isPooping }]"
      @mousedown.left="startDrag"
      @contextmenu.prevent="onRightClick"
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
    </div>

    <!-- 屎层：.playground 的平级子元素，坐标即视口坐标；点击铲屎 -->
    <div
      v-for="p in poops"
      :key="p.id"
      class="poop"
      :style="{ left: p.x + 'px', top: p.y + 'px' }"
      @mousedown.stop
      @click.stop="scoopPoop(p.id)"
    >💩</div>

    <!-- 设置弹窗（须在 transform 容器之外，fixed 定位才相对视口）：只留下班时间 -->
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDrag } from '../composables/useDrag'
import { usePetScheduler } from '../composables/usePetScheduler'
import { petTime } from '../lib/petTime'
import { clampFishPosition, resolveInitialFishPosition } from '../lib/fishPosition'
import {
  MOTION,
  avoidanceForce,
  computeFacing,
  dashDirection,
  edgeForce,
  fishCenter,
  integrateVelocity,
  shouldScare,
  stepWanderAngle,
  FISH_CONTAINER
} from '../lib/fishMotion'
import { nextPoopDelayMs, poopDropPosition, serializePoops, type Poop } from '../lib/poop'

// ── 定时器调度 ────────────────────────────────────
// 全部定时行为的唯一属主；句柄不离开模块，卸载时自动全部取消
const scheduler = usePetScheduler()

// ── 基础状态 ──────────────────────────────────────
const workEndTime = ref('18:00')
const currentTime = ref(new Date())
const showSettings = ref(false)
const tempTime = ref('18:00')

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND

// ── 鼠标追踪 ──────────────────────────────────────
const fishSvgRef = ref<SVGElement | null>(null)
const mousePos = ref({ x: 0, y: 0 })
const isHovered = ref(false)

let lastMouseTime = 0
let lastMouseClientPos = { x: 0, y: 0 }
// 最近一次收到全局鼠标事件的时间；活跃期间窗口内 mousemove 仅作降级
let lastGlobalMouseAt = 0

// ── 鱼元素位置（游乐场窗口内绝对定位，CSS transform 驱动） ──
const fishPos = ref(
  resolveInitialFishPosition(-1, -1, window.innerWidth, window.innerHeight)
)
const fishStyle = computed(() => ({
  transform: `translate(${fishPos.value.x}px, ${fishPos.value.y}px)`
}))

function moveFishBy(dx: number, dy: number) {
  fishPos.value = clampFishPosition(
    fishPos.value.x + dx,
    fishPos.value.y + dy,
    window.innerWidth,
    window.innerHeight
  )
}

function persistFishPosition() {
  if (window.api) window.api.setFishPosition(fishPos.value.x, fishPos.value.y)
}

// ── 动态点击穿透 ──────────────────────────────────
// 默认全屏穿透；光标位于鱼本体/气泡/交互 UI 上时临时关闭。状态去重：只在变化时发 IPC。
// 命中区域是可见元素而非 320×200 容器大框：透明 padding 一律穿透。
const INTERACTIVE_SELECTOR = '.fish-wrap, .bubble-wrap, .settings-panel, .poop'
let clickThrough = true

function hitInteractiveAt(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  return !!(el && el.closest(INTERACTIVE_SELECTOR))
}

function updateClickThrough(hitInteractive: boolean) {
  // 拖拽进行期间保持不穿透（拖拽中光标会离开鱼身，此时开穿透会丢失 mouseup 导致拖拽卡死）；
  // 面板打开不是强制条件：默认全屏穿透，纯命中检测驱动（设置面板开着也能点桌面其他应用）
  const desired = isDragging.value ? false : !hitInteractive
  if (desired === clickThrough) return
  clickThrough = desired
  if (window.api) window.api.setClickThrough(desired)
}

function handleHitTest(e: MouseEvent) {
  updateClickThrough(hitInteractiveAt(e.clientX, e.clientY))
}

watch(showSettings, () => {
  // 设置弹窗开关后按当前光标位置主动做一次命中检测
  // （解决「面板恰好在光标下打开」的边角：不常开强制不穿透）
  updateClickThrough(hitInteractiveAt(lastMouseClientPos.x, lastMouseClientPos.y))
})

// ── 互动消息 ──────────────────────────────────────
const interactMessage = ref('')

function showMsg(msg: string, duration = 2000) {
  interactMessage.value = msg
  scheduler.after('interact', duration, () => { interactMessage.value = '' })
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
    scheduler.after(`particle:${id}`, p.dur * MS_PER_SECOND + 150, () => {
      particles.value = particles.value.filter(x => x.id !== id)
    })
  }
}

// ── 拖拽模块 ──────────────────────────────────────
// 位移计算、点击判定都在模块内部；拖鱼 = 增量移动 fishPos，结束时持久化
const { isDragging, startDrag } = useDrag({
  onTap: onFishClick,
  onMouseMove: handleMouseMove,
  onDragMove: moveFishBy,
  onDragEnd: persistFishPosition,
})

// ── 受惊模式 ──────────────────────────────────────
const isScared = ref(false)

function triggerScared() {
  if (isScared.value) return
  isScared.value = true
  // 先注册恢复定时器再做副作用：气泡/粒子/拉屎任何一步抛异常，受惊状态都一定能恢复
  scheduler.after('scared', 1800, () => { isScared.value = false })
  const msgs = ['呀！！', '不要过来！', '救命！', '太快了！', '(ﾟДﾟ)！']
  showMsg(msgs[Math.floor(Math.random() * msgs.length)], 1500)
  spawnParticles(['！', '💦', '😱'], 3, 'scare')
  // 受惊排泄：触发瞬间立刻拉一泡（边逃边拉），无冷却/动画/文案，与定时链完全独立；开关关闭时整个功能停用
  if (poopEnabled.value) dropPoop()
  // 逃窜：优先于漫游，朝远离鼠标方向冲刺一次
  const dir = dashDirection(fishCenter(fishPos.value), hasMouseData ? mousePos.value : null)
  swimState.phase = 'dash'
  swimState.vx = dir.x * MOTION.DASH_SPEED
  swimState.vy = dir.y * MOTION.DASH_SPEED
  swimState.phaseLeftMs = MOTION.DASH_MS
}

// ── 睡眠模式 ──────────────────────────────────────
const isSleeping = ref(false)
const SLEEP_TIMEOUT = 3 * MS_PER_MINUTE // 3分钟无操作

function resetSleepTimer() {
  if (isSleeping.value) {
    wakeUp()
    return
  }
  scheduler.after('sleep', SLEEP_TIMEOUT, fallAsleep)
}

function fallAsleep() {
  isSleeping.value = true
  // 定时飘出 Zzz
  scheduler.every('zzz', 1500, () => {
    if (isSleeping.value) {
      spawnParticles(['z', 'Z', 'z'], 1, 'zzz')
    }
  })
}

function wakeUp() {
  isSleeping.value = false
  scheduler.cancel('zzz')
  showMsg('呼～被吵醒了...', 2000)
  resetSleepTimer()
}

// ── 连击彩蛋 ──────────────────────────────────────
const comboCount = ref(0)
const isRainbow = ref(false)

function addCombo() {
  comboCount.value++
  scheduler.after('combo', 3000, () => { comboCount.value = 0 })

  if (comboCount.value >= 5) {
    comboCount.value = 0
    triggerRainbow()
  }
}

function triggerRainbow() {
  if (isRainbow.value) return
  isRainbow.value = true
  // 先注册恢复定时器再做副作用，与 triggerScared 同一原则
  scheduler.after('rainbow', 5000, () => { isRainbow.value = false })
  const msgs = ['🌈 彩虹鱼出现了！！', '✨ 传说中的彩鱼！', '🎊 隐藏彩蛋解锁！']
  showMsg(msgs[Math.floor(Math.random() * msgs.length)], 4000)
  spawnParticles(['🌈', '✨', '🎉', '⭐', '💫'], 6, 'rainbow')
}

// ── 喝水提醒 ──────────────────────────────────────
const showWaterReminder = ref(false)
const WATER_INTERVAL = 45 * MS_PER_MINUTE // 45分钟

function scheduleWaterReminder() {
  scheduler.after('water', WATER_INTERVAL, () => {
    showWaterReminder.value = true
    spawnParticles(['💧', '💦', '💧'], 4, 'heart')
  })
}

function confirmWaterDrank() {
  showWaterReminder.value = false
  showMsg('棒棒！多喝水 💪', 2500)
  spawnParticles(['💧', '✨', '💪', '⭐'], 5, 'rainbow')
  scheduleWaterReminder()
}

// ── 拉屎 ─────────────────────────────────────────
// 定时排泄：PetScheduler 自调度链（15~30 分钟随机一泡），受惊排泄与其完全独立。
// 屎无上限、不自动消失；每次增删即持久化，重启后原位恢复。
const poops = ref<Poop[]>([])
const poopEnabled = ref(true)
const isPooping = ref(false)
const POOP_ANIM_MS = 800 // 抖动使劲动画时长
let poopSeq = 0

const poopReliefMessages = ['舒服了', '别看', '……', '谁把灯打开']
const scoopMessages = ['谢谢主人', '好人一生平安', '终于有人管了']

function persistPoops() {
  // 必须序列化为纯对象：poops.value 是 Vue 响应式代理，直接过 IPC 结构化克隆会同步抛异常
  if (window.api) window.api.setPoops(serializePoops(poops.value))
}

/** 💩 落在鱼尾后方偏下（随朝向镜像），轻量收敛避免掉出屏幕 */
function dropPoop() {
  const pos = poopDropPosition(fishPos.value, facingLeft.value ? -1 : 1)
  poops.value = [...poops.value, {
    id: `${Date.now()}-${poopSeq++}`,
    x: Math.min(Math.max(pos.x, 12), window.innerWidth - 12),
    y: Math.min(Math.max(pos.y, 12), window.innerHeight - 12)
  }]
  persistPoops()
}

function schedulePoop() {
  // 同名重挂：回调内再挂同名定时器，cancel('poop') 可终止整条链
  scheduler.after('poop', nextPoopDelayMs(), onScheduledPoop)
}

function onScheduledPoop() {
  if (isSleeping.value || isScared.value) {
    // 梦游拉屎（或受惊中到点）：不唤醒、无动画，💩直接出现
    dropPoop()
  } else {
    // 清醒：暂停漫游 → 抖动使劲 → 💩落下 → 漫游随 phaseLeftMs 耗尽自动恢复
    isPooping.value = true
    swimState.phase = 'pause'
    swimState.vx = 0
    swimState.vy = 0
    swimState.phaseLeftMs = POOP_ANIM_MS
    scheduler.after('poop-drop', POOP_ANIM_MS, () => {
      // 先复位状态再做副作用：dropPoop 若抛异常，使劲动画状态不卡死
      isPooping.value = false
      dropPoop()
      showMsg(poopReliefMessages[Math.floor(Math.random() * poopReliefMessages.length)], 2000)
    })
  }
  schedulePoop()
}

/** 开关变更：关闭即停调度（已拉出的屎保留可铲），开启重新调度 */
function applyPoopEnabled(enabled: boolean) {
  poopEnabled.value = enabled
  if (enabled) {
    schedulePoop()
  } else {
    scheduler.cancel('poop')
    scheduler.cancel('poop-drop') // 中断进行到一半的使劲动画
    isPooping.value = false
  }
}

/** 铲屎：喷粒子 + 感谢文案 → 屎消失并落盘；同时上报铲屎事件（未登录/失败由主进程静默丢弃） */
function scoopPoop(id: string) {
  poops.value = poops.value.filter(p => p.id !== id)
  persistPoops()
  if (window.api) window.api.reportScoop()
  spawnParticles(['✨', '🧹', '💛', '⭐'], 4, 'rainbow')
  showMsg(scoopMessages[Math.floor(Math.random() * scoopMessages.length)], 2000)
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
  const delay = (90 + Math.random() * 120) * MS_PER_SECOND // 1.5~3.5 分钟
  // 同名重挂：回调内再挂同名定时器，cancel('monologue') 可终止整条链
  scheduler.after('monologue', delay, () => {
    if (!isSleeping.value && !interactMessage.value && !isScared.value) {
      showMsg(monologues[Math.floor(Math.random() * monologues.length)], 3000)
    }
    scheduleMonologue()
  })
}

// ── 自主漂移 ──────────────────────────────────────
// 常驻 tick 驱动速度向量积分（漫游），取代旧的定时小幅跳动：
// 漫游转向力 + 边缘软斥力 + 鼠标回避场叠加；鼠标快速贴近触发受惊 →
// 优先执行一次逃窜，结束后恢复漫游。偶尔停歇。
// 拖拽 / 睡眠 / 设置弹窗期间 tick 照跑但不积分（鱼保持不动）。
const swimState = {
  phase: 'swim' as 'swim' | 'pause' | 'dash',
  vx: 0,
  vy: 0,
  angle: Math.random() * Math.PI * 2,
  cruise: MOTION.CRUISE_MIN as number,
  phaseLeftMs: randRange(MOTION.SWIM_LEG_MIN_MS, MOTION.SWIM_LEG_MAX_MS)
}
const facingLeft = ref(false)
// 收到过鼠标数据后才启用避鼠（初始 {0,0} 是屏幕角落，不是真实鼠标位置）
let hasMouseData = false
let lastTickAt = 0

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function swimTick() {
  const now = Date.now()
  if (lastTickAt === 0) lastTickAt = now
  // dt 封顶 0.1s：窗口挂起恢复时不至于一步跳太远
  const dt = Math.min((now - lastTickAt) / MS_PER_SECOND, 0.1)
  lastTickAt = now

  if (isDragging.value || isSleeping.value || showSettings.value) return

  swimState.phaseLeftMs -= dt * MS_PER_SECOND

  if (swimState.phase === 'swim' && swimState.phaseLeftMs <= 0) {
    swimState.phase = 'pause'
    swimState.phaseLeftMs = randRange(MOTION.PAUSE_MIN_MS, MOTION.PAUSE_MAX_MS)
    swimState.vx = 0
    swimState.vy = 0
    persistFishPosition() // 停歇即停靠点：落盘
  } else if (swimState.phaseLeftMs <= 0) {
    // pause / dash 结束：恢复漫游（逃窜结束的停靠点也落盘）
    if (swimState.phase === 'dash') persistFishPosition()
    swimState.phase = 'swim'
    swimState.phaseLeftMs = randRange(MOTION.SWIM_LEG_MIN_MS, MOTION.SWIM_LEG_MAX_MS)
    swimState.cruise = randRange(MOTION.CRUISE_MIN, MOTION.CRUISE_MAX)
  }

  if (swimState.phase === 'pause') return

  if (swimState.phase === 'dash') {
    moveFishBy(swimState.vx * dt, swimState.vy * dt)
  } else {
    swimState.angle = stepWanderAngle(swimState.angle, MOTION.WANDER_JITTER)
    const desired = {
      x: Math.cos(swimState.angle) * swimState.cruise,
      y: Math.sin(swimState.angle) * swimState.cruise
    }
    const mouse = hasMouseData ? mousePos.value : null
    const vel = integrateVelocity(
      { x: swimState.vx, y: swimState.vy },
      desired,
      [
        avoidanceForce(fishCenter(fishPos.value), mouse, MOTION.AVOID_RADIUS, MOTION.AVOID_STRENGTH),
        edgeForce(
          fishPos.value,
          FISH_CONTAINER,
          { x: window.innerWidth, y: window.innerHeight },
          MOTION.EDGE_MARGIN,
          MOTION.EDGE_STRENGTH
        )
      ],
      dt,
      MOTION.MAX_SPEED,
      MOTION.TURN_RATE
    )
    swimState.vx = vel.x
    swimState.vy = vel.y
    moveFishBy(vel.x * dt, vel.y * dt)
  }

  const facing = computeFacing(swimState.vx, facingLeft.value ? -1 : 1, MOTION.FACE_DEADZONE)
  facingLeft.value = facing === -1
}

// ── 计算属性 ──────────────────────────────────────
// 时间推导：心情阈值与文案分级都在 petTime 模块内部
const timeInfo = computed(() => petTime(currentTime.value, workEndTime.value))
const mood = computed(() => timeInfo.value.mood)

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
const displayMessage = computed(() => {
  if (isSleeping.value) return 'Z z z ...'
  return interactMessage.value || timeInfo.value.message
})

const displaySubMessage = computed(() => {
  if (isSleeping.value) return '（睡着了，别吵我）'
  if (interactMessage.value) return ''
  return timeInfo.value.subMessage
})

// ── 生命周期 ──────────────────────────────────────
const unsubscribeGlobal: Array<() => void> = []

onMounted(async () => {
  if (window.api) {
    workEndTime.value = await window.api.getWorkEndTime()
    tempTime.value = workEndTime.value
    window.api.onOpenSettings(() => {
      tempTime.value = workEndTime.value
      showSettings.value = true
    })

    // 鱼的位置：读取持久化配置（无效值回退屏幕右下角附近）
    const saved = await window.api.getFishPosition()
    fishPos.value = resolveInitialFishPosition(
      saved.x, saved.y, window.innerWidth, window.innerHeight
    )

    // 全局鼠标追踪：驱动鱼眼跟随 / 睡眠唤醒；窗口内 mousemove 作为降级
    unsubscribeGlobal.push(window.api.onGlobalMouseMove((pos) => {
      lastGlobalMouseAt = Date.now()
      handleMouseActivity(pos.x, pos.y)
    }))
    unsubscribeGlobal.push(window.api.onGlobalMouseClick((pos) => {
      // 全局点击暂无消费者，先留调试日志
      console.debug('[globalMouse] click', pos)
    }))

    // 拉屎：恢复已拉出的屎；开关先拉一次，之后订阅主进程推送（托盘菜单切换）
    poops.value = await window.api.getPoops()
    applyPoopEnabled(await window.api.getPoopEnabled())
    unsubscribeGlobal.push(window.api.onPoopEnabledChanged(applyPoopEnabled))
  }

  // 动态命中检测：穿透开启时 mousemove 由 forward 转发而来
  document.addEventListener('mousemove', handleHitTest)

  scheduler.every('clock', 10 * MS_PER_SECOND, () => { currentTime.value = new Date() })

  resetSleepTimer()
  scheduleMonologue()
  scheduler.every('swim-tick', MOTION.TICK_MS, swimTick)
  scheduleWaterReminder()

  // 卸载前把当前位置落盘（游动中途不存，只存停靠点）
  window.addEventListener('beforeunload', persistFishPosition)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleHitTest)
  window.removeEventListener('beforeunload', persistFishPosition)
  unsubscribeGlobal.forEach((off) => off())
})

// ── 事件处理 ──────────────────────────────────────
// startDrag / stopDrag / 拖拽位移已由 useDrag 模块接管
// 鼠标活动统一入口：全局钩子（30Hz 节流）与窗口内 mousemove 降级共用
function handleMouseActivity(x: number, y: number) {
  mousePos.value = { x, y }
  hasMouseData = true
  resetSleepTimer()

  // 受惊判定：鼠标「快速」且「贴近」（贴脸半径内）才触发；
  // 慢慢靠近只被回避场推开，不惊吓鱼
  const now = Date.now()
  const dt = now - lastMouseTime
  if (dt > 0 && dt < 80 && !isScared.value && !isSleeping.value) {
    const dx = x - lastMouseClientPos.x
    const dy = y - lastMouseClientPos.y
    const speed = Math.sqrt(dx * dx + dy * dy) / dt
    const c = fishCenter(fishPos.value)
    const dist = Math.hypot(x - c.x, y - c.y)
    if (shouldScare(speed, dist, MOTION.NEAR_RADIUS, MOTION.SCARE_SPEED)) {
      triggerScared()
    }
  }
  lastMouseTime = now
  lastMouseClientPos = { x, y }
}

// 窗口内 mousemove：全局追踪活跃时让位（避免双源互相干扰），否则作为降级数据源
function handleMouseMove(e: MouseEvent) {
  if (Date.now() - lastGlobalMouseAt < 1000) return
  handleMouseActivity(e.clientX, e.clientY)
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
  if (window.api) {
    // 以主进程返回的已保存配置为准，避免本地先写、异步失败导致分叉
    const config = await window.api.setWorkEndTime(tempTime.value)
    workEndTime.value = config.workEndTime
  } else {
    workEndTime.value = tempTime.value
  }
  showSettings.value = false
}
</script>

<style scoped>
/* 游乐场：覆盖整个主屏的透明层，鱼的游动范围 */
.playground {
  position: fixed;
  inset: 0;
}

.pet-wrapper {
  width: 320px;
  height: 200px;
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

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
.speech-bubble.water-alert {
  border-color: rgba(116,185,255,0.8) !important;
  background: rgba(236,246,255,0.97) !important;
  animation: water-border-pulse 1.5s ease-in-out infinite;
}
@keyframes water-border-pulse {
  0%,100% { box-shadow: 0 4px 16px rgba(0,0,0,0.15), 0 0 0 0 rgba(116,185,255,0.4); }
  50%      { box-shadow: 0 4px 16px rgba(0,0,0,0.15), 0 0 0 6px rgba(116,185,255,0); }
}

.water-pulse {
  animation: text-pop 1s ease-in-out infinite alternate;
}

.water-btn {
  margin-top: 8px;
  width: 100%;
  padding: 5px 0;
  background: linear-gradient(135deg, #74b9ff, #0984e3);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  transition: opacity 0.15s, transform 0.1s;
  display: block;
}
.water-btn:hover  { opacity: 0.9; transform: scale(1.03); }
.water-btn:active { transform: scale(0.97); }

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
  cursor: grab;
}
.fish-wrap:active { cursor: grabbing; }

/* 朝向：向左游时水平翻转（SVG 原图朝右）；徽章文字反向翻转避免镜像 */
.fish-wrap.face-left { transform: scaleX(-1); }
.fish-wrap.face-left .combo-badge { scale: -1 1; }

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

/* ── 拉屎 ── */
/* 使劲动画：抖动 + 轻微下压，约 800ms 一次 */
.fish-wrap.is-pooping .fish-svg {
  animation: poop-push 0.8s ease-in-out !important;
}
@keyframes poop-push {
  0%,100% { transform: translateY(0) scale(1); }
  20%     { transform: translateY(2px) scale(1.04, 0.94) rotate(-2deg); }
  40%     { transform: translateY(-2px) scale(0.98, 1.04) rotate(2deg); }
  60%     { transform: translateY(3px) scale(1.06, 0.92); }
  80%     { transform: translateY(-1px) scale(0.99, 1.02) rotate(-1deg); }
}

/* 屎：视口坐标绝对定位；padding 让点击热区略大于视觉尺寸 */
.poop {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 22px;
  padding: 8px;
  cursor: pointer;
  user-select: none;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25));
  transition: transform 0.15s ease;
}
.poop:hover { transform: translate(-50%, -50%) scale(1.15); }

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
