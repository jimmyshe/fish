<template>
  <svg
    ref="fishSvgRef"
    class="fish-svg classic-fish"
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

    <!-- 眼睛：受惊时瞪眼，睡着时闭眼，平时跟随鼠标（素材自理眼球几何，ADR 0008） -->
    <template v-if="isScared">
      <!-- 受惊：瞪大眼 + 竖形瞳孔 -->
      <ellipse :cx="eyeX" :cy="eyeY" rx="3" ry="5" fill="#1a1a2e" />
      <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="1.5" fill="white" />
    </template>
    <template v-else-if="isSleeping">
      <!-- 闭眼：横线 -->
      <path d="M 80 34 Q 84 37 88 34" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round" />
    </template>
    <template v-else>
      <!-- 正常：圆形瞳孔跟随鼠标 -->
      <circle :cx="eyeX" :cy="eyeY" r="5" fill="#1a1a2e" />
      <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="2" fill="white" />
    </template>

    <!-- 嘴巴（素材自理局部表情） -->
    <path v-if="isScared" d="M 98 46 Q 103 50 108 46" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" />
    <path v-else-if="isSleeping" d="M 99 45 Q 103 47 107 45" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round" />
    <path v-else-if="effectiveMood === 'happy'" d="M 98 42 Q 106 48 98 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" />
    <path v-else-if="effectiveMood === 'normal'" d="M 98 45 Q 106 45 98 45" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" />
    <path v-else-if="effectiveMood === 'nervous'" d="M 98 48 Q 103 44 108 48" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" />
    <path v-else d="M 98 50 Q 106 44 98 44" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" />

    <!-- 加班时的泪水 -->
    <g v-if="effectiveMood === 'sad' && !isScared && !isSleeping">
      <ellipse cx="88" cy="45" rx="2" ry="3" fill="#74b9ff" opacity="0.8" class="tear tear1" />
      <ellipse cx="86" cy="52" rx="1.5" ry="2.5" fill="#74b9ff" opacity="0.6" class="tear tear2" />
    </g>

    <!-- 快下班时的汗水 -->
    <g v-if="effectiveMood === 'nervous' && !isScared && !isSleeping">
      <ellipse cx="76" cy="25" rx="2" ry="3" fill="#a8d8f0" opacity="0.8" class="sweat" />
    </g>

    <!-- 受惊时的惊汗 -->
    <g v-if="isScared">
      <ellipse cx="72" cy="22" rx="2.5" ry="4" fill="#ff7675" opacity="0.9" class="sweat" />
      <ellipse cx="80" cy="18" rx="1.5" ry="3" fill="#ff7675" opacity="0.7" class="sweat" style="animation-delay:0.2s" />
    </g>

    <!-- 彩虹模式皇冠 -->
    <g v-if="isRainbow">
      <path d="M 70 14 L 74 6 L 78 14 L 82 6 L 86 14" stroke="#fdcb6e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- 鱼鳞纹理 -->
    <path d="M 55 30 Q 63 26 68 33" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none" />
    <path d="M 48 36 Q 56 32 61 39" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none" />
    <path d="M 55 44 Q 63 48 68 43" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none" />
  </svg>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CLASSIC_FISH_PALETTES, type PetModelProps } from '../../lib/species'

const props = defineProps<PetModelProps>()

const fishSvgRef = ref<SVGSVGElement | null>(null)

// 调色板映射（若未传则回退默认经典调色）
const activePalette = computed(() => props.palette ?? CLASSIC_FISH_PALETTES[0].colors)
const bodyColor = computed(() => activePalette.value[props.effectiveMood].body)
const tailColor = computed(() => activePalette.value[props.effectiveMood].tail)
const finColor = computed(() => activePalette.value[props.effectiveMood].fin)

// 眼睛跟随：组件内部私有几何计算（(84, 34) 锚点下放，ADR 0008）
const eyeOffset = computed(() => {
  const el = fishSvgRef.value
  if (!el || props.isSleeping) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const anchorX = props.facingLeft ? 120 - 84 : 84
  const eyeCX = rect.left + anchorX * (rect.width / 120)
  const eyeCY = rect.top + 34 * (rect.height / 80)
  const dx = props.mousePos.x - eyeCX
  const dy = props.mousePos.y - eyeCY
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { x: 0, y: 0 }
  const factor = Math.min(dist / 100, 1) * (props.isScared ? 1.5 : 2.5)
  const dir = props.facingLeft ? -1 : 1
  return { x: (dx / dist) * factor * dir, y: (dy / dist) * factor }
})

const eyeX = computed(() => (props.effectiveMood === 'sad' ? 83 : 85) + eyeOffset.value.x)
const eyeY = computed(() => 35 + eyeOffset.value.y)
const eyeHighlightX = computed(() => eyeX.value + 1)
const eyeHighlightY = computed(() => eyeY.value - 2)
</script>

<style scoped>
.fish-tail {
  transform-origin: 18px 40px;
  animation: wag 0.8s ease-in-out infinite;
}
@keyframes wag {
  0%, 100% { transform: skewY(5deg); }
  50% { transform: skewY(-5deg); }
}

.tear { animation: drip 1.5s ease-in infinite; }
.tear2 { animation-delay: 0.5s; }
.sweat { animation: sweat-drop 1s ease-in infinite; }
@keyframes drip {
  0% { opacity: 0.8; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(15px); }
}
@keyframes sweat-drop {
  0% { opacity: 0; transform: translateY(-5px); }
  50% { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(10px); }
}

polygon,
ellipse {
  transition: fill 0.3s ease;
}
</style>
