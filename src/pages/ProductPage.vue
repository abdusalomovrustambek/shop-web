<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProduct, toApiError } from '@/api/client'
import type { Product } from '@/api/types'
import EmptyState from '@/components/EmptyState.vue'
import PriceTag from '@/components/PriceTag.vue'
import QuantityStepper from '@/components/QuantityStepper.vue'
import { useCartStore } from '@/stores/cart'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'

const MAX_QUANTITY = 99

const props = defineProps<{ id: number | null }>()

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const cart = useCartStore()
const toasts = useToastStore()

const product = ref<Product | null>(null)
const loading = ref(false)
const notFound = ref(false)
const error = ref<string | null>(null)
const quantity = ref(1)
const adding = ref(false)

const maxQuantity = computed(() => Math.min(product.value?.stock ?? 0, MAX_QUANTITY))
const inStock = computed(() => (product.value?.stock ?? 0) > 0)

let controller: AbortController | null = null

async function load(id: number | null): Promise<void> {
  controller?.abort()
  product.value = null
  error.value = null
  notFound.value = id === null
  quantity.value = 1
  if (id === null) return
  const current = new AbortController()
  controller = current
  loading.value = true
  try {
    product.value = await getProduct(id, current.signal)
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

async function addToCart(): Promise<void> {
  const current = product.value
  if (!current || adding.value) return
  if (!session.isSignedIn) {
    await router.push({ name: 'sign-in', query: { next: route.fullPath } })
    return
  }
  adding.value = true
  try {
    await cart.addItem(current.id, quantity.value)
    toasts.show(`Added ${quantity.value} × ${current.name} to your cart.`)
  } catch (caught) {
    toasts.error(toApiError(caught).message)
  } finally {
    adding.value = false
  }
}

watch(() => props.id, load, { immediate: true })

onUnmounted(() => controller?.abort())
</script>

<template>
  <RouterLink
    class="back-link"
    :to="{ name: 'catalog' }"
  >
    ← Back to catalog
  </RouterLink>
  <p
    v-if="loading"
    class="loading"
  >
    Loading product…
  </p>
  <EmptyState
    v-else-if="notFound"
    title="Product not found"
    message="It may have been removed from the catalog."
  />
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
    v-else-if="product"
    class="product"
  >
    <img
      class="product__image"
      :src="product.image_url"
      :alt="product.name"
      width="800"
      height="600"
    >
    <div class="product__info">
      <h1 class="product__name">
        {{ product.name }}
      </h1>
      <PriceTag
        class="product__price"
        :cents="product.price_cents"
      />
      <p
        v-if="inStock"
        class="stock"
      >
        {{ product.stock }} in stock
      </p>
      <p
        v-else
        class="stock stock--out"
      >
        Out of stock
      </p>
      <p>{{ product.description }}</p>
      <div class="product__actions">
        <QuantityStepper
          v-if="inStock"
          v-model="quantity"
          :max="maxQuantity"
        />
        <button
          type="button"
          class="button"
          :disabled="!inStock || adding"
          @click="addToCart"
        >
          {{ adding ? 'Adding…' : 'Add to cart' }}
        </button>
      </div>
    </div>
  </article>
</template>
