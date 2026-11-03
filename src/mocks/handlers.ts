// An in-memory stand-in for shop-api and auth-gateway, used when the app runs
// with VITE_USE_MOCKS=1 (agnts previews). It answers every route the client
// calls and computes totals the way shop-api does (percent discounts round
// half up), so mock pages show the same numbers the real API would.
import { http, HttpResponse, type JsonBodyType } from 'msw'
import type { Cart, CartItem, ErrorResponse, Order, Product, ProductList, TokenResponse, User } from '@/api/types'
import { formatMoney, STORE_CURRENCY } from '@/utils/money'
import { CART, COUPONS, DEMO_PASSWORD, DEMO_USER, ORDERS, PRODUCTS, type MockCartLine, type MockCoupon } from './fixtures'

const ACCESS_TOKEN = 'mock-access-token'
const TEST_CARD_OK = '4242424242424242'
const TEST_CARD_DECLINED = '4000000000000002'
const CURRENCIES = ['USD', 'EUR', 'UZS']
const MAX_QUANTITY = 99
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

interface MockState {
  /** The preview starts signed in as the demo user. */
  signedIn: boolean
  products: Product[]
  cart: MockCartLine[]
  couponCode: string | null
  orders: Order[]
  nextOrderId: number
}

export function createMockState(): MockState {
  const orders = structuredClone(ORDERS)
  return {
    signedIn: true,
    products: structuredClone(PRODUCTS),
    cart: structuredClone(CART),
    couponCode: null,
    orders,
    nextOrderId: Math.max(0, ...orders.map((order) => order.id)) + 1,
  }
}

function ok<T extends JsonBodyType>(body: T, status = 200): Response {
  return HttpResponse.json(body, { status })
}

function fail(status: number, code: string, message: string): Response {
  return ok<ErrorResponse>({ error: { code, message } }, status)
}

function isAuthorized(state: MockState, request: Request): boolean {
  return state.signedIn && request.headers.get('Authorization') === `Bearer ${ACCESS_TOKEN}`
}

function unauthorized(): Response {
  return fail(401, 'unauthorized', 'Sign in to continue.')
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    // An unreadable body is treated like an empty one; validation reports it.
    return {}
  }
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/** shop-api's percent rule: (total * pct + 50) / 100 in integer cents, half up. */
export function percentOf(totalCents: number, percent: number): number {
  return Math.floor((totalCents * percent + 50) / 100)
}

function couponByCode(code: string): MockCoupon | undefined {
  return COUPONS.find((coupon) => coupon.code === code.trim().toUpperCase())
}

function cartItems(state: MockState): CartItem[] {
  return state.cart.flatMap((line) => {
    const product = state.products.find((p) => p.id === line.product_id)
    if (!product) return []
    return [
      {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        image_url: product.image_url,
        unit_price_cents: product.price_cents,
        quantity: line.quantity,
        stock: product.stock,
      },
    ]
  })
}

function discountFor(coupon: MockCoupon, items: CartItem[]): number {
  const base = items
    .filter((item) => coupon.only_for === null || coupon.only_for.includes(item.sku))
    .reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0)
  if (base === 0) return 0
  return coupon.kind === 'percent' ? percentOf(base, coupon.value) : Math.min(coupon.value, base)
}

/** Why a coupon cannot be used on these items, or null when it can. */
function couponProblem(coupon: MockCoupon, items: CartItem[], now: Date): string | null {
  if (coupon.expires_at !== null && new Date(coupon.expires_at) <= now) return 'Coupon expired.'
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0)
  if (subtotal < coupon.min_total_cents) {
    return `This coupon needs an order of at least ${formatMoney(coupon.min_total_cents, STORE_CURRENCY)}.`
  }
  if (discountFor(coupon, items) === 0) return 'This coupon does not apply to anything in your cart.'
  return null
}

export function cartView(state: MockState): Cart {
  const items = cartItems(state)
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0)
  const coupon = state.couponCode ? couponByCode(state.couponCode) : undefined
  const discount = coupon ? discountFor(coupon, items) : 0
  return {
    items,
    coupon: coupon ? { code: coupon.code, kind: coupon.kind, value: coupon.value } : null,
    currency: STORE_CURRENCY,
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: subtotal - discount,
  }
}

function parseIntParam(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback
  return Number.parseInt(value, 10)
}

