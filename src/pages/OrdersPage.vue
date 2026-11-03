<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { listOrders, toApiError } from '@/api/client'
import type { Order } from '@/api/types'
import EmptyState from '@/components/EmptyState.vue'
import PriceTag from '@/components/PriceTag.vue'
import { useToastStore } from '@/stores/toast'

const toasts = useToastStore()

const orders = ref<Order[] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = null
  try {
    orders.value = await listOrders(current.signal)
  } catch (caught) {
    if (current.signal.aborted) return
    error.value = toApiError(caught).message
    toasts.error(error.value)
  } finally {
    if (controller === current) loading.value = false
  }
}

function itemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}

onMounted(load)
onUnmounted(() => controller?.abort())
</script>

<template>
  <h1 class="page-title">
    My orders
  </h1>
  <p
    v-if="loading"
    class="loading"
  >
    Loading your orders…
  </p>
  <div
    v-else-if="error"
    class="alert"
    role="alert"
  >
    {{ error }}
    <button
      type="button"
      class="button button--link"
      @click="load"
    >
      Try again
    </button>
  </div>
  <EmptyState
    v-else-if="orders && orders.length === 0"
    title="No orders yet"
    message="When you place an order it will show up here."
  />
  <ul
    v-else-if="orders"
    class="order-list"
  >
    <li
      v-for="order in orders"
      :key="order.id"
    >
      <RouterLink
        class="order-row"
        :to="{ name: 'order', params: { id: order.id } }"
      >
        <span class="order-row__id">Order #{{ order.id }}</span>
        <span class="muted">{{ dateFormat.format(new Date(order.created_at)) }}</span>
        <span class="muted">{{ itemCount(order) }} {{ itemCount(order) === 1 ? 'item' : 'items' }}</span>
        <span :class="['status', `status--${order.status}`]">{{ order.status }}</span>
        <PriceTag
          :cents="order.total_cents"
          :currency="order.currency"
        />
      </RouterLink>
    </li>
  </ul>
</template>
