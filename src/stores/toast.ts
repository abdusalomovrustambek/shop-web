import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'info' | 'error'

export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

const TOAST_MS = 5000

export const useToastStore = defineStore('toast', () => {
  const messages = ref<ToastMessage[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextId = 1

  function dismiss(id: number): void {
    clearTimeout(timers.get(id))
    timers.delete(id)
    messages.value = messages.value.filter((message) => message.id !== id)
  }

  function show(text: string, kind: ToastKind = 'info'): void {
    const id = nextId++
    messages.value = [...messages.value, { id, kind, text }]
    timers.set(
      id,
      setTimeout(() => dismiss(id), TOAST_MS),
    )
  }

  function error(text: string): void {
    show(text, 'error')
  }

  return { messages, show, error, dismiss }
})
