import { onMounted, onUnmounted, ref } from 'vue'

export interface UseDragOptions {
  /** 按下与抬起位移小于阈值时触发（点击而非拖拽） */
  onTap?: () => void
  /** 每次鼠标移动时回调（组件用于鼠标追踪、受惊检测、睡眠重置） */
  onMouseMove?: (e: MouseEvent) => void
}

/**
 * 拖拽模块：位移计算、点击判定、moveWindow IPC 全部在实现内部。
 * Interface 只有 { isDragging, startDrag }；document 监听自挂自拆。
 */
export function useDrag({ onTap, onMouseMove }: UseDragOptions) {
  const isDragging = ref(false)
  const prevX = ref(0)
  const prevY = ref(0)
  const tapStartX = ref(0)
  const tapStartY = ref(0)

  function startDrag(e: MouseEvent) {
    isDragging.value = true
    prevX.value = e.screenX; prevY.value = e.screenY
    tapStartX.value = e.screenX; tapStartY.value = e.screenY
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging.value) {
      const dx = e.screenX - prevX.value
      const dy = e.screenY - prevY.value
      prevX.value = e.screenX; prevY.value = e.screenY
      if (window.api && (dx !== 0 || dy !== 0)) {
        window.api.moveWindow(dx, dy)
      }
    }
    onMouseMove?.(e)
  }

  function handleMouseUp(e: MouseEvent) {
    if (isDragging.value && isTap(e.screenX - tapStartX.value, e.screenY - tapStartY.value)) {
      onTap?.()
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
