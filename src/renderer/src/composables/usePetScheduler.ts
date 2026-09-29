import { onUnmounted } from 'vue'
import { PetScheduler } from './PetScheduler'

export function usePetScheduler(): PetScheduler {
  const scheduler = new PetScheduler()
  onUnmounted(() => scheduler.cancelAll())
  return scheduler
}
