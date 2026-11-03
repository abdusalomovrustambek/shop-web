// Checks API responses at the boundary: a response that does not have the
// shape the app relies on fails here with a clear message, instead of
// breaking a page later.
import type {
  Cart,
  CartItem,
  Coupon,
  ErrorResponse,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductList,
  TokenResponse,
  User,
} from './types'

export class DecodeError extends Error {
  constructor(path: string, expected: string) {
    super(`Unexpected API response: ${path} is not ${expected}`)
    this.name = 'DecodeError'
  }
}

type Fields = Record<string, unknown>

function record(value: unknown, path: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DecodeError(path, 'an object')
  }
  return value as Fields
}

function str(fields: Fields, key: string, path: string): string {
  const value = fields[key]
  if (typeof value !== 'string') throw new DecodeError(`${path}.${key}`, 'a string')
  return value
}

function int(fields: Fields, key: string, path: string): number {
  const value = fields[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new DecodeError(`${path}.${key}`, 'an integer')
  }
  return value
}

function nullableStr(fields: Fields, key: string, path: string): string | null {
  return fields[key] === null || fields[key] === undefined ? null : str(fields, key, path)
}

function list<T>(fields: Fields, key: string, path: string, item: (value: unknown, path: string) => T): T[] {
  const value = fields[key]
  if (!Array.isArray(value)) throw new DecodeError(`${path}.${key}`, 'an array')
  return value.map((entry, i) => item(entry, `${path}.${key}[${i}]`))
}

export function decodeProduct(value: unknown, path = 'product'): Product {
  const f = record(value, path)
  return {
    id: int(f, 'id', path),
    sku: str(f, 'sku', path),
    name: str(f, 'name', path),
    description: str(f, 'description', path),
    price_cents: int(f, 'price_cents', path),
    image_url: str(f, 'image_url', path),
    stock: int(f, 'stock', path),
    created_at: str(f, 'created_at', path),
  }
}

export function decodeProductList(value: unknown, path = 'products'): ProductList {
  const f = record(value, path)
  return {
    items: list(f, 'items', path, decodeProduct),
    total: int(f, 'total', path),
    limit: int(f, 'limit', path),
    offset: int(f, 'offset', path),
  }
}

function decodeCoupon(value: unknown, path: string): Coupon | null {
  if (value === null || value === undefined) return null
  const f = record(value, path)
  const kind = f.kind
  if (kind !== 'percent' && kind !== 'fixed') throw new DecodeError(`${path}.kind`, "'percent' or 'fixed'")
  return { code: str(f, 'code', path), kind, value: int(f, 'value', path) }
}

function decodeCartItem(value: unknown, path: string): CartItem {
  const f = record(value, path)
  return {
    product_id: int(f, 'product_id', path),
    sku: str(f, 'sku', path),
    name: str(f, 'name', path),
    image_url: str(f, 'image_url', path),
    unit_price_cents: int(f, 'unit_price_cents', path),
    quantity: int(f, 'quantity', path),
    stock: int(f, 'stock', path),
  }
}

export function decodeCart(value: unknown, path = 'cart'): Cart {
  const f = record(value, path)
  return {
    items: list(f, 'items', path, decodeCartItem),
    coupon: decodeCoupon(f.coupon, `${path}.coupon`),
    currency: str(f, 'currency', path),
    subtotal_cents: int(f, 'subtotal_cents', path),
    discount_cents: int(f, 'discount_cents', path),
    total_cents: int(f, 'total_cents', path),
  }
}

function decodeOrderItem(value: unknown, path: string): OrderItem {
  const f = record(value, path)
  return {
    product_id: int(f, 'product_id', path),
    name: str(f, 'name', path),
    unit_price_cents: int(f, 'unit_price_cents', path),
    quantity: int(f, 'quantity', path),
  }
}

const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'paid', 'failed']

function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.some((status) => status === value)
}

export function decodeOrder(value: unknown, path = 'order'): Order {
  const f = record(value, path)
  if (!isOrderStatus(f.status)) throw new DecodeError(`${path}.status`, ORDER_STATUSES.join(' | '))
  return {
    id: int(f, 'id', path),
    status: f.status,
    currency: str(f, 'currency', path),
    subtotal_cents: int(f, 'subtotal_cents', path),
    total_cents: int(f, 'total_cents', path),
    coupon_code: nullableStr(f, 'coupon_code', path),
    created_at: str(f, 'created_at', path),
    items: list(f, 'items', path, decodeOrderItem),
  }
}

export function decodeOrders(value: unknown, path = 'orders'): Order[] {
  if (!Array.isArray(value)) throw new DecodeError(path, 'an array')
  return value.map((entry, i) => decodeOrder(entry, `${path}[${i}]`))
}

export function decodeUser(value: unknown, path = 'user'): User {
  const f = record(value, path)
  return { id: str(f, 'id', path), email: str(f, 'email', path), name: str(f, 'name', path) }
}

export function decodeToken(value: unknown, path = 'token'): TokenResponse {
  const f = record(value, path)
  return { access_token: str(f, 'access_token', path) }
}

/** Returns the error body when it has the shared shape, otherwise null. */
export function decodeErrorBody(value: unknown): ErrorResponse | null {
  if (typeof value !== 'object' || value === null) return null
  const error = (value as Fields).error
  if (typeof error !== 'object' || error === null) return null
  const { code, message } = error as Fields
  if (typeof code !== 'string' || typeof message !== 'string') return null
  return { error: { code, message } }
}
