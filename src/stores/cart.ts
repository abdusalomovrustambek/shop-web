import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as api from '@/api/client'
import type { ApiError } from '@/api/client'
import type { Cart } from '@/api/types'

// Totals always come from the API response; the store never computes them.
export const useCartStore = defineStore('cart', () => {
  const cart = ref<Cart | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  const items = computed(() => cart.value?.items ?? [])
  const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  /** Runs a cart request; on failure the cart stays as it was and the error is kept and rethrown. */
  async function run(action: () => Promise<Cart>): Promise<Cart> {
    loading.value = true
    error.value = null
    try {
      const next = await action()
      cart.value = next
      return next
    } catch (caught) {
      error.value = api.toApiError(caught)
      throw error.value
    } finally {
      loading.value = false
    }
  }

  function load(): Promise<Cart> {
    return run(() => api.getCart())
  }

  function addItem(productId: number, quantity: number): Promise<Cart> {
    return run(() => api.addCartItem(productId, quantity))
  }

  /** Quantity 0 removes the item. */
  function setQuantity(productId: number, quantity: number): Promise<Cart> {
    return run(() => api.updateCartItem(productId, quantity))
  }

  function applyCoupon(code: string): Promise<Cart> {
    return run(() => api.applyCoupon(code))
  }

  function reset(): void {
    cart.value = null
    error.value = null
  }

  return { cart, loading, error, items, count, isEmpty, load, addItem, setQuantity, applyCoupon, reset }
})
