import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as api from '@/api/client'
import type { User } from '@/api/types'

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(api.getAccessToken())
  const user = ref<User | null>(null)
  const isSignedIn = computed(() => token.value !== null)

  // The client changes the token on refresh and clears it when the session
  // ends, so the store follows it instead of keeping its own copy in sync.
  api.onAccessTokenChange((next) => {
    token.value = next
    if (next === null) user.value = null
  })

  let restoring: Promise<void> | null = null

  async function loadUser(): Promise<void> {
    try {
      user.value = await api.getMe()
    } catch (error) {
      // The token still works for the API; the header just shows no name.
      console.warn('Could not load the signed-in user', error)
    }
  }

  /** Signs in from the refresh cookie once per page load. Never rejects. */
  function restore(): Promise<void> {
    restoring ??= (async () => {
      if (token.value === null) await api.refreshAccessToken()
      if (token.value !== null && user.value === null) await loadUser()
    })()
    return restoring
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { access_token: next } = await api.login(email, password)
    api.setAccessToken(next)
    await loadUser()
  }

  async function signOut(): Promise<void> {
    try {
      await api.logout()
    } finally {
      api.setAccessToken(null)
    }
  }

  return { token, user, isSignedIn, restore, signIn, signOut }
})
