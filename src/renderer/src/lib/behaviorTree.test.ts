import { describe, it, expect, vi } from 'vitest'
import {
  type NodeStatus,
  type BehaviorNode,
  prioritySelector,
  sequence,
  condition,
  action
} from './behaviorTree'

describe('behaviorTree', () => {
  describe('condition', () => {
    it('returns SUCCESS when predicate evaluates to true', () => {
      const node = condition((ctx: { count: number }) => ctx.count > 0)
      expect(node({ count: 1 })).toBe('SUCCESS')
    })

    it('returns FAILURE when predicate evaluates to false', () => {
      const node = condition((ctx: { count: number }) => ctx.count > 0)
      expect(node({ count: 0 })).toBe('FAILURE')
    })
  })

  describe('action', () => {
    it('executes fn with context and returns returned NodeStatus', () => {
      const fn = vi.fn((ctx: { log: string[] }): NodeStatus => {
        ctx.log.push('acted')
        return 'SUCCESS'
      })
      const node = action(fn)
      const ctx = { log: [] as string[] }

      const status = node(ctx)
      expect(status).toBe('SUCCESS')
      expect(ctx.log).toEqual(['acted'])
      expect(fn).toHaveBeenCalledWith(ctx)
    })

    it('can return RUNNING and FAILURE statuses', () => {
      expect(action(() => 'RUNNING')({})).toBe('RUNNING')
      expect(action(() => 'FAILURE')({})).toBe('FAILURE')
    })
  })

  describe('prioritySelector', () => {
    it('returns FAILURE when nodes array is empty', () => {
      const selector = prioritySelector([])
      expect(selector({})).toBe('FAILURE')
    })

    it('returns SUCCESS and short-circuits on first SUCCESS node', () => {
      const node1 = vi.fn((): NodeStatus => 'FAILURE')
      const node2 = vi.fn((): NodeStatus => 'SUCCESS')
      const node3 = vi.fn((): NodeStatus => 'SUCCESS')

      const selector = prioritySelector([node1, node2, node3])
      const result = selector({})

      expect(result).toBe('SUCCESS')
      expect(node1).toHaveBeenCalledTimes(1)
      expect(node2).toHaveBeenCalledTimes(1)
      expect(node3).not.toHaveBeenCalled()
    })

    it('returns RUNNING and short-circuits on first RUNNING node', () => {
      const node1 = vi.fn((): NodeStatus => 'FAILURE')
      const node2 = vi.fn((): NodeStatus => 'RUNNING')
      const node3 = vi.fn((): NodeStatus => 'SUCCESS')

      const selector = prioritySelector([node1, node2, node3])
      const result = selector({})

      expect(result).toBe('RUNNING')
      expect(node1).toHaveBeenCalledTimes(1)
      expect(node2).toHaveBeenCalledTimes(1)
      expect(node3).not.toHaveBeenCalled()
    })

    it('returns FAILURE when all nodes return FAILURE', () => {
      const node1 = vi.fn((): NodeStatus => 'FAILURE')
      const node2 = vi.fn((): NodeStatus => 'FAILURE')

      const selector = prioritySelector([node1, node2])
      const result = selector({})

      expect(result).toBe('FAILURE')
      expect(node1).toHaveBeenCalledTimes(1)
      expect(node2).toHaveBeenCalledTimes(1)
    })

    it('propagates typed context to child nodes', () => {
      interface Context {
        user: string
      }
      const node = vi.fn((ctx: Context): NodeStatus => {
        return ctx.user === 'alice' ? 'SUCCESS' : 'FAILURE'
      })
      const selector = prioritySelector<Context>([node])

      expect(selector({ user: 'alice' })).toBe('SUCCESS')
      expect(selector({ user: 'bob' })).toBe('FAILURE')
    })
  })

  describe('sequence', () => {
    it('returns SUCCESS when nodes array is empty', () => {
      const seq = sequence([])
      expect(seq({})).toBe('SUCCESS')
    })

    it('returns SUCCESS when all child nodes return SUCCESS', () => {
      const node1 = vi.fn((): NodeStatus => 'SUCCESS')
      const node2 = vi.fn((): NodeStatus => 'SUCCESS')

      const seq = sequence([node1, node2])
      expect(seq({})).toBe('SUCCESS')
      expect(node1).toHaveBeenCalledTimes(1)
      expect(node2).toHaveBeenCalledTimes(1)
    })

    it('returns FAILURE and short-circuits on first FAILURE node', () => {
      const node1 = vi.fn((): NodeStatus => 'SUCCESS')
      const node2 = vi.fn((): NodeStatus => 'FAILURE')
      const node3 = vi.fn((): NodeStatus => 'SUCCESS')

      const seq = sequence([node1, node2, node3])
      const result = seq({})

      expect(result).toBe('FAILURE')
      expect(node1).toHaveBeenCalledTimes(1)
      expect(node2).toHaveBeenCalledTimes(1)
      expect(node3).not.toHaveBeenCalled()
    })

    it('returns RUNNING and short-circuits on first RUNNING node', () => {
      const node1 = vi.fn((): NodeStatus => 'SUCCESS')
      const node2 = vi.fn((): NodeStatus => 'RUNNING')
      const node3 = vi.fn((): NodeStatus => 'SUCCESS')

      const seq = sequence([node1, node2, node3])
      const result = seq({})

      expect(result).toBe('RUNNING')
      expect(node1).toHaveBeenCalledTimes(1)
      expect(node2).toHaveBeenCalledTimes(1)
      expect(node3).not.toHaveBeenCalled()
    })

    it('propagates typed context to child nodes', () => {
      interface Context {
        score: number
      }
      const node1 = vi.fn((ctx: Context): NodeStatus => (ctx.score > 0 ? 'SUCCESS' : 'FAILURE'))
      const node2 = vi.fn((ctx: Context): NodeStatus => (ctx.score > 10 ? 'SUCCESS' : 'FAILURE'))
      const seq = sequence<Context>([node1, node2])

      expect(seq({ score: -1 })).toBe('FAILURE')
      expect(node2).not.toHaveBeenCalled()
      expect(seq({ score: 15 })).toBe('SUCCESS')
      expect(node2).toHaveBeenCalledWith({ score: 15 })
    })
  })

  describe('composition & state propagation', () => {
    interface PetBlackboard {
      isDragging: boolean
      isSleeping: boolean
      energy: number
      actionTaken?: string
    }

    it('composes prioritySelector and sequence to model realistic pet decision logic', () => {
      const tree: BehaviorNode<PetBlackboard> = prioritySelector([
        // Branch 1: Dragging
        sequence([
          condition((ctx) => ctx.isDragging),
          action((ctx) => {
            ctx.actionTaken = 'DRAGGING'
            return 'SUCCESS'
          })
        ]),
        // Branch 2: Sleep when low energy or already sleeping
        sequence([
          condition((ctx) => ctx.isSleeping || ctx.energy < 20),
          action((ctx) => {
            ctx.actionTaken = 'SLEEPING'
            return 'RUNNING'
          })
        ]),
        // Branch 3: Default fallback Roaming
        action((ctx) => {
          ctx.actionTaken = 'ROAMING'
          return 'SUCCESS'
        })
      ])

      // Case 1: Dragging preempts everything
      const ctx1: PetBlackboard = { isDragging: true, isSleeping: true, energy: 5 }
      expect(tree(ctx1)).toBe('SUCCESS')
      expect(ctx1.actionTaken).toBe('DRAGGING')

      // Case 2: Sleeping when energy low
      const ctx2: PetBlackboard = { isDragging: false, isSleeping: false, energy: 10 }
      expect(tree(ctx2)).toBe('RUNNING')
      expect(ctx2.actionTaken).toBe('SLEEPING')

      // Case 3: Roaming default
      const ctx3: PetBlackboard = { isDragging: false, isSleeping: false, energy: 80 }
      expect(tree(ctx3)).toBe('SUCCESS')
      expect(ctx3.actionTaken).toBe('ROAMING')
    })
  })
})
