<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    min?: number
    max: number
    disabled?: boolean
    label?: string
  }>(),
  { min: 1, disabled: false, label: 'Quantity' },
)

const quantity = defineModel<number>({ required: true })

const canDecrease = computed(() => !props.disabled && quantity.value > props.min)
const canIncrease = computed(() => !props.disabled && quantity.value < props.max)

function step(delta: number): void {
  quantity.value = Math.min(props.max, Math.max(props.min, quantity.value + delta))
}
</script>

<template>
  <div
    class="stepper"
    role="group"
    :aria-label="label"
  >
    <button
      type="button"
      class="stepper__button"
      :disabled="!canDecrease"
      :aria-label="`Decrease ${label.toLowerCase()}`"
      @click="step(-1)"
    >
      −
    </button>
    <output
      class="stepper__value"
      aria-live="polite"
    >{{ quantity }}</output>
    <button
      type="button"
      class="stepper__button"
      :disabled="!canIncrease"
      :aria-label="`Increase ${label.toLowerCase()}`"
      @click="step(1)"
    >
      +
    </button>
  </div>
</template>
