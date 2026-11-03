import { getResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  DecodeError,
  decodeCart,
  decodeErrorBody,
  decodeOrder,
  decodeOrders,
  decodeProduct,
  decodeProductList,
  decodeToken,
  decodeUser,
} from '@/api/decode'
import { CART, DEMO_USER, ORDERS, PRODUCTS } from '@/mocks/fixtures'
import { cartView, createHandlers, createMockState } from '@/mocks/handlers'

const product = PRODUCTS[0]!
const cart = cartView(createMockState())
const order = ORDERS[0]!

describe('decode', () => {
  it('accepts every fixture', () => {
    for (const p of PRODUCTS) expect(decodeProduct(p)).toEqual(p)
    expect(decodeOrders(ORDERS)).toEqual(ORDERS)
    expect(decodeUser(DEMO_USER)).toEqual(DEMO_USER)
    expect(cart.items).toHaveLength(CART.length)
    expect(decodeCart(cart)).toEqual(cart)
  })

  it('accepts what the mock handlers answer', async () => {
    const handlers = createHandlers()
    const origin = window.location.origin
    const get = async (path: string): Promise<unknown> => {
      const request = new Request(`${origin}${path}`, { headers: { Authorization: 'Bearer mock-access-token' } })
      const response = await getResponse(handlers, request)
      expect(response?.status, path).toBe(200)
      return response?.json()
    }

    decodeProductList(await get('/api/products?limit=12&offset=0'))
    decodeProduct(await get('/api/products/1'))
    decodeCart(await get('/api/cart'))
    decodeOrders(await get('/api/orders'))
    decodeOrder(await get('/api/orders/1'))
    decodeUser(await get('/auth/me'))
  })

  it('rejects cents that are not integers', () => {
    expect(() => decodeProduct({ ...product, price_cents: 12.95 })).toThrow(DecodeError)
    expect(() => decodeCart({ ...cart, total_cents: 11.65 })).toThrow('cart.total_cents is not an integer')
    expect(() => decodeCart({ ...cart, subtotal_cents: '1295' })).toThrow('cart.subtotal_cents is not an integer')
    expect(() => decodeProduct({ ...product, stock: Number.NaN })).toThrow('product.stock is not an integer')
  })

  it('rejects an unknown order status', () => {
    expect(() => decodeOrder({ ...order, status: 'refunded' })).toThrow('order.status')
    expect(() => decodeOrder({ ...order, status: undefined })).toThrow('order.status')
  })

  it('rejects an unknown coupon kind and accepts no coupon', () => {
    const coupon = { code: 'X', kind: 'bogus', value: 5 }

    expect(() => decodeCart({ ...cart, coupon })).toThrow("cart.coupon.kind is not 'percent' or 'fixed'")
    expect(decodeCart({ ...cart, coupon: null }).coupon).toBeNull()
    expect(decodeCart({ ...cart, coupon: { ...coupon, kind: 'fixed' } }).coupon).toEqual({
      code: 'X',
      kind: 'fixed',
      value: 5,
    })
  })

  it('says where a value is wrong', () => {
    expect(() => decodeProductList({ items: [product, { ...product, name: 3 }], total: 2, limit: 12, offset: 0 })).toThrow(
      'products.items[1].name is not a string',
    )
    expect(() => decodeOrders({})).toThrow('orders is not an array')
    expect(() => decodeCart(null)).toThrow('cart is not an object')
    expect(() => decodeCart({ ...cart, items: 'none' })).toThrow('cart.items is not an array')
    expect(() => decodeToken({ access_token: 1 })).toThrow('token.access_token is not a string')
  })

  it('reads the shared error body only when it has both parts', () => {
    expect(decodeErrorBody({ error: { code: 'not_found', message: 'Nope' } })).toEqual({
      error: { code: 'not_found', message: 'Nope' },
    })
    expect(decodeErrorBody({ error: { code: 'not_found' } })).toBeNull()
    expect(decodeErrorBody({ message: 'x' })).toBeNull()
    expect(decodeErrorBody('oops')).toBeNull()
    expect(decodeErrorBody(null)).toBeNull()
  })
})
