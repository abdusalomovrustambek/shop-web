import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  applyCoupon,
  login,
  getAccessToken,
  getCart,
  listOrders,
  onAccessTokenChange,
  setAccessToken,
} from '@/api/client'
import { cartView, createMockState } from '@/mocks/handlers'

const CART = cartView(createMockState())

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function authHeader(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  setAccessToken(null)
  onAccessTokenChange(null)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('sends the bearer token and the refresh cookie', async () => {
    setAccessToken('token-1')
    fetchMock.mockResolvedValueOnce(json(200, CART))

    await expect(getCart()).resolves.toEqual(CART)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/cart')
    expect(authHeader(init)).toBe('Bearer token-1')
    expect(init?.credentials).toBe('include')
  })

  it('refreshes once on a 401 and retries with the new token', async () => {
    setAccessToken('expired')
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'Expired' } }))
      .mockResolvedValueOnce(json(200, { access_token: 'fresh' }))
      .mockResolvedValueOnce(json(200, CART))

    await expect(getCart()).resolves.toEqual(CART)

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/cart', '/auth/refresh', '/api/cart'])
    expect(authHeader(fetchMock.mock.calls[2]?.[1])).toBe('Bearer fresh')
    expect(getAccessToken()).toBe('fresh')
  })

  it('shares one refresh between concurrent 401s', async () => {
    setAccessToken('expired')
    let finishRefresh: (response: Response) => void = () => undefined
    fetchMock.mockImplementation((url, init) => {
      if (url === '/auth/refresh') {
        return new Promise<Response>((resolve) => {
          finishRefresh = resolve
        })
      }
      if (authHeader(init) !== 'Bearer fresh') return Promise.resolve(json(401, {}))
      return Promise.resolve(url === '/api/orders' ? json(200, []) : json(200, CART))
    })

    const cart = getCart()
    const orders = listOrders()
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === '/auth/refresh')).toHaveLength(1))
    finishRefresh(json(200, { access_token: 'fresh' }))

    await expect(cart).resolves.toEqual(CART)
    await expect(orders).resolves.toEqual([])
    expect(fetchMock.mock.calls.filter(([url]) => url === '/auth/refresh')).toHaveLength(1)
  })

  it('signs out without looping when the retry is refused too', async () => {
    const listener = vi.fn()
    onAccessTokenChange(listener)
    setAccessToken('expired')
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { access_token: 'fresh' }))
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'Nope' } }))

    await expect(getCart()).rejects.toMatchObject({ status: 401, code: 'unauthorized' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getAccessToken()).toBeNull()
    expect(listener).toHaveBeenLastCalledWith(null)
  })

  it('signs out when the refresh is refused', async () => {
    const listener = vi.fn()
    onAccessTokenChange(listener)
    setAccessToken('expired')
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'Sign in' } }))
      .mockResolvedValueOnce(json(401, { error: { code: 'no_session', message: 'No session' } }))

    await expect(getCart()).rejects.toMatchObject({ status: 401 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getAccessToken()).toBeNull()
    expect(listener).toHaveBeenLastCalledWith(null)
  })

  it('does not refresh when a sign-in attempt is refused', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { error: { code: 'invalid_credentials', message: 'Wrong email or password.' } }),
    )

    await expect(login('demo@shop.test', 'wrong')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/auth/login')
  })

  it('maps the API error body to ApiError', async () => {
    setAccessToken('token-1')
    fetchMock.mockResolvedValueOnce(json(422, { error: { code: 'coupon_expired', message: 'Coupon expired.' } }))

    const error = await applyCoupon('EXPIRED5').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'coupon_expired', message: 'Coupon expired.' })
  })

  it('gives a generic ApiError for a body that is not the error shape', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))

    await expect(getCart()).rejects.toMatchObject({ status: 502, code: 'http_error' })
  })

  it('turns a network failure into an ApiError with status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(getCart()).rejects.toMatchObject({ status: 0, code: 'network' })
  })

  it('rejects a response that does not have the expected shape', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { items: 'nope' }))

    await expect(getCart()).rejects.toThrow('Unexpected API response: cart.items is not an array')
  })
})
