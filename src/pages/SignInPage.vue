<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toApiError } from '@/api/client'
import { safeRedirect } from '@/utils/navigation'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function submit(): Promise<void> {
  if (submitting.value) return
  if (email.value.trim() === '' || password.value === '') {
    error.value = 'Enter your email and password.'
    return
  }
  error.value = null
  submitting.value = true
  try {
    await session.signIn(email.value.trim(), password.value)
    await router.replace(safeRedirect(route.query.next))
  } catch (caught) {
    const apiError = toApiError(caught)
    error.value = apiError.status === 401 ? 'Wrong email or password.' : apiError.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="sign-in card">
    <h1 class="page-title">
      Sign in
    </h1>
    <div
      v-if="error"
      class="alert"
      role="alert"
    >
      {{ error }}
    </div>
    <form
      novalidate
      @submit.prevent="submit"
    >
      <div class="field">
        <label
          class="field__label"
          for="sign-in-email"
        >Email</label>
        <input
          id="sign-in-email"
          v-model="email"
          class="field__input"
          type="email"
          autocomplete="email"
          required
        >
      </div>
      <div class="field">
        <label
          class="field__label"
          for="sign-in-password"
        >Password</label>
        <input
          id="sign-in-password"
          v-model="password"
          class="field__input"
          type="password"
          autocomplete="current-password"
          required
        >
      </div>
      <button
        type="submit"
        class="button button--block"
        :disabled="submitting"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
    <p class="sign-in__hint muted">
      Accounts are created through the API; there is no sign-up page.
    </p>
  </section>
</template>
