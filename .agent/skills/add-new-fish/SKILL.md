---
name: add-new-fish
description: Guides adding a new fish or pet species model to Fish Pet. Use when the user asks to add, create, implement, or integrate a new fish, animal, or pet species model/skin.
---

# 添加新宠物物种（Fish / Pet Species）指南

本技能指导开发者如何为「摸鱼鱼」快速新增一条鱼或新的桌面宠物物种。
架构严格遵循 **ADR 0008（物种与调色正交解耦及组件化模型自理表现）**。

---

## 核心架构原则

1. **物种与调色正交**：
   - **物种 (Species)**：决定宠物的生理/解剖形态与模型骨架，映射一个 Vue 模型组件。
   - **调色方案 (Palette)**：该物种下支持的具名配色（6 种心情 × 各部位色值）。如果该物种是固定画风/贴图，可为空列表（自动使用专属原色）。
2. **责任严格划分**：
   - **外层壳负责**：视口穿透、拖拽、对话气泡、飘浮粒子、拉屎机制、连击徽章。
   - **素材模型自理**：SVG 结构、眼球跟随与眨眼、嘴型变换、汗泪表情贴合、骨骼游动动画（如摆尾/喷水）、专属彩蛋装饰（如皇冠）。
3. **单向 Props 契约 (`PetModelProps`)**：
   - 模型组件纯声明式渲染，仅只读消费来自外层传入的 Props，不向上触发业务事件。

---

## 标准开发步骤

### 步骤 1：创建模型组件 `src/renderer/src/components/models/<ModelName>.vue`

在 `src/renderer/src/components/models/` 目录下新建单文件组件（例如 `SharkModel.vue`）。

组件模板规范：
```vue
<template>
  <svg
    ref="svgRef"
    class="fish-svg custom-pet"
    viewBox="0 0 120 80"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- 1. 骨骼与肢体（支持私有摆动动画） -->
    <g class="pet-tail">
      <polygon points="18,40 0,20 0,60" :fill="tailColor" />
    </g>

    <!-- 2. 身体主干 -->
    <ellipse cx="60" cy="40" rx="40" ry="24" :fill="bodyColor" />

    <!-- 3. 眼球跟随（素材私有自理几何锚点） -->
    <circle cx="84" cy="34" r="8" fill="white" />
    <template v-if="isScared">
      <ellipse :cx="eyeX" :cy="eyeY" rx="3" ry="5" fill="#1a1a2e" />
    </template>
    <template v-else-if="isSleeping">
      <path d="M 80 34 Q 84 37 88 34" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle :cx="eyeX" :cy="eyeY" r="5" fill="#1a1a2e" />
    </template>

    <!-- 4. 局部心情表情（嘴巴、汗水、泪水） -->
    <path v-if="effectiveMood === 'happy'" d="M 98 42 Q 106 48 98 50" stroke="#1a1a2e" stroke-width="2" fill="none" />
    <path v-else d="M 98 45 Q 106 45 98 45" stroke="#1a1a2e" stroke-width="2" fill="none" />

    <!-- 5. 专属彩蛋（彩虹模式下的装饰） -->
    <g v-if="isRainbow">
      <!-- 专属皇冠或光圈 -->
    </g>
  </svg>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PetModelProps } from '../../lib/species'

const props = defineProps<PetModelProps>()

const svgRef = ref<SVGSVGElement | null>(null)

// 颜色提取：若支持换色读 palette，若固定画风直接写死色值
const bodyColor = computed(() => props.palette?.[props.effectiveMood]?.body ?? '#00d2d3')
const tailColor = computed(() => props.palette?.[props.effectiveMood]?.tail ?? '#01a3a4')

// 眼球跟随几何计算（以素材自身的眼睛中心为锚点，例如 84, 34）
const eyeOffset = computed(() => {
  const el = svgRef.value
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

const eyeX = computed(() => 85 + eyeOffset.value.x)
const eyeY = computed(() => 35 + eyeOffset.value.y)
</script>

<style scoped>
/* 素材私有动画，不污染其他模型 */
.pet-tail {
  transform-origin: 18px 40px;
  animation: pet-wag 0.8s ease-in-out infinite;
}
@keyframes pet-wag {
  0%, 100% { transform: skewY(5deg); }
  50% { transform: skewY(-5deg); }
}
polygon, ellipse {
  transition: fill 0.3s ease;
}
</style>
```

---

### 步骤 2：在组件注册表登记模型

在 `src/renderer/src/components/models/index.ts` 中引入并映射：

```ts
import ClassicFishModel from './ClassicFishModel.vue'
import SharkModel from './SharkModel.vue' // 1. 引入新组件

export const MODEL_COMPONENTS: Record<string, Component> = {
  'classic-fish': ClassicFishModel,
  'shark': SharkModel // 2. 映射 modelId
}
```

---

### 步骤 3：在物种注册表声明新物种

在 `src/renderer/src/lib/species.ts` 的 `SPECIES_LIST` 数组中追加新物种：

#### 场景 A：该物种为固定画风（不提供换色）
```ts
{
  id: 'shark',
  name: '鲨鱼',
  icon: '🦈',
  modelId: 'shark',
  palettes: [], // 空数组：设置面板会自动呈现专属原色标签
  defaultPaletteId: 'default',
  previewColor: '#00d2d3' // 预览圆点代表色
}
```

#### 场景 B：该物种支持专属调色板
```ts
export const SHARK_PALETTES: readonly Palette[] = [
  {
    id: 'deep-blue',
    name: '深海蓝',
    previewColor: '#0984e3',
    colors: { ... } // 6 种有效心情的色值表
  }
]

// 在 SPECIES_LIST 中声明：
{
  id: 'shark',
  name: '鲨鱼',
  icon: '🦈',
  modelId: 'shark',
  palettes: SHARK_PALETTES,
  defaultPaletteId: 'deep-blue',
  previewColor: '#0984e3'
}
```

---

### 步骤 4：验证与测试

1. **类型与定时器检查**：
   运行 `npm run check`，确保 TypeScript 类型推导完全通过。
2. **补充物种测试**：
   在 `src/renderer/src/lib/species.test.ts` 中，为新物种的 id 与调色板补充验证。
3. **功能验证**：
   启动 `npm run dev`，打开主面板「设置」Tab，即可在第一层切换到新物种，第二层联动切换配色，屏幕上的宠物即时变形生效！

