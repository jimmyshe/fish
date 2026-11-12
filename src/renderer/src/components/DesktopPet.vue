<template>
  <!-- 游乐场：覆盖整个主屏的透明层；鱼是其中的定位元素 -->
  <div class="playground">
    <div
      class="pet-wrapper"
      :style="fishStyle"
    >

    <!-- 对话气泡；下班提示关闭时不再常驻，只在互动消息 / 睡眠 / 喝水提醒时出现 -->
    <div v-if="showBubble" class="bubble-wrap" :class="{ 'sleeping-bubble': isSleeping && !showWaterReminder }">
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

    <!-- 小鱼 SVG；点击/拖拽的命中区域只有鱼本体，透明 padding 一律穿透 -->
    <div
      class="fish-wrap"
      :class="[effectiveMoodClass, { 'is-hovered': isHovered, 'is-rainbow': isRainbow, 'face-left': facingLeft, 'is-pooping': isPooping }]"
      @mousedown.left="startDrag"
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

        <!-- 眼睛：受惊时瞪眼，睡着时闭眼，平时跟随鼠标 -->
        <template v-if="isScared">
          <!-- 受惊：瞪大眼 + 竖形瞳孔 -->
          <ellipse :cx="eyeX" :cy="eyeY" rx="3" ry="5" fill="#1a1a2e" />
          <circle :cx="eyeHighlightX" :cy="eyeHighlightY" r="1.5" fill="white" />
        </template>
        <template v-else-if="isSleeping">
          <!-- 闭眼：横线 -->
          <path d="M 80 34 Q 84 37 88 34" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
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

  </div>
</template>

<script setup lang="ts">
import { usePetEngine } from '../composables/usePetEngine'

const {
  fishStyle,
  showBubble,
  displayMessage,
  displaySubMessage,
  particles,
  effectiveMood,
  effectiveMoodClass,
  bodyColor,
  tailColor,
  finColor,
  eyeX,
  eyeY,
  eyeHighlightX,
  eyeHighlightY,
  isSleeping,
  isScared,
  isHovered,
  isRainbow,
  isPooping,
  showWaterReminder,
  comboCount,
  facingLeft,
  poops,
  fishSvgRef,
  interactMessage,
  startDrag,
  onFishHover,
  onFishLeave,
  confirmWaterDrank,
  scoopPoop
} = usePetEngine()
</script>

<style scoped src="../styles/desktopPet.css"></style>
