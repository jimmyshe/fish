<template>
  <svg
    ref="svgRef"
    class="fish-svg orca"
    viewBox="0 0 120 80"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- 1. 水平尾叶（鲸类上下拍打） -->
    <g class="orca-fluke">
      <path
        d="M 22 46 Q 10 38 4 36 Q 10 44 16 46 Q 9 50 5 57 Q 14 54 22 49 Z"
        fill="#1e272e"
      />
      <path
        d="M 20 46 Q 12 40 7 38 Q 12 44 17 46 Z"
        fill="rgba(255,255,255,0.12)"
      />
    </g>

    <!-- 2. 高耸镰刀形背鳍 -->
    <path
      d="M 45 31 Q 44 17 49 11 Q 53 19 59 30 Z"
      fill="#1e272e"
    />
    <path
      d="M 47 29 Q 47 19 50 14 Q 52 21 55 29 Z"
      fill="rgba(255,255,255,0.08)"
    />

    <!-- 3. 虎鲸躯干（炭黑主身） -->
    <path
      d="M 20 46
         Q 36 29 66 27
         Q 94 26 108 42
         Q 113 48 106 53
         Q 88 63 58 62
         Q 34 60 20 49 Z"
      fill="#1e272e"
    />

    <!-- 背部柔和光泽 -->
    <path
      d="M 56 30 Q 78 28 94 35 Q 78 33 56 34 Z"
      fill="rgba(255,255,255,0.12)"
    />

    <!-- 4. 标志性特征花纹：灰白鞍斑 + 奶白下颌腹部 + 眼后白斑 -->
    <!-- 背鳍后浅灰鞍斑 -->
    <path
      d="M 42 32 Q 50 29 56 33 Q 51 39 41 37 Z"
      fill="#7f8fa6"
      opacity="0.72"
    />

    <!-- 奶白下颌与腹部 -->
    <path
      d="M 106 51
         Q 95 57 76 58
         Q 56 61 36 56
         Q 28 53 25 50
         Q 38 52 50 49
         Q 60 55 78 52
         Q 94 52 106 49 Z"
      fill="#f5f6fa"
    />

    <!-- 眼后标志性白色眼斑 -->
    <ellipse
      cx="79"
      cy="37"
      rx="8"
      ry="4"
      transform="rotate(-14, 79, 37)"
      fill="#f5f6fa"
    />

    <!-- 5. 胸鳍（宽阔桨状微划） -->
    <g class="orca-flipper">
      <path
        d="M 65 54 Q 60 66 52 69 Q 53 60 58 53 Z"
        fill="#1e272e"
      />
      <path
        d="M 63 55 Q 59 63 54 66 Q 55 60 59 55 Z"
        fill="rgba(255,255,255,0.1)"
      />
    </g>

    <!-- 6. Q版大眼与鼠标跟随（素材自理眼球几何，ADR 0008） -->
    <circle cx="93" cy="42" r="6.2" fill="#f5f6fa" />
    <template v-if="isScared">
      <ellipse :cx="eyeX" :cy="eyeY" rx="2.2" ry="4.2" fill="#1a1a2e" />
      <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="1.2" fill="white" />
    </template>
    <template v-else-if="isSleeping">
      <path
        d="M 89 42 Q 93 45 97 42"
        stroke="#1a1a2e"
        stroke-width="2.2"
        fill="none"
        stroke-linecap="round"
      />
    </template>
    <template v-else>
      <circle :cx="eyeX" :cy="eyeY" r="3.8" fill="#1a1a2e" />
      <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="1.5" fill="white" />
    </template>

    <!-- 开心腮红 -->
    <ellipse
      v-if="effectiveMood === 'happy' && !isScared && !isSleeping"
      cx="91"
      cy="50"
      rx="3.4"
      ry="1.8"
      fill="#ff7675"
      opacity="0.55"
    />

    <!-- 7. 嘴巴局部表情 -->
    <path
      v-if="isScared"
      d="M 101 49 Q 104 53 107 49"
      stroke="#1a1a2e"
      stroke-width="1.8"
      fill="none"
      stroke-linecap="round"
    />
    <path
      v-else-if="isSleeping"
      d="M 101 50 Q 104 51.5 107 50"
      stroke="#1a1a2e"
      stroke-width="1.5"
      fill="none"
      stroke-linecap="round"
    />
    <path
      v-else-if="effectiveMood === 'happy'"
      d="M 99 48 Q 104 53 108 49"
      stroke="#1a1a2e"
      stroke-width="1.8"
      fill="none"
      stroke-linecap="round"
    />
    <path
      v-else-if="effectiveMood === 'normal'"
      d="M 100 50 Q 104 52 108 50"
      stroke="#1a1a2e"
      stroke-width="1.8"
      fill="none"
      stroke-linecap="round"
    />
    <path
      v-else-if="effectiveMood === 'nervous'"
      d="M 100 51 Q 102.5 48.5 105 51 Q 107 52.5 108 50"
      stroke="#1a1a2e"
      stroke-width="1.8"
      fill="none"
      stroke-linecap="round"
    />
    <path
      v-else
      d="M 100 52 Q 104 48 108 51"
      stroke="#1a1a2e"
      stroke-width="1.8"
      fill="none"
      stroke-linecap="round"
    />

    <!-- 8. 泪水与汗水 -->
    <g v-if="effectiveMood === 'sad' && !isScared && !isSleeping">
      <ellipse cx="95" cy="50" rx="1.6" ry="2.6" fill="#74b9ff" opacity="0.85" class="tear" />
      <ellipse cx="93" cy="56" rx="1.2" ry="2" fill="#74b9ff" opacity="0.65" class="tear tear2" />
    </g>

    <g v-if="effectiveMood === 'nervous' && !isScared && !isSleeping">
      <ellipse cx="86" cy="31" rx="1.8" ry="2.8" fill="#a8d8f0" opacity="0.85" class="sweat" />
    </g>

    <g v-if="isScared">
      <ellipse cx="83" cy="29" rx="2.1" ry="3.4" fill="#ff7675" opacity="0.9" class="sweat" />
      <ellipse cx="89" cy="25" rx="1.4" ry="2.5" fill="#ff7675" opacity="0.7" class="sweat sweat2" />
    </g>

    <!-- 9. 头顶气孔与喷水动画（预留 y=4..25 空间防裁切） -->
    <ellipse cx="70" cy="27.2" rx="2.4" ry="0.9" fill="#0f1419" />

    <!-- 彩虹模式：彩虹水柱 + 金色小皇冠 -->
    <g v-if="isRainbow" class="orca-spout spout-rainbow">
      <path d="M 70 26 Q 66 15 60 11" stroke="#ff7675" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M 70 26 Q 70 13 70 6" stroke="#fdcb6e" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M 70 26 Q 74 15 80 11" stroke="#74b9ff" stroke-width="2" fill="none" stroke-linecap="round" />
      <circle cx="59" cy="10" r="1.5" fill="#fd79a8" />
      <circle cx="70" cy="5" r="1.6" fill="#55efc4" />
      <circle cx="81" cy="10" r="1.5" fill="#a29bfe" />
    </g>
    <!-- 开心模式：欢快双股小水花 -->
    <g v-else-if="effectiveMood === 'happy' && !isScared && !isSleeping" class="orca-spout spout-happy">
      <path d="M 70 26 Q 67 16 62 12" stroke="#74b9ff" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M 70 26 Q 73 16 78 12" stroke="#a8d8f0" stroke-width="2" fill="none" stroke-linecap="round" />
      <circle cx="61" cy="10" r="1.4" fill="#74b9ff" />
      <circle cx="79" cy="10" r="1.4" fill="#a8d8f0" />
      <circle cx="70" cy="11" r="1.2" fill="#dff9fb" />
    </g>
    <!-- 常态 / 紧张 / 难过：轻柔呼吸小水雾 -->
    <g v-else-if="!isScared && !isSleeping" class="orca-spout spout-gentle">
      <path d="M 70 26 Q 68 19 65 16" stroke="#a8d8f0" stroke-width="1.5" fill="none" stroke-linecap="round" />
      <path d="M 70 26 Q 72 19 75 16" stroke="#dff9fb" stroke-width="1.5" fill="none" stroke-linecap="round" />
      <circle cx="64" cy="14" r="1.1" fill="#dff9fb" />
      <circle cx="76" cy="14" r="1.1" fill="#a8d8f0" />
    </g>

    <!-- 彩虹模式金色小皇冠（位于额头，避开气孔水柱） -->
    <g v-if="isRainbow" transform="rotate(14, 90, 27)">
      <path
        d="M 83 27 L 85 19 L 89 24 L 92 18 L 95 25 L 98 20 L 97 27 Z"
        fill="#fdcb6e"
        stroke="#e17055"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PetModelProps } from '../../lib/species'

