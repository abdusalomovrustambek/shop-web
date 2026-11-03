<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { checkout, toApiError } from '@/api/client'
import EmptyState from '@/components/EmptyState.vue'
import { useCartStore } from '@/stores/cart'
import { useToastStore } from '@/stores/toast'
import { formatMoney } from '@/utils/money'

// Only the card network's test numbers are accepted: this is a demo store.
const TEST_CARDS = ['4242424242424242', '4000000000000002']
const CURRENCIES = ['USD', 'EUR', 'UZS']

const router = useRouter()
const cart = useCartStore()
const toasts = useToastStore()

const form = reactive({ number: '', expiry: '', cvc: '', currency: 'USD' })
const errors = reactive<{ number?: string; expiry?: string; cvc?: string }>({})
const placing = ref(false)
const submitError = ref<string | null>(null)
const loadError = ref<string | null>(null)

function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim())
  if (!match?.[1] || !match[2]) return null
  const month = Number.parseInt(match[1], 10)
  const year = 2000 + Number.parseInt(match[2], 10)
  if (month < 1 || month > 12) return null
  const now = new Date()
  const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
  return expired ? null : { month, year }
}

function validate(): { number: string; month: number; year: number; cvc: string } | null {
  const number = form.number.replace(/[\s-]/g, '')
  const expiry = parseExpiry(form.expiry)
  const cvc = form.cvc.trim()
  errors.number = TEST_CARDS.includes(number) ? undefined : 'Use a test card: 4242 4242 4242 4242.'
  errors.expiry = expiry ? undefined : 'Enter a future date as MM/YY.'
  errors.cvc = /^\d{3,4}$/.test(cvc) ? undefined : 'Enter the 3 or 4 digits on the back.'
  if (errors.number || errors.expiry || errors.cvc || !expiry) return null
  return { number, cvc, ...expiry }
}

async function placeOrder(): Promise<void> {
  if (placing.value) return
  submitError.value = null
  const card = validate()
  if (!card) return
  placing.value = true
  try {
    const order = await checkout({
      currency: form.currency,
      card: { number: card.number, exp_month: card.month, exp_year: card.year, cvc: card.cvc },
    })
    toasts.show(`Order #${order.id} placed.`)
    await router.push({ name: 'order', params: { id: order.id } })
    // The cart is empty after checkout; refresh the header count.
    await cart.load().catch((caught: unknown) => console.warn('Could not reload the cart', caught))
  } catch (caught) {
    submitError.value = toApiError(caught).message
  } finally {
    placing.value = false
  }
}

async function loadCart(): Promise<void> {
  loadError.value = null
  try {
    await cart.load()
  } catch (caught) {
    loadError.value = toApiError(caught).message
    toasts.error(loadError.value)
  }
}

onMounted(loadCart)
</script>

<template>
  <h1 class="page-title">
    Checkout
  </h1>
  <p
    v-if="cart.cart === null && cart.loading"
    class="loading"
  >
    Loading your cart…
  </p>
  <div
    v-else-if="cart.cart === null && loadError"
    class="alert"
    role="alert"
  >
    {{ loadError }}
    <button
      type="button"
      class="button button--link"
      @click="loadCart"
    >
      Try again
    </button>
  </div>
  <EmptyState
    v-else-if="cart.cart && cart.isEmpty"
    title="Nothing to check out"
    message="Your cart is empty."
  />
  <div
    v-else-if="cart.cart"
    class="checkout"
  >
    <form
      class="card"
      novalidate
      @submit.prevent="placeOrder"
    >
      <h2 class="page-title">
        Payment
      </h2>
      <p class="checkout__test-cards">
        This is a demo store: use the test card 4242 4242 4242 4242 with any future date and any CVC.
        4000 0000 0000 0002 is declined.
      </p>
      <div
        v-if="submitError"
        class="alert"
        role="alert"
      >
        {{ submitError }}
      </div>
      <div class="field">
        <label
          class="field__label"
          for="card-number"
        >Card number</label>
        <input
          id="card-number"
          v-model="form.number"
          class="field__input"
          inputmode="numeric"
          autocomplete="cc-number"
          placeholder="4242 4242 4242 4242"
          :aria-invalid="errors.number ? 'true' : 'false'"
          :aria-describedby="errors.number ? 'card-number-error' : undefined"
        >
        <p
          v-if="errors.number"
          id="card-number-error"
          class="field__error"
        >
          {{ errors.number }}
        </p>
      </div>
      <div class="field-row">
        <div class="field">
          <label
            class="field__label"
            for="card-expiry"
          >Expiry (MM/YY)</label>
          <input
            id="card-expiry"
            v-model="form.expiry"
            class="field__input"
            inputmode="numeric"
            autocomplete="cc-exp"
            placeholder="12/30"
            :aria-invalid="errors.expiry ? 'true' : 'false'"
            :aria-describedby="errors.expiry ? 'card-expiry-error' : undefined"
          >
          <p
            v-if="errors.expiry"
            id="card-expiry-error"
            class="field__error"
          >
            {{ errors.expiry }}
          </p>
        </div>
        <div class="field">
          <label
            class="field__label"
            for="card-cvc"
          >CVC</label>
          <input
            id="card-cvc"
            v-model="form.cvc"
            class="field__input"
            inputmode="numeric"
            autocomplete="cc-csc"
            placeholder="123"
            :aria-invalid="errors.cvc ? 'true' : 'false'"
            :aria-describedby="errors.cvc ? 'card-cvc-error' : undefined"
          >
          <p
            v-if="errors.cvc"
            id="card-cvc-error"
            class="field__error"
          >
            {{ errors.cvc }}
          </p>
        </div>
      </div>
      <div class="field">
        <label
          class="field__label"
          for="currency"
        >Currency</label>
        <select
          id="currency"
          v-model="form.currency"
          class="field__input"
        >
          <option
            v-for="currency in CURRENCIES"
            :key="currency"
            :value="currency"
          >
            {{ currency }}
          </option>
        </select>
      </div>
      <button
        type="submit"
        class="button button--block"
        :disabled="placing"
      >
        {{ placing ? 'Placing order…' : 'Place order' }}
      </button>
    </form>
    <aside
      class="card"
      aria-label="Order summary"
    >
      <h2 class="page-title">
        Summary
      </h2>
      <dl class="summary">
        <div class="summary__row">
          <dt>Items</dt>
          <dd>{{ cart.count }}</dd>
        </div>
        <div class="summary__row">
          <dt>Subtotal</dt>
          <dd>{{ formatMoney(cart.cart.subtotal_cents, cart.cart.currency) }}</dd>
        </div>
        <div
          v-if="cart.cart.discount_cents > 0"
          class="summary__row summary__row--discount"
        >
          <dt>Discount</dt>
          <dd>−{{ formatMoney(cart.cart.discount_cents, cart.cart.currency) }}</dd>
        </div>
        <div class="summary__row summary__row--total">
          <dt>Total</dt>
          <dd>{{ formatMoney(cart.cart.total_cents, cart.cart.currency) }}</dd>
        </div>
      </dl>
    </aside>
  </div>
</template>
