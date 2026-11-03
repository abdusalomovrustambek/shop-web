<script setup lang="ts">
import type { Product } from '@/api/types'
import PriceTag from '@/components/PriceTag.vue'

defineProps<{ product: Product }>()
</script>

<template>
  <RouterLink
    class="product-card"
    :to="{ name: 'product', params: { id: product.id } }"
  >
    <img
      class="product-card__image"
      :src="product.image_url"
      :alt="product.name"
      loading="lazy"
      width="400"
      height="300"
    >
    <div class="product-card__body">
      <h3 class="product-card__name">
        {{ product.name }}
      </h3>
      <div class="product-card__footer">
        <PriceTag :cents="product.price_cents" />
        <span
          v-if="product.stock === 0"
          class="stock stock--out"
        >Out of stock</span>
        <span
          v-else-if="product.stock <= 5"
          class="stock"
        >Only {{ product.stock }} left</span>
      </div>
    </div>
  </RouterLink>
</template>