const props = defineProps<PetModelProps>()

const svgRef = ref<SVGSVGElement | null>(null)

// 眼球跟随几何计算：以虎鲸眼睛中心 (93, 42) 为锚点（ADR 0008）
const eyeOffset = computed(() => {
  const el = svgRef.value
  if (!el || props.isSleeping) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const anchorX = props.facingLeft ? 120 - 93 : 93
  const eyeCX = rect.left + anchorX * (rect.width / 120)
  const eyeCY = rect.top + 42 * (rect.height / 80)
  const dx = props.mousePos.x - eyeCX
  const dy = props.mousePos.y - eyeCY
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { x: 0, y: 0 }
  const factor = Math.min(dist / 100, 1) * (props.isScared ? 1.2 : 1.8)
  const dir = props.facingLeft ? -1 : 1
  return { x: (dx / dist) * factor * dir, y: (dy / dist) * factor }
})

const eyeX = computed(() => (props.effectiveMood === 'sad' ? 92.2 : 93) + eyeOffset.value.x)
const eyeY = computed(() => 42 + eyeOffset.value.y)
const eyeHighlightX = computed(() => eyeX.value + 0.9)
const eyeHighlightY = computed(() => eyeY.value - 1.4)
</script>

<style scoped>
/* 水平尾叶上下拍打 */
.orca-fluke {
  transform-origin: 20px 47px;
  animation: fluke-beat 1.1s ease-in-out infinite;
}
@keyframes fluke-beat {
  0%, 100% { transform: rotate(-6deg) translateY(-1px); }
  50% { transform: rotate(7deg) translateY(1.5px); }
}

