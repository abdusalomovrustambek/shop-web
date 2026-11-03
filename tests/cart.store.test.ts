import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/client'
import type { Cart } from '@/api/types'
import { cartView, createMockState } from '@/mocks/handlers'
import { useCartStore } from '@/stores/cart'

vi.mock(import('@/api/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  getCart: vi.fn(),
  addCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  applyCoupon: vi.fn(),
}))

function cart(overrides: Partial<Cart> = {}): Cart {
  return { ...cartView(createMockState()), ...overrides }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(api.getCart).mockReset()
  vi.mocked(api.addCartItem).mockReset()
  vi.mocked(api.updateCartItem).mockReset()
  vi.mocked(api.applyCoupon).mockReset()
})

describe('cart store', () => {
  it('loads the cart and counts the items by quantity', async () => {
    const loaded = cart()
    vi.mocked(api.getCart).mockResolvedValueOnce(loaded)
    const store = useCartStore()

    await store.load()

    expect(store.cart).toEqual(loaded)
    // Fixture: mug ×1, pour-over set ×2, napkins ×1, skillet ×1
    expect(store.count).toBe(5)
    expect(store.isEmpty).toBe(false)
  })

  it('takes totals from the API response after a quantity change', async () => {
    const store = useCartStore()
    vi.mocked(api.getCart).mockResolvedValueOnce(cart())
    await store.load()
    // Deliberately not the sum of the items: the store must not recompute.
    const fromApi = cart({ subtotal_cents: 111, discount_cents: 11, total_cents: 100 })
    vi.mocked(api.updateCartItem).mockResolvedValueOnce(fromApi)

    await store.setQuantity(3, 1)

    expect(api.updateCartItem).toHaveBeenCalledWith(3, 1)
    expect(store.cart?.subtotal_cents).toBe(111)
    expect(store.cart?.discount_cents).toBe(11)
    expect(store.cart?.total_cents).toBe(100)
  })

  it('takes the discount from the API response when a coupon applies', async () => {
    const store = useCartStore()
    const withCoupon = cart({
      coupon: { code: 'WELCOME10', kind: 'percent', value: 10 },
      discount_cents: 1234,
      total_cents: 4321,
    })
    vi.mocked(api.applyCoupon).mockResolvedValueOnce(withCoupon)

    await store.applyCoupon('WELCOME10')

    expect(api.applyCoupon).toHaveBeenCalledWith('WELCOME10')
    expect(store.cart).toEqual(withCoupon)
  })

  it('keeps the cart and exposes the error when a request fails', async () => {
    const store = useCartStore()
    const loaded = cart()
    vi.mocked(api.getCart).mockResolvedValueOnce(loaded)
    await store.load()
    const refused = new api.ApiError(422, 'coupon_expired', 'Coupon expired.')
    vi.mocked(api.applyCoupon).mockRejectedValueOnce(refused)

    await expect(store.applyCoupon('EXPIRED5')).rejects.toBe(refused)

    expect(store.cart).toEqual(loaded)
    expect(store.error).toBe(refused)
    expect(store.loading).toBe(false)
  })

  it('clears the previous error on the next request', async () => {
    const store = useCartStore()
    vi.mocked(api.getCart).mockRejectedValueOnce(new api.ApiError(0, 'network', 'Offline'))
    await expect(store.load()).rejects.toBeInstanceOf(api.ApiError)
    vi.mocked(api.getCart).mockResolvedValueOnce(cart())

    await store.load()

    expect(store.error).toBeNull()
  })

  it('adds items and resets', async () => {
    const store = useCartStore()
    vi.mocked(api.addCartItem).mockResolvedValueOnce(cart())

    await store.addItem(1, 2)
    expect(api.addCartItem).toHaveBeenCalledWith(1, 2)

    store.reset()
    expect(store.cart).toBeNull()
    expect(store.count).toBe(0)
  })
})
