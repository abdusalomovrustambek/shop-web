<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toasts = useToastStore()
</script>

<template>
  <ul
    class="toasts"
    aria-live="polite"
  >
    <li
      v-for="message in toasts.messages"
      :key="message.id"
      class="toast"
      :class="{ 'toast--error': message.kind === 'error' }"
      :role="message.kind === 'error' ? 'alert' : 'status'"
    >
      <span>{{ message.text }}</span>
      <button
        type="button"
        class="toast__close"
        aria-label="Dismiss"
        @click="toasts.dismiss(message.id)"
      >
        ×
      </button>
    </li>
  </ul>
</template>
