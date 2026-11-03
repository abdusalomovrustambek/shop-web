<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { toApiError } from '@/api/client'
import type { CartItem } from '@/api/types'
import CouponForm from '@/components/CouponForm.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderSummary from '@/components/OrderSummary.vue'
import PriceTag from '@/components/PriceTag.vue'
import QuantityStepper from '@/components/QuantityStepper.vue'
import { useCartStore } from '@/stores/cart'
import { useToastStore } from '@/stores/toast'

const MAX_QUANTITY = 99

const cart = useCartStore()
const toasts = useToastStore()

const loadError = ref<string | null>(null)
const updating = ref<number | null>(null)

async function load(): Promise<void> {
  loadError.value = null
  try {
    await cart.load()
  } catch (caught) {
    loadError.value = toApiError(caught).message
    toasts.error(loadError.value)
  }
}

async function setQuantity(item: CartItem, quantity: number): Promise<void> {
  if (updating.value !== null) return
  updating.value = item.product_id
  try {
    await cart.setQuantity(item.product_id, quantity)
  } catch (caught) {
    toasts.error(toApiError(caught).message)
  } finally {
    updating.value = null
  }
}

function maxFor(item: CartItem): number {
  return Math.max(item.quantity, Math.min(item.stock, MAX_QUANTITY))
}

onMounted(load)
</script>

<template>
  <h1 class="page-title">
    Your cart
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
      @click="load"
    >
      Try again
    </button>
  </div>
  <EmptyState
    v-else-if="cart.cart && cart.isEmpty"
    title="Your cart is empty"
    message="Add something from the catalog and it will show up here."
  />
  <div
    v-else-if="cart.cart"
    class="cart-layout"
  >
    <div class="cart-main">
      <ul class="cart-list">
        <li
          v-for="item in cart.items"
          :key="item.product_id"
          class="cart-item"
        >
          <img
            class="cart-item__image"
            :src="item.image_url"
            :alt="item.name"
            width="72"
            height="72"
          >
          <div class="cart-item__body">
            <RouterLink
              class="cart-item__name"
              :to="{ name: 'product', params: { id: item.product_id } }"
            >
              {{ item.name }}
            </RouterLink>
            <span class="muted">
              <PriceTag
                :cents="item.unit_price_cents"
                :currency="cart.cart.currency"
              /> each
            </span>
            <div class="cart-item__controls">
              <QuantityStepper
                :model-value="item.quantity"
                :max="maxFor(item)"
                :disabled="updating !== null"
                :label="`Quantity of ${item.name}`"
                @update:model-value="setQuantity(item, $event)"
              />
              <button
                type="button"
                class="button button--link"
                :disabled="updating !== null"
                @click="setQuantity(item, 0)"
              >
                Remove
              </button>
            </div>
          </div>
        </li>
      </ul>
      <CouponForm />
    </div>
    <aside
      class="cart-summary"
      aria-label="Order summary"
    >
      <OrderSummary
        :subtotal-cents="cart.cart.subtotal_cents"
        :coupon="cart.cart.coupon"
        :currency="cart.cart.currency"
      />
      <RouterLink
        class="button button--block"
        :to="{ name: 'checkout' }"
      >
        Checkout
      </RouterLink>
    </aside>
  </div>
</template>
