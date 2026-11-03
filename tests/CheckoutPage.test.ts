import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/client'
import type { Order } from '@/api/types'
import CheckoutPage from '@/pages/CheckoutPage.vue'
import { cartView, createMockState } from '@/mocks/handlers'
import { ORDERS } from '@/mocks/fixtures'

vi.mock(import('@/api/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  getCart: vi.fn(),
  checkout: vi.fn(),
}))

const placed: Order = { ...ORDERS[0]!, id: 5 }

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const empty = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'catalog', component: empty },
      { path: '/checkout', name: 'checkout', component: empty },
      { path: '/orders/:id', name: 'order', component: empty },
    ],
  })
  await router.push('/checkout')
  const wrapper = mount(CheckoutPage, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router }
}

async function fill(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], card: Record<string, string>) {
  await wrapper.get('#card-number').setValue(card.number ?? '4242 4242 4242 4242')
  await wrapper.get('#card-expiry').setValue(card.expiry ?? '12/30')
  await wrapper.get('#card-cvc').setValue(card.cvc ?? '123')
}

beforeEach(() => {
  vi.mocked(api.getCart).mockReset().mockResolvedValue(cartView(createMockState()))
  vi.mocked(api.checkout).mockReset()
  // Only the clock is faked, so promises and DOM updates run as usual.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-15T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CheckoutPage', () => {
  it('shows the cart totals from the API', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.get('aside .summary').text()).toContain('$144.95')
  })

  it('sends the card and currency, then opens the order', async () => {
    vi.mocked(api.checkout).mockResolvedValue(placed)
    const { wrapper, router } = await mountPage()
    await fill(wrapper, { number: '4242-4242 4242 4242', expiry: '03 / 29', cvc: '4321' })
    await wrapper.get('#currency').setValue('EUR')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.checkout).toHaveBeenCalledWith({
      currency: 'EUR',
      card: { number: '4242424242424242', exp_month: 3, exp_year: 2029, cvc: '4321' },
    })
    expect(router.currentRoute.value.fullPath).toBe('/orders/5')
  })

  it.each(['5555 5555 5555 4444', '4242 4242 4242', ''])('sends no request for the card number "%s"', async (number) => {
    const { wrapper } = await mountPage()
    await fill(wrapper, { number })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.checkout).not.toHaveBeenCalled()
    expect(wrapper.get('#card-number-error').text()).toBe('Use a test card: 4242 4242 4242 4242.')
  })

  it('accepts the declined test card too', async () => {
    vi.mocked(api.checkout).mockResolvedValue({ ...placed, status: 'failed' })
    const { wrapper } = await mountPage()
    await fill(wrapper, { number: '4000 0000 0000 0002' })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.checkout).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a past month', '10/26', false],
    ['last year', '12/25', false],
    ['the current month', '11/26', true],
    ['next month', '12/26', true],
    ['next year', '01/27', true],
    ['month 13', '13/27', false],
    ['month 0', '00/27', false],
    ['a missing slash', '1127', false],
    ['one-digit parts', '1/27', false],
  ])('expiry %s (%s) is %s', async (_name, expiry, accepted) => {
    vi.mocked(api.checkout).mockResolvedValue(placed)
    const { wrapper } = await mountPage()
    await fill(wrapper, { expiry })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(vi.mocked(api.checkout).mock.calls.length).toBe(accepted ? 1 : 0)
    expect(wrapper.find('#card-expiry-error').exists()).toBe(!accepted)
  })

  it.each(['12', '12345', 'abc', ''])('rejects the CVC "%s"', async (cvc) => {
    const { wrapper } = await mountPage()
    await fill(wrapper, { cvc })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.checkout).not.toHaveBeenCalled()
    expect(wrapper.find('#card-cvc-error').exists()).toBe(true)
  })

  it('sends one checkout when the button is pressed twice', async () => {
    let finish: (order: Order) => void = () => undefined
    vi.mocked(api.checkout).mockReturnValue(
      new Promise<Order>((resolve) => {
        finish = resolve
      }),
    )
    const { wrapper } = await mountPage()
    await fill(wrapper, {})

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(api.checkout).toHaveBeenCalledTimes(1)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    finish(placed)
    await flushPromises()
    expect(api.checkout).toHaveBeenCalledTimes(1)
  })

  it('shows the API error and allows another try', async () => {
    vi.mocked(api.checkout)
      .mockRejectedValueOnce(new api.ApiError(409, 'out_of_stock', 'Only 1 of Cast iron skillet left in stock.'))
      .mockResolvedValueOnce(placed)
    const { wrapper } = await mountPage()
    await fill(wrapper, {})

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Only 1 of Cast iron skillet left in stock.')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.checkout).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows an empty state instead of the form when the cart is empty', async () => {
    vi.mocked(api.getCart).mockResolvedValue({ ...cartView(createMockState()), items: [] })
    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Nothing to check out')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
