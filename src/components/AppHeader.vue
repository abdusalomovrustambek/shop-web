<script setup lang="ts">
import { ref } from 'vue'
import { toApiError } from '@/api/client'
import { useCartStore } from '@/stores/cart'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'

const session = useSessionStore()
const cart = useCartStore()
const toasts = useToastStore()
const menu = ref<HTMLDetailsElement | null>(null)

async function signOut(): Promise<void> {
  if (menu.value) menu.value.open = false
  try {
    await session.signOut()
  } catch (error) {
    toasts.error(`Signed out on this device, but the server said: ${toApiError(error).message}`)
  }
}
</script>

<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <RouterLink
        class="app-header__brand"
        :to="{ name: 'catalog' }"
      >
        Shop
      </RouterLink>
      <nav
        class="app-header__nav"
        aria-label="Main"
      >
        <template v-if="session.isSignedIn">
          <RouterLink
            class="app-header__link"
            :to="{ name: 'orders' }"
          >
            Orders
          </RouterLink>
          <RouterLink
            class="app-header__link cart-link"
            :to="{ name: 'cart' }"
          >
            Cart
            <span
              class="cart-link__count"
              :aria-label="`${cart.count} items in cart`"
            >{{ cart.count }}</span>
          </RouterLink>
          <details
            ref="menu"
            class="user-menu"
          >
            <summary class="app-header__link">
              <span class="user-menu__label">{{ session.user?.name || 'Account' }}</span> ▾
            </summary>
            <div class="user-menu__panel">
              <p class="user-menu__email muted">
                {{ session.user?.email ?? 'Signed in' }}
              </p>
              <button
                type="button"
                class="button button--secondary button--block"
                @click="signOut"
              >
                Sign out
              </button>
            </div>
          </details>
        </template>
        <RouterLink
          v-else
          class="app-header__link"
          :to="{ name: 'sign-in' }"
        >
          Sign in
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
