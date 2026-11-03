<script setup lang="ts">
import { computed } from 'vue'
import type { Coupon } from '@/api/types'
import { formatMoney } from '@/utils/money'

const props = defineProps<{
  subtotalCents: number
  coupon: Coupon | null
  currency: string
}>()

const discountCents = computed(() => {
  const coupon = props.coupon
  if (!coupon) return 0
  if (coupon.kind === 'percent') return Math.floor((props.subtotalCents * coupon.value) / 100)
  return Math.min(coupon.value, props.subtotalCents)
})

const totalCents = computed(() => props.subtotalCents - discountCents.value)
</script>

<template>
  <dl class="summary">
    <div class="summary__row">
      <dt>Subtotal</dt>
      <dd>{{ formatMoney(subtotalCents, currency) }}</dd>
    </div>
    <div
      v-if="coupon"
      class="summary__row summary__row--discount"
    >
      <dt>Discount ({{ coupon.code }})</dt>
      <dd>−{{ formatMoney(discountCents, currency) }}</dd>
    </div>
    <div class="summary__row summary__row--total">
      <dt>Total</dt>
      <dd>{{ formatMoney(totalCents, currency) }}</dd>
    </div>
  </dl>
</template>
