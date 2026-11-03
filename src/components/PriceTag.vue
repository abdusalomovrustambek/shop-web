<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney, STORE_CURRENCY } from '@/utils/money'

const props = withDefaults(defineProps<{ cents: number; currency?: string }>(), {
  currency: STORE_CURRENCY,
})

const text = computed(() => formatMoney(props.cents, props.currency))
</script>

<template>
  <span class="price">{{ text }}</span>
</template>