export function createHandlers(state: MockState = createMockState()) {
  return [
    // auth-gateway
    http.post('/auth/login', async ({ request }) => {
      const body = await readObject(request)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (email !== DEMO_USER.email || body.password !== DEMO_PASSWORD) {
        return fail(401, 'invalid_credentials', 'Wrong email or password.')
      }
      state.signedIn = true
      return ok<TokenResponse>({ access_token: ACCESS_TOKEN })
    }),

    http.post('/auth/refresh', () => {
      if (!state.signedIn) return fail(401, 'no_session', 'No session.')
      return ok<TokenResponse>({ access_token: ACCESS_TOKEN })
    }),

    http.post('/auth/logout', () => {
      state.signedIn = false
      return new HttpResponse(null, { status: 204 })
    }),

    http.get('/auth/me', ({ request }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      return ok<User>(DEMO_USER)
    }),

    // shop-api: catalog
    http.get('/api/products', ({ request }) => {
      const url = new URL(request.url)
      const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
      const limit = Math.min(Math.max(parseIntParam(url.searchParams.get('limit'), DEFAULT_LIMIT), 1), MAX_LIMIT)
      const offset = parseIntParam(url.searchParams.get('offset'), 0)
      const matches = state.products.filter((product) => product.name.toLowerCase().includes(search))
      return ok<ProductList>({
        items: matches.slice(offset, offset + limit),
        total: matches.length,
        limit,
        offset,
      })
    }),

    http.get<{ id: string }>('/api/products/:id', ({ params }) => {
      const product = state.products.find((p) => String(p.id) === params.id)
      if (!product) return fail(404, 'not_found', 'Product not found.')
      return ok<Product>(product)
    }),

    // shop-api: cart
    http.get('/api/cart', ({ request }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      return ok<Cart>(cartView(state))
    }),

    http.post('/api/cart/items', async ({ request }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      const body = await readObject(request)
      const { product_id: productId, quantity } = body
      if (!isInt(productId) || !isInt(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        return fail(400, 'invalid_request', `Quantity must be between 1 and ${MAX_QUANTITY}.`)
      }
      const product = state.products.find((p) => p.id === productId)
      if (!product) return fail(404, 'not_found', 'Product not found.')
      const line = state.cart.find((l) => l.product_id === productId)
      const next = (line?.quantity ?? 0) + quantity
      if (next > product.stock) return fail(409, 'out_of_stock', `Only ${product.stock} left in stock.`)
      if (line) line.quantity = next
      else state.cart.push({ product_id: productId, quantity })
      return ok<Cart>(cartView(state))
    }),

    http.patch<{ productId: string }>('/api/cart/items/:productId', async ({ request, params }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      const { quantity } = await readObject(request)
      if (!isInt(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
        return fail(400, 'invalid_request', `Quantity must be between 0 and ${MAX_QUANTITY}.`)
      }
      const line = state.cart.find((l) => String(l.product_id) === params.productId)
      if (!line) return fail(404, 'not_found', 'That item is not in your cart.')
      const product = state.products.find((p) => p.id === line.product_id)
      if (product && quantity > product.stock) {
        return fail(409, 'out_of_stock', `Only ${product.stock} left in stock.`)
      }
      if (quantity === 0) state.cart = state.cart.filter((l) => l !== line)
      else line.quantity = quantity
      return ok<Cart>(cartView(state))
    }),

    http.post('/api/cart/coupon', async ({ request }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      const { code } = await readObject(request)
      if (typeof code !== 'string' || code.trim() === '') {
        return fail(400, 'invalid_request', 'Enter a coupon code.')
      }
      const coupon = couponByCode(code)
      if (!coupon) return fail(422, 'coupon_not_found', 'Coupon not found.')
      const problem = couponProblem(coupon, cartItems(state), new Date())
      if (problem) return fail(422, 'coupon_not_applicable', problem)
      state.couponCode = coupon.code
      return ok<Cart>(cartView(state))
    }),

    // shop-api: checkout and orders
    http.post('/api/checkout', async ({ request }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      const { currency, card } = await readObject(request)
      const number =
        typeof card === 'object' && card !== null ? (card as Record<string, unknown>).number : undefined
      if (typeof currency !== 'string' || !CURRENCIES.includes(currency)) {
        return fail(400, 'invalid_request', 'Unsupported currency.')
      }
      if (number !== TEST_CARD_OK && number !== TEST_CARD_DECLINED) {
        return fail(400, 'invalid_card', 'Only test cards are accepted.')
      }
      const cart = cartView(state)
      if (cart.items.length === 0) return fail(400, 'cart_empty', 'Your cart is empty.')
      const short = cart.items.find((item) => item.quantity > item.stock)
      if (short) return fail(409, 'out_of_stock', `Only ${short.stock} of ${short.name} left in stock.`)
      for (const item of cart.items) {
        const product = state.products.find((p) => p.id === item.product_id)
        if (product) product.stock -= item.quantity
      }
      const order: Order = {
        id: state.nextOrderId++,
        status: number === TEST_CARD_OK ? 'paid' : 'failed',
        currency,
        subtotal_cents: cart.subtotal_cents,
        total_cents: cart.total_cents,
        coupon_code: cart.coupon?.code ?? null,
        created_at: new Date().toISOString(),
        items: cart.items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          unit_price_cents: item.unit_price_cents,
          quantity: item.quantity,
        })),
      }
      state.orders = [order, ...state.orders]
      state.cart = []
      state.couponCode = null
      return ok<Order>(order, 201)
    }),

    http.get('/api/orders', ({ request }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      return ok<Order[]>(state.orders)
    }),

    http.get<{ id: string }>('/api/orders/:id', ({ request, params }) => {
      if (!isAuthorized(state, request)) return unauthorized()
      const order = state.orders.find((o) => String(o.id) === params.id)
      if (!order) return fail(404, 'not_found', 'Order not found.')
      return ok<Order>(order)
    }),
  ]
}

export const handlers = createHandlers()