/* 胸鳍轻柔划水 */
.orca-flipper {
  transform-origin: 62px 54px;
  animation: flipper-paddle 1.6s ease-in-out infinite;
}
@keyframes flipper-paddle {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(7deg); }
}

/* 气孔喷水动画（纯 CSS，遵守 check:timers 规范） */
.orca-spout {
  transform-origin: 70px 26px;
}
.spout-gentle {
  animation: spout-breath 3.6s ease-out infinite;
}
.spout-happy {
  animation: spout-burst 1.4s ease-out infinite;
}
.spout-rainbow {
  animation: spout-burst 0.9s ease-out infinite;
}
@keyframes spout-breath {
  0%, 25% { opacity: 0; transform: translateY(3px) scale(0.5); }
  45% { opacity: 0.7; transform: translateY(0) scale(1); }
  75%, 100% { opacity: 0; transform: translateY(-4px) scale(1.1); }
}
@keyframes spout-burst {
  0% { opacity: 0; transform: translateY(4px) scale(0.4); }
  35% { opacity: 0.95; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-5px) scale(1.15); }
}

.tear { animation: drip 1.5s ease-in infinite; }
.tear2 { animation-delay: 0.5s; }
.sweat { animation: sweat-drop 1s ease-in infinite; }
.sweat2 { animation-delay: 0.2s; }
@keyframes drip {
  0% { opacity: 0.85; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(12px); }
}
@keyframes sweat-drop {
  0% { opacity: 0; transform: translateY(-4px); }
  50% { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(9px); }
}
</style>

