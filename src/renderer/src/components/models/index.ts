import type { Component } from 'vue'
import ClassicFishModel from './ClassicFishModel.vue'

/**
 * 模型组件静态注册表（ADR 0008）
 * 集中映射物种 modelId 到具体的 Vue 模型组件，编译期类型安全且切换零延迟。
 */
export const MODEL_COMPONENTS: Record<string, Component> = {
  'classic-fish': ClassicFishModel
}

export function resolveModelComponent(modelId: string): Component {
  return MODEL_COMPONENTS[modelId] ?? ClassicFishModel
}

