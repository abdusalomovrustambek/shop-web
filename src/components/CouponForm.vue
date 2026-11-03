<script setup lang="ts">
import { computed, ref } from 'vue'
import { toApiError } from '@/api/client'
import { useCartStore } from '@/stores/cart'

const cart = useCartStore()

const code = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const applied = computed(() => cart.cart?.coupon ?? null)

async function submit(): Promise<void> {
  if (submitting.value) return
  const value = code.value.trim()
  if (value === '') {
    error.value = 'Enter a coupon code.'
    return
  }
  error.value = null
  submitting.value = true
  try {
    await cart.applyCoupon(value)
    code.value = ''
  } catch (caught) {
    error.value = toApiError(caught).message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form
    class="coupon-form"
    novalidate
    @submit.prevent="submit"
  >
    <div class="field">
      <label
        class="field__label"
        for="coupon-code"
      >Coupon code</label>
      <div class="coupon-form__row">
        <input
          id="coupon-code"
          v-model="code"
          class="field__input"
          name="coupon"
          autocomplete="off"
          autocapitalize="characters"
          :aria-invalid="error ? 'true' : 'false'"
          :aria-describedby="error ? 'coupon-error' : undefined"
        >
        <button
          type="submit"
          class="button button--secondary"
          :disabled="submitting"
        >
          Apply
        </button>
      </div>
      <p
        v-if="error"
        id="coupon-error"
        class="field__error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-else-if="applied"
        class="coupon-form__applied"
      >
        Coupon {{ applied.code }} applied.
      </p>
    </div>
  </form>
</template>
