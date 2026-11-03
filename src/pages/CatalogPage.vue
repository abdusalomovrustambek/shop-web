<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { listProducts, toApiError } from '@/api/client'
import type { Product } from '@/api/types'
import EmptyState from '@/components/EmptyState.vue'
import ProductCard from '@/components/ProductCard.vue'
import { useToastStore } from '@/stores/toast'

const PAGE_SIZE = 12
const SEARCH_DELAY_MS = 300

const toasts = useToastStore()

const search = ref('')
const products = ref<Product[]>([])
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)

const hasMore = computed(() => products.value.length < total.value)

let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | undefined

/** Loads the first page (reset) or the next one. Never rejects. */
async function load(reset: boolean): Promise<void> {
  // A newer request replaces an older one, so a late response for an old
  // search can never overwrite the current list.
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = null
  try {
    const page = await listProducts(
      { search: search.value, limit: PAGE_SIZE, offset: reset ? 0 : products.value.length },
      current.signal,
    )
    products.value = reset ? page.items : [...products.value, ...page.items]
    total.value = page.total
    loaded.value = true
  } catch (caught) {
    if (current.signal.aborted) return
    error.value = toApiError(caught).message
    toasts.error(error.value)
  } finally {
    if (controller === current) loading.value = false
  }
}

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(true), SEARCH_DELAY_MS)
})

onMounted(() => load(true))

onUnmounted(() => {
  clearTimeout(searchTimer)
  controller?.abort()
})
</script>

<template>
  <section class="catalog">
    <h1 class="page-title">
      Catalog
    </h1>
    <div class="field catalog__search">
      <label
        class="field__label"
        for="catalog-search"
      >Search products</label>
      <input
        id="catalog-search"
        v-model="search"
        class="field__input"
        type="search"
        placeholder="Mugs, backpacks, lamps…"
        autocomplete="off"
      >
    </div>

    <p
      v-if="!loaded && loading"
      class="loading"
    >
      Loading products…
    </p>
    <div
      v-else-if="!loaded && error"
      class="alert"
      role="alert"
    >
      {{ error }}
      <button
        type="button"
        class="button button--link"
        @click="load(true)"
      >
        Try again
      </button>
    </div>
    <EmptyState
      v-else-if="loaded && products.length === 0"
      :title="search.trim() ? 'No products found' : 'The catalog is empty'"
      :message="search.trim() ? `Nothing matches “${search.trim()}”.` : 'Check back soon.'"
    >
      <button
        v-if="search.trim()"
        type="button"
        class="button"
        @click="search = ''"
      >
        Clear search
      </button>
    </EmptyState>
    <template v-else>
      <ul class="product-grid">
        <li
          v-for="product in products"
          :key="product.id"
        >
          <ProductCard :product="product" />
        </li>
      </ul>
      <div
        v-if="hasMore"
        class="catalog__more"
      >
        <button
          type="button"
          class="button button--secondary"
          :disabled="loading"
          @click="load(false)"
        >
          {{ loading ? 'Loading…' : 'Load more' }}
        </button>
        <span class="muted">Showing {{ products.length }} of {{ total }}</span>
      </div>
    </template>
  </section>
</template>
