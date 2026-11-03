<script setup lang="ts">
defineProps<{ title: string; message?: string }>()
</script>

<template>
  <section class="empty-state">
    <h2>{{ title }}</h2>
    <p
      v-if="message"
      class="empty-state__message"
    >
      {{ message }}
    </p>
    <slot>
      <RouterLink
        class="button"
        :to="{ name: 'catalog' }"
      >
        Browse the catalog
      </RouterLink>
    </slot>
  </section>
</template>
