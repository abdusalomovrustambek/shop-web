<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import Toast from '@/components/Toast.vue'
import { useCartStore } from '@/stores/cart'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const cart = useCartStore()
const route = useRoute()
const router = useRouter()

async function loadCart(): Promise<void> {
  try {
    await cart.load()
  } catch (error) {
    // The header count stays empty; pages that need the cart show the error.
    console.warn('Could not load the cart', error)
  }
}

// When the session ends (sign-out, or a refresh the gateway refused), drop the
// cart and leave pages that need a signed-in user.
watch(
  () => session.isSignedIn,
  async (signedIn) => {
    if (signedIn) {
      await loadCart()
      return
    }
    cart.reset()
    if (route.meta.requiresAuth) {
      await router.replace({ name: 'sign-in', query: { next: route.fullPath } })
    }
  },
  { immediate: true },
)

// Public pages do not pass the router guard, so start the session here too.
onMounted(() => session.restore())
</script>

<template>
  <AppHeader />
  <main class="container page">
    <RouterView />
  </main>
  <Toast />
</template>
