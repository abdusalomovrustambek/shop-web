// Wire types for shop-api (/api) and auth-gateway (/auth). Kept by hand to
// match shop-api's api/openapi.yaml: an interface here has the same name as
// the schema in components.schemas and every one of its fields
// (scripts/check-types.mjs checks this in CI). Money is integer cents.

export interface ErrorResponse {
  error: {
    code: string
    message: string
  }
}

export interface Product {
  id: number
  sku: string
  name: string
  description: string
  price_cents: number
  image_url: string
  stock: number
  created_at: string
}

export interface ProductList {
  items: Product[]
  total: number
  limit: number
  offset: number
}

export type CouponKind = 'percent' | 'fixed'

export interface Coupon {
  code: string
  kind: CouponKind
  /** Percent (10 = 10%) for 'percent', cents for 'fixed'. */
  value: number
}

export interface CartItem {
  product_id: number
  sku: string
  name: string
  image_url: string
  unit_price_cents: number
  quantity: number
  stock: number
}

export interface Cart {
  items: CartItem[]
  coupon: Coupon | null
  currency: string
  subtotal_cents: number
  discount_cents: number
  total_cents: number
}

export interface AddCartItemRequest {
  product_id: number
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

export interface Card {
  number: string
  exp_month: number
  exp_year: number
  cvc: string
}

export interface CheckoutRequest {
  currency: string
  card: Card
}

export type OrderStatus = 'pending' | 'paid' | 'failed'

export interface OrderItem {
  product_id: number
  name: string
  unit_price_cents: number
  quantity: number
}

export interface Order {
  id: number
  status: OrderStatus
  currency: string
  subtotal_cents: number
  total_cents: number
  coupon_code: string | null
  created_at: string
  items: OrderItem[]
}

export interface User {
  id: string
  email: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
}
