import { onMounted, onUnmounted, ref } from 'vue'

export interface UseDragOptions {
  /** 按下与抬起位移小于阈值时触发（点击而非拖拽） */
  onTap?: () => void
  /** 每次鼠标移动时回调（组件用于鼠标追踪、受惊检测、睡眠重置） */
  onMouseMove?: (e: MouseEvent) => void
  /** 拖拽中每次移动的增量位移（client 坐标系；游乐场窗口位于 (0,0)，client 即屏幕坐标） */
  onDragMove?: (dx: number, dy: number) => void
  /** 拖拽结束（产生过位移的非点击）时回调，组件在此持久化鱼的位置 */
  onDragEnd?: () => void
}

/**
 * 拖拽模块：位移计算、点击判定全部在实现内部。
 * 拖鱼 = 移动游乐场窗口内的鱼元素（onDragMove 增量驱动），不再移动 OS 窗口。
 * Interface 只有 { isDragging, startDrag }；document 监听自挂自拆。
 */
export function useDrag({ onTap, onMouseMove, onDragMove, onDragEnd }: UseDragOptions) {
  const isDragging = ref(false)
  const prevX = ref(0)
  const prevY = ref(0)
  const tapStartX = ref(0)
  const tapStartY = ref(0)
  let moved = false

  function startDrag(e: MouseEvent) {
    isDragging.value = true
    moved = false
    prevX.value = e.clientX; prevY.value = e.clientY
    tapStartX.value = e.clientX; tapStartY.value = e.clientY
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging.value) {
      const dx = e.clientX - prevX.value
      const dy = e.clientY - prevY.value
      prevX.value = e.clientX; prevY.value = e.clientY
      if (dx !== 0 || dy !== 0) {
        moved = true
        onDragMove?.(dx, dy)
      }
    }
    onMouseMove?.(e)
  }

  function handleMouseUp(e: MouseEvent) {
    if (isDragging.value) {
      if (isTap(e.clientX - tapStartX.value, e.clientY - tapStartY.value)) {
        onTap?.()
      } else if (moved) {
        onDragEnd?.()
      }
    }
    isDragging.value = false
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })
  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  })

  return { isDragging, startDrag }
}

/** 点击判定：位移各分量均小于阈值才算点击 */
export function isTap(dx: number, dy: number, threshold = 5): boolean {
  return Math.abs(dx) < threshold && Math.abs(dy) < threshold
}
