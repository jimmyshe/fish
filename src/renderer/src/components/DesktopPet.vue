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

    <!-- 宠物模型容器；点击/拖拽的命中区域由模型本体填充，透明 padding 一律穿透 -->
    <div
      class="fish-wrap"
      :class="[effectiveMoodClass, { 'is-hovered': isHovered, 'is-rainbow': isRainbow, 'face-left': facingLeft, 'is-pooping': isPooping }]"
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
import { computed } from 'vue'
import { usePetEngine } from '../composables/usePetEngine'
import { resolveModelComponent } from './models'

const {
  fishStyle,
  showBubble,
  displayMessage,
  displaySubMessage,
  particles,
  effectiveMoodClass,
  isSleeping,
  isHovered,
  isRainbow,
  isPooping,
  showWaterReminder,
  comboCount,
  facingLeft,
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
</script>

<style scoped src="../styles/desktopPet.css"></style>
