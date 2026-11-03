<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { getOrder, toApiError } from '@/api/client'
import type { Order } from '@/api/types'
import EmptyState from '@/components/EmptyState.vue'
import { useToastStore } from '@/stores/toast'
import { formatMoney } from '@/utils/money'

const props = defineProps<{ id: number | null }>()

const toasts = useToastStore()

const order = ref<Order | null>(null)
const loading = ref(false)
const notFound = ref(false)
const error = ref<string | null>(null)

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' })

let controller: AbortController | null = null

async function load(id: number | null): Promise<void> {
  controller?.abort()
  order.value = null
  error.value = null
  notFound.value = id === null
  if (id === null) return
  const current = new AbortController()
  controller = current
  loading.value = true
  try {
    order.value = await getOrder(id, current.signal)
  } catch (caught) {
    if (current.signal.aborted) return
    const apiError = toApiError(caught)
    if (apiError.status === 404) {
      notFound.value = true
    } else {
      error.value = apiError.message
      toasts.error(apiError.message)
    }
  } finally {
    if (controller === current) loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

onUnmounted(() => controller?.abort())
</script>

<template>
  <RouterLink
    class="back-link"
    :to="{ name: 'orders' }"
  >
    ← All orders
  </RouterLink>
  <p
    v-if="loading"
    class="loading"
  >
    Loading order…
  </p>
  <EmptyState
    v-else-if="notFound"
    title="Order not found"
    message="We could not find this order in your account."
  >
    <RouterLink
      class="button"
      :to="{ name: 'orders' }"
    >
      See my orders
    </RouterLink>
  </EmptyState>
  <div
    v-else-if="error"
    class="alert"
    role="alert"
  >
    {{ error }}
    <button
      type="button"
      class="button button--link"
      @click="load(props.id)"
    >
      Try again
    </button>
  </div>
  <article
    v-else-if="order"
    class="card"
  >
    <header class="order-header">
      <h1>Order #{{ order.id }}</h1>
      <span :class="['status', `status--${order.status}`]">{{ order.status }}</span>
      <span class="muted">{{ dateFormat.format(new Date(order.created_at)) }}</span>
    </header>
    <table class="order-items">
      <thead>
        <tr>
          <th scope="col">
            Item
          </th>
          <th scope="col">
            Qty
          </th>
          <th scope="col">
            Price
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in order.items"
          :key="item.product_id"
        >
          <td>
            <RouterLink :to="{ name: 'product', params: { id: item.product_id } }">
              {{ item.name }}
            </RouterLink>
          </td>
          <td>{{ item.quantity }}</td>
          <td>{{ formatMoney(item.unit_price_cents, order.currency) }}</td>
        </tr>
      </tbody>
    </table>
    <dl class="summary">
      <div class="summary__row">
        <dt>Subtotal</dt>
        <dd>{{ formatMoney(order.subtotal_cents, order.currency) }}</dd>
      </div>
      <div
        v-if="order.coupon_code"
        class="summary__row"
      >
        <dt>Coupon</dt>
        <dd>{{ order.coupon_code }}</dd>
      </div>
      <div class="summary__row summary__row--total">
        <dt>Total</dt>
        <dd>{{ formatMoney(order.total_cents, order.currency) }}</dd>
      </div>
    </dl>
  </article>
</template>
