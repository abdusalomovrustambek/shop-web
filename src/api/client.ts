// HTTP client for shop-api (/api) and auth-gateway (/auth). Holds the access
// token in memory; the refresh token is an HttpOnly cookie set by the gateway.
// On a 401 it refreshes once (shared by concurrent requests) and retries once.
import {
  decodeCart,
  decodeErrorBody,
  decodeOrder,
  decodeOrders,
  decodeProduct,
  decodeProductList,
  decodeToken,
  decodeUser,
} from './decode'
import type {
  AddCartItemRequest,
  ApplyCouponRequest,
  Cart,
  CheckoutRequest,
  LoginRequest,
  Order,
  Product,
  ProductList,
  TokenResponse,
  UpdateCartItemRequest,
  User,
} from './types'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  /** status is 0 when the request did not reach the server. */
  constructor(status: number, code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Wraps any thrown value in an ApiError, keeping ApiErrors as they are. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return new ApiError(0, 'unknown', message, { cause: error })
}

let accessToken: string | null = null
let tokenListener: ((token: string | null) => void) | null = null
let refreshing: Promise<string | null> | null = null

/** Sets the in-memory access token (null signs out locally). */
export function setAccessToken(token: string | null): void {
  accessToken = token
  tokenListener?.(token)
}

export function getAccessToken(): string | null {
  return accessToken
}

/** The session store listens here so it sees refreshes and forced sign-outs. */
export function onAccessTokenChange(listener: ((token: string | null) => void) | null): void {
  tokenListener = listener
}

interface RequestOptions {
  body?: unknown
  signal?: AbortSignal
}

async function send(method: string, path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: options.signal,
    })
  } catch (error) {
    // An aborted request is not a failure; callers check their signal.
    if (options.signal?.aborted) throw error
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.', {
      cause: error,
    })
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch (error) {
    return new ApiError(response.status, 'http_error', `Request failed (${response.status})`, { cause: error })
  }
  const parsed = decodeErrorBody(body)
  if (parsed) return new ApiError(response.status, parsed.error.code, parsed.error.message)
  return new ApiError(response.status, 'http_error', `Request failed (${response.status})`)
}

/**
 * Asks the gateway for a new access token with the refresh cookie. Concurrent
 * callers share one request. Resolves to the new token, or null (and signs
 * out locally) when the refresh is refused or fails.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const response = await send('POST', '/auth/refresh', {})
      if (!response.ok) {
        setAccessToken(null)
        return null
      }
      const body: unknown = await response.json()
      const { access_token: token } = decodeToken(body)
      setAccessToken(token)
      return token
    } catch (error) {
      // Without a working refresh the user is signed out; the error is logged
      // so a broken gateway is visible in the console.
      console.warn('Session refresh failed', error)
      setAccessToken(null)
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function request<T>(
  method: string,
  path: string,
  decode: (value: unknown) => T,
  options: RequestOptions = {},
): Promise<T> {
  let response = await send(method, path, options)
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const token = await refreshAccessToken()
    if (token) {
      response = await send(method, path, options)
      // Still refused with a fresh token: the session is not usable.
      if (response.status === 401) setAccessToken(null)
    }
  }
  if (!response.ok) throw await errorFrom(response)
  const text = await response.text()
  let body: unknown
  try {
    body = text === '' ? undefined : JSON.parse(text)
  } catch (error) {
    throw new ApiError(response.status, 'bad_response', 'The server sent a response the app cannot read.', {
      cause: error,
    })
  }
  return decode(body)
}

const ignoreBody = (): void => undefined

export interface ProductQuery {
  search?: string
  limit: number
  offset: number
}

export function listProducts(query: ProductQuery, signal?: AbortSignal): Promise<ProductList> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
  const search = query.search?.trim()
  if (search) params.set('search', search)
  return request('GET', `/api/products?${params}`, decodeProductList, { signal })
}

export function getProduct(id: number, signal?: AbortSignal): Promise<Product> {
  return request('GET', `/api/products/${id}`, decodeProduct, { signal })
}

export function getCart(): Promise<Cart> {
  return request('GET', '/api/cart', decodeCart)
}

export function addCartItem(productId: number, quantity: number): Promise<Cart> {
  const body: AddCartItemRequest = { product_id: productId, quantity }
  return request('POST', '/api/cart/items', decodeCart, { body })
}

/** Quantity 0 removes the item. */
export function updateCartItem(productId: number, quantity: number): Promise<Cart> {
  const body: UpdateCartItemRequest = { quantity }
  return request('PATCH', `/api/cart/items/${productId}`, decodeCart, { body })
}

export function applyCoupon(code: string): Promise<Cart> {
  const body: ApplyCouponRequest = { code }
  return request('POST', '/api/cart/coupon', decodeCart, { body })
}

export function checkout(body: CheckoutRequest): Promise<Order> {
  return request('POST', '/api/checkout', decodeOrder, { body })
}

export function listOrders(signal?: AbortSignal): Promise<Order[]> {
  return request('GET', '/api/orders', decodeOrders, { signal })
}

export function getOrder(id: number, signal?: AbortSignal): Promise<Order> {
  return request('GET', `/api/orders/${id}`, decodeOrder, { signal })
}

export function login(email: string, password: string): Promise<TokenResponse> {
  const body: LoginRequest = { email, password }
  return request('POST', '/auth/login', decodeToken, { body })
}

export function logout(): Promise<void> {
  return request('POST', '/auth/logout', ignoreBody)
}

export function getMe(): Promise<User> {
  return request('GET', '/auth/me', decodeUser)
}
