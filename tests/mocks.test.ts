import { describe, expect, it } from 'vitest'
import { cartView, createMockState, percentOf } from '@/mocks/handlers'

describe('mock totals', () => {
  it('rounds percent discounts half up like shop-api', () => {
    expect(percentOf(1295, 10)).toBe(130)
    expect(percentOf(1294, 10)).toBe(129)
    expect(percentOf(1000, 25)).toBe(250)
  })

  it('gives 1.30 off and 11.65 for a 10% coupon on 12.95', () => {
    const state = createMockState()
    state.cart = [{ product_id: 1, quantity: 1 }]
    state.couponCode = 'WELCOME10'

    const cart = cartView(state)

    expect(cart.subtotal_cents).toBe(1295)
    expect(cart.discount_cents).toBe(130)
    expect(cart.total_cents).toBe(1165)
  })
})
