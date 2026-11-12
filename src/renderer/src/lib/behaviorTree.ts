/**
 * 极简强类型纯函数式行为树组合子
 * 专为小鱼高层行为决策仲裁设计（ADR 0007），零外部依赖
 */

export type NodeStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING'

export type BehaviorNode<TContext> = (context: TContext) => NodeStatus

/**
 * 优先选择器（Selector / Fallback）：
 * 自顶向下依次评估子节点，一旦子节点返回 SUCCESS 或 RUNNING，立即短路返回；
 * 若所有子节点均返回 FAILURE（或节点列表为空），则返回 FAILURE。
 */
export function prioritySelector<TContext>(nodes: BehaviorNode<TContext>[]): BehaviorNode<TContext> {
  return (context: TContext): NodeStatus => {
    for (const node of nodes) {
      const status = node(context)
      if (status === 'SUCCESS' || status === 'RUNNING') {
        return status
      }
    }
    return 'FAILURE'
  }
}

/**
 * 顺序器（Sequence）：
 * 依次评估子节点，一旦子节点返回 FAILURE 或 RUNNING，立即短路返回；
 * 仅当所有子节点均返回 SUCCESS（或节点列表为空）时，返回 SUCCESS。
 */
export function sequence<TContext>(nodes: BehaviorNode<TContext>[]): BehaviorNode<TContext> {
  return (context: TContext): NodeStatus => {
    for (const node of nodes) {
      const status = node(context)
      if (status === 'FAILURE' || status === 'RUNNING') {
        return status
      }
    }
    return 'SUCCESS'
  }
}

/**
 * 谓词条件叶节点：
 * 将纯函数判定 (context) => boolean 包装为行为树节点。
 * predicate 为 true 时返回 SUCCESS，否则返回 FAILURE。
 */
export function condition<TContext>(predicate: (context: TContext) => boolean): BehaviorNode<TContext> {
  return (context: TContext): NodeStatus => {
    return predicate(context) ? 'SUCCESS' : 'FAILURE'
  }
}

/**
 * 动作执行叶节点：
 * 执行带有副作用或状态更新的逻辑并返回 NodeStatus。
 */
export function action<TContext>(fn: (context: TContext) => NodeStatus): BehaviorNode<TContext> {
  return (context: TContext): NodeStatus => {
    return fn(context)
  }
}
