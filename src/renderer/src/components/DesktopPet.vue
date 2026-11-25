<template>
  <!-- 游乐场：覆盖整个主屏的透明层；鱼是其中的定位元素 -->
  <div class="playground" :style="eatingTiming">
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
          <div v-if="displayMessage" class="bubble-text" :class="{ 'interact-flash': !!interactMessage }">
            {{ displayMessage }}
          </div>
          <div class="bubble-subtext" v-if="displaySubMessage">{{ displaySubMessage }}</div>
          <div
            v-if="displaySalaryBadge"
            class="salary-badge"
            :class="{ 'is-overtime': salaryInfo.status === 'overtime' }"
          >
            {{ displaySalaryBadge }}
          </div>
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

    <!-- 宠物模型容器；点击/拖拽的命中区域由模型本体填充，透明 padding 一律穿透 -->
    <div
      ref="fishWrap"
      class="fish-wrap"
      :class="[effectiveMoodClass, { 'is-hovered': isHovered, 'is-rainbow': isRainbow, 'face-left': facingLeft, 'is-pooping': isPooping, 'is-eating': eatingPhase }]"
      @mousedown.left="startDrag"
      @mouseenter="onFishHover"
      @mouseleave="onFishLeave"
    >
      <!-- 动态物种模型渲染（ADR 0008） -->
      <component
        :is="activeModel"
        v-bind="modelProps"
      />

      <!-- 连击数指示器 -->
      <div class="combo-badge" v-if="comboCount >= 2">
        {{ comboCount }}x COMBO!
      </div>
    </div>
    </div>

    <span
      v-if="fishFood"
      class="fish-food"
      :class="{ 'is-being-eaten': eatingPhase === 'biting' && mouthPosition }"
      :style="fishFoodStyle"
      aria-hidden="true"
    ></span>

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
import { computed, ref, watch } from 'vue'
import { usePetEngine } from '../composables/usePetEngine'
import { BITE_MS, CHEW_MS } from '../lib/eating'
import type { Vec } from '../lib/fishMotion'
import { resolveModelComponent } from './models'

const {
  fishStyle,
  showBubble,
  displayMessage,
  displaySubMessage,
  salaryInfo,
  displaySalaryBadge,
  particles,
  effectiveMoodClass,
  isSleeping,
  isHovered,
  isRainbow,
  isPooping,
  showWaterReminder,
  comboCount,
  facingLeft,
  fishFood,
  eatingPhase,
  poops,
  interactMessage,
  currentSpecies,
  modelProps,
  startDrag,
  onFishHover,
  onFishLeave,
  confirmWaterDrank,
  scoopPoop
} = usePetEngine()

const activeModel = computed(() => resolveModelComponent(currentSpecies.value.modelId))
const eatingTiming = { '--bite-duration': `${BITE_MS}ms`, '--chew-duration': `${CHEW_MS}ms` }
const fishWrap = ref<HTMLElement | null>(null)
const mouthPosition = ref<Vec | null>(null)

watch([eatingPhase, activeModel], ([phase]) => {
  // 等当前模型绘制张嘴的形状后再取位置，也适用于翻转朝向的小鱼。
  const mouth = phase === 'biting'
    ? fishWrap.value?.querySelector('[data-fish-mouth]')?.getBoundingClientRect()
    : undefined
  mouthPosition.value = mouth ? { x: mouth.x + mouth.width / 2, y: mouth.y + mouth.height / 2 } : null
}, { flush: 'post' })

const fishFoodStyle = computed(() => {
  const food = fishFood.value
  if (!food) return undefined
  const mouth = mouthPosition.value ?? food
  return {
    left: `${food.x}px`,
    top: `${food.y}px`,
    '--bite-x': `${mouth.x - food.x}px`,
    '--bite-y': `${mouth.y - food.y}px`
  }
})
</script>

<style scoped src="../styles/desktopPet.css"></style>
