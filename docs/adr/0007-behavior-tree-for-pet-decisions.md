# 行为决策：轻量级函数式行为树驱动宠物高层仲裁

Status: accepted

随着受惊逃窜、睡眠覆盖、使劲排泄、避鼠与漫游等多重交互的叠加，`DesktopPet.vue` 中充斥着大量的布尔状态标志（`isSleeping`、`isScared`、`isPooping`、`isHovered` 等）与交叉 watcher，状态转移线错综复杂且缺乏单元测试保障。
我们将宠物的高层决策机制重构为**基于轻量函数式组合子的行为树（Behavior Tree）**：
1. **纯行为仲裁（Decision Arbiter）**：行为树仅负责高层目标决策（拖拽 > 受惊 > 睡眠 > 排泄使劲 > 漫游）与表现层快照输出（`BehaviorSnapshot`），底层的 Steering 连续物理向量积分（`fishMotion.ts`）与时间推进（`PetScheduler`）与树结构解耦。
2. **事件与调度驱动（Event & Timer Driven）**：树求值不采用 60FPS 逐帧空转轮询，而是在鼠标交互输入（移动/按住/点击）或调度器定时器到期时响应式触发 Tick，保持近乎零的静置 CPU 占用。
3. **极简内置实现**：不引入重量级第三方游戏 AI 库，在 `src/renderer/src/lib/behaviorTree.ts` 中以约 60 行 TypeScript 实现强类型的 `PrioritySelector`、`Sequence`、`Condition` 与 `Action` 组合子。
4. **正交修饰层分离**：连击彩蛋（Combo Rainbow）与喝水提醒（Water Reminder）作为黑板上的独立修饰层运行，不参与根选择器的物理互斥。

## Considered Options

- **传统有限状态机（FSM）**：状态转换必须在每个状态内显式列出所有可能的跳出条件（例如漫游到受惊、漫游到睡眠、睡眠中被受惊打断、睡眠中梦游排泄等），随着行为增加会出现状态爆炸与转移蜘蛛网；而行为树的 `PrioritySelector` 天然以自顶向下的层级表达严格优先级抢占，新增行为只需在树中插入一个分支。
- **沿用分散布尔标志（Boolean Flags in Composable）**：保留现状只做 composable 封装虽然改动最小，但依然无法消除“在 A 状态里检查 !B && !C”的嵌套地狱，深层次的组合边界（如受惊能否打断使劲、睡眠时拉屎如何绕过使劲）依然脆弱。
- **引入第三方大型行为树库（如 Yuka / behavior-tree-js）**：第三方库多采用面向对象类继承、复杂的黑板反射和每帧轮询机制，带来不必要的包体积、动态类型与学习成本；小鱼的行为层级清晰，纯函数式组合子即可提供完备的声明式表达能力与 100% 强类型推导。

## Consequences

- 行为决策彻底成为可独立测试的深模块，支持在 Vitest 环境下传入模拟黑板上下文进行纯无头单元测试，无需挂载 Vue DOM 或 Electron 窗口。
- `DesktopPet.vue` 的职责进一步收敛为纯视觉展现，消费 `BehaviorSnapshot` 快照并渲染 SVG/CSS。
- 根选择器严格锁定 5 级优先级：`Dragging > ScaredDash > Sleeping > PoopStraining > Roaming`。
- `GLOSSARY.md` 补充「行为树决策」条目（已同步更新）。
