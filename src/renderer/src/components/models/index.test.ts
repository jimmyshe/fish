import { describe, expect, it, vi } from 'vitest'

const { mockClassicFish, mockOrca } = vi.hoisted(() => ({
  mockClassicFish: { name: 'ClassicFishModel' },
  mockOrca: { name: 'OrcaModel' }
}))

vi.mock('./ClassicFishModel.vue', () => ({ default: mockClassicFish }))
vi.mock('./OrcaModel.vue', () => ({ default: mockOrca }))

import { MODEL_COMPONENTS, resolveModelComponent } from './index'

describe('MODEL_COMPONENTS 模型组件注册表 (ADR 0008)', () => {
  it('已注册经典小鱼与虎鲸模型组件', () => {
    expect(MODEL_COMPONENTS['classic-fish']).toBe(mockClassicFish)
    expect(MODEL_COMPONENTS['orca']).toBe(mockOrca)
  })

  it('resolveModelComponent 按 modelId 命中并在未知时回退默认模型', () => {
    expect(resolveModelComponent('orca')).toBe(mockOrca)
    expect(resolveModelComponent('classic-fish')).toBe(mockClassicFish)
    expect(resolveModelComponent('unknown-species')).toBe(mockClassicFish)
  })
})
