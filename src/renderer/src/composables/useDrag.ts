import { ref } from 'vue'

export function useDrag() {
  const isDragging = ref(false)
  const prevX = ref(0)
  const prevY = ref(0)
  const tapStartX = ref(0)
  const tapStartY = ref(0)

  return {
    isDragging,
    prevX,
    prevY,
    tapStartX,
    tapStartY
  }
}
