import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import * as api from '@/api/client'
import type { User } from '@/api/types'
import SignInPage from '@/pages/SignInPage.vue'
import { createAppRouter } from '@/router'
import { safeRedirect } from '@/utils/navigation'

vi.mock(import('@/api/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  refreshAccessToken: vi.fn(),
  getMe: vi.fn(),
  login: vi.fn(),
}))

const USER: User = { id: 'u-1', email: 'demo@shop.test', name: 'Demo' }

let pinia: Pinia

function signedOut(): void {
  vi.mocked(api.refreshAccessToken).mockResolvedValue(null)
}

function signedIn(): void {
  vi.mocked(api.refreshAccessToken).mockImplementation(async () => {
    api.setAccessToken('token')
    return 'token'
  })
  vi.mocked(api.getMe).mockResolvedValue(USER)
}

beforeEach(() => {
  // jsdom does not implement scrolling, which the router's scrollBehavior calls.
  vi.stubGlobal('scrollTo', vi.fn())
  api.setAccessToken(null)
  vi.mocked(api.refreshAccessToken).mockReset()
  vi.mocked(api.getMe).mockReset()
  vi.mocked(api.login).mockReset()
  pinia = createPinia()
  setActivePinia(pinia)
})

describe('router guard', () => {
  it.each(['/cart', '/checkout', '/orders', '/orders/1'])('sends a signed-out visitor from %s to sign-in', async (path) => {
    signedOut()
    const router = createAppRouter(createMemoryHistory())

    await router.push(path)

    expect(router.currentRoute.value.name).toBe('sign-in')
    expect(router.currentRoute.value.query.next).toBe(path)
    expect(api.refreshAccessToken).toHaveBeenCalledTimes(1)
  })

  it.each(['/cart', '/checkout', '/orders', '/orders/1'])('lets a signed-in user open %s', async (path) => {
    signedIn()
    const router = createAppRouter(createMemoryHistory())

    await router.push(path)

    expect(router.currentRoute.value.fullPath).toBe(path)
  })

  it.each(['/', '/p/1', '/sign-in'])('never redirects from the public route %s', async (path) => {
    signedOut()
    const router = createAppRouter(createMemoryHistory())

    await router.push(path)

    expect(router.currentRoute.value.fullPath).toBe(path)
    expect(api.refreshAccessToken).not.toHaveBeenCalled()
  })

  it('passes a bad id to the page as null', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/p/abc')

    const props = router.currentRoute.value.matched[0]?.props.default
    expect(typeof props === 'function' ? props(router.currentRoute.value) : null).toEqual({ id: null })
  })
})

describe('safeRedirect', () => {
  it.each([
    ['/orders/1', '/orders/1'],
    ['/cart?step=2#summary', '/cart?step=2#summary'],
    ['https://evil.example/', '/'],
    ['//evil.example/', '/'],
    ['/\\evil.example', '/'],
    ['\\\\evil.example', '/'],
    ['/\t/evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['orders', '/'],
    ['', '/'],
    [null, '/'],
    [undefined, '/'],
  ])('maps %j to %j', (next, expected) => {
    expect(safeRedirect(next)).toBe(expected)
  })

  it('ignores a repeated next parameter', () => {
    expect(safeRedirect(['/cart', '/orders'])).toBe('/')
  })
})

describe('sign-in redirect', () => {
  async function signInWith(next: string): Promise<string> {
    signedOut()
    vi.mocked(api.login).mockResolvedValue({ access_token: 'token' })
    vi.mocked(api.getMe).mockResolvedValue(USER)
    const router = createAppRouter(createMemoryHistory())
    await router.push({ name: 'sign-in', query: { next } })
    const wrapper = mount(SignInPage, { global: { plugins: [pinia, router] } })

    await wrapper.get('#sign-in-email').setValue('demo@shop.test')
    await wrapper.get('#sign-in-password').setValue('demo-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.login).toHaveBeenCalledWith('demo@shop.test', 'demo-password')
    return router.currentRoute.value.fullPath
  }

  it('returns to the page the user came from', async () => {
    await expect(signInWith('/orders/1')).resolves.toBe('/orders/1')
  })

  it('ignores an off-site next and goes home', async () => {
    await expect(signInWith('https://evil.example/steal')).resolves.toBe('/')
    await expect(signInWith('//evil.example')).resolves.toBe('/')
  })
})
