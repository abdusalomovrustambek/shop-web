import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/client'
import type { User } from '@/api/types'
import { useSessionStore } from '@/stores/session'

vi.mock(import('@/api/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  refreshAccessToken: vi.fn(),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const USER: User = { id: 'u-1', email: 'demo@shop.test', name: 'Demo' }

function newStore() {
  setActivePinia(createPinia())
  return useSessionStore()
}

beforeEach(() => {
  api.setAccessToken(null)
  vi.mocked(api.refreshAccessToken).mockReset()
  vi.mocked(api.getMe).mockReset()
  vi.mocked(api.login).mockReset()
  vi.mocked(api.logout).mockReset()
})

describe('session store', () => {
  it('restores the session from the refresh cookie once, however often it is asked', async () => {
    vi.mocked(api.refreshAccessToken).mockImplementation(async () => {
      api.setAccessToken('token')
      return 'token'
    })
    vi.mocked(api.getMe).mockResolvedValue(USER)
    const session = newStore()

    await Promise.all([session.restore(), session.restore()])
    await session.restore()

    expect(api.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(api.getMe).toHaveBeenCalledTimes(1)
    expect(session.isSignedIn).toBe(true)
    expect(session.user).toEqual(USER)
  })

  it('stays signed out when there is no refresh cookie', async () => {
    vi.mocked(api.refreshAccessToken).mockResolvedValue(null)
    const session = newStore()

    await session.restore()

    expect(session.isSignedIn).toBe(false)
    expect(session.user).toBeNull()
    expect(api.getMe).not.toHaveBeenCalled()
  })

  it('stays signed in without a name when the user cannot be loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(api.login).mockResolvedValue({ access_token: 'token' })
    vi.mocked(api.getMe).mockRejectedValue(new api.ApiError(500, 'internal', 'Oops'))
    const session = newStore()

    await session.signIn('demo@shop.test', 'demo-password')

    expect(session.isSignedIn).toBe(true)
    expect(session.user).toBeNull()
  })

  it('signs in with a token and the user', async () => {
    vi.mocked(api.login).mockResolvedValue({ access_token: 'token' })
    vi.mocked(api.getMe).mockResolvedValue(USER)
    const session = newStore()

    await session.signIn('demo@shop.test', 'demo-password')

    expect(api.login).toHaveBeenCalledWith('demo@shop.test', 'demo-password')
    expect(api.getAccessToken()).toBe('token')
    expect(session.token).toBe('token')
    expect(session.user).toEqual(USER)
  })

  it('does not sign in when the credentials are refused', async () => {
    vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, 'invalid_credentials', 'Wrong email or password.'))
    const session = newStore()

    await expect(session.signIn('demo@shop.test', 'wrong')).rejects.toMatchObject({ status: 401 })

    expect(session.isSignedIn).toBe(false)
  })

  it('forgets the user when the client ends the session', async () => {
    vi.mocked(api.login).mockResolvedValue({ access_token: 'token' })
    vi.mocked(api.getMe).mockResolvedValue(USER)
    const session = newStore()
    await session.signIn('demo@shop.test', 'demo-password')

    // The client does this when a refresh is refused.
    api.setAccessToken(null)

    expect(session.isSignedIn).toBe(false)
    expect(session.user).toBeNull()
  })

  it('signs out', async () => {
    vi.mocked(api.login).mockResolvedValue({ access_token: 'token' })
    vi.mocked(api.getMe).mockResolvedValue(USER)
    vi.mocked(api.logout).mockResolvedValue(undefined)
    const session = newStore()
    await session.signIn('demo@shop.test', 'demo-password')

    await session.signOut()

    expect(api.logout).toHaveBeenCalledTimes(1)
    expect(session.isSignedIn).toBe(false)
    expect(session.user).toBeNull()
  })

  it('signs out on this device even when the server call fails, and reports the error', async () => {
    vi.mocked(api.login).mockResolvedValue({ access_token: 'token' })
    vi.mocked(api.getMe).mockResolvedValue(USER)
    const failure = new api.ApiError(0, 'network', 'Offline')
    vi.mocked(api.logout).mockRejectedValue(failure)
    const session = newStore()
    await session.signIn('demo@shop.test', 'demo-password')

    await expect(session.signOut()).rejects.toBe(failure)

    expect(api.getAccessToken()).toBeNull()
    expect(session.isSignedIn).toBe(false)
    expect(session.user).toBeNull()
  })
})
