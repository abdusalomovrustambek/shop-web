// Seed data for mock mode, mirroring shop-api's seed: 40 products, the six
// coupons, a cart, a few orders and the demo user.
import type { CouponKind, Order, Product, User } from '@/api/types'

export const DEMO_USER: User = {
  id: '6f1c2a7e-3b4d-4e8f-9a01-2c3d4e5f6a7b',
  email: 'demo@shop.test',
  name: 'Demo Shopper',
}

export const DEMO_PASSWORD = 'demo-password'

export interface MockCoupon {
  code: string
  kind: CouponKind
  value: number
  min_total_cents: number
  expires_at: string | null
  /** SKUs the coupon applies to; null means the whole cart. */
  only_for: string[] | null
}

export interface MockCartLine {
  product_id: number
  quantity: number
}

type ProductSeed = [name: string, priceCents: number, stock: number, description: string]

const PRODUCT_SEEDS: ProductSeed[] = [
  ['Enamel camp mug', 1295, 24, 'A speckled enamel mug that goes from the campfire to the office desk.'],
  ['Canvas tote bag', 1800, 40, 'Heavy cotton canvas with an inside pocket and long handles.'],
  ['Ceramic pour-over set', 3450, 12, 'Dripper, carafe and two cups in matte stoneware.'],
  ['Wool beanie', 2200, 30, 'Soft merino rib knit in a relaxed fit.'],
  [
    'UltraLightTrekkingDaypackWithHydrationSleeve 28L',
    8900,
    8,
    'A 28-litre daypack with a hydration sleeve, hip belt and rain cover.',
  ],
  ['Desk lamp', 4900, 15, 'Adjustable arm, warm LED and a weighted steel base.'],
  ['Linen napkins, set of 4', 2400, 22, 'Stonewashed linen that gets softer with every wash.'],
  ['Notebook, dotted', 1450, 60, 'A5, 160 pages of 100 g paper that takes fountain pens.'],
  [
    'ThermoGuardDoubleWallVacuumInsulatedBottle 750 ml',
    3200,
    18,
    'Keeps drinks cold for 24 hours and hot for 12.',
  ],
  ['Cast iron skillet', 3900, 10, 'Pre-seasoned 26 cm skillet for stove, oven and fire.'],
  ['Bamboo cutting board', 2100, 3, 'End-grain bamboo with a juice groove.'],
  ['Scented candle', 1900, 0, 'Cedar and bergamot soy wax candle, 40 hours.'],
  ['Wireless earbuds', 7900, 25, 'Six hours per charge and a pocket-sized case.'],
  ['Phone stand', 1500, 50, 'Folding aluminium stand for phones and small tablets.'],
  ['Throw blanket', 5600, 9, 'Recycled wool blend, 130 × 170 cm.'],
  ['French press', 2900, 14, 'Borosilicate glass and stainless steel, 1 litre.'],
  ['Leather wallet', 4500, 20, 'Vegetable-tanned leather with six card slots.'],
  ['Travel adapter', 2500, 35, 'Works in 150 countries, with two USB-C ports.'],
  ['Sunglasses', 6500, 16, 'Polarised lenses in an acetate frame.'],
  ['Yoga mat', 3800, 12, 'Natural rubber, 4 mm, with a carry strap.'],
  ['Plant pot, large', 2700, 7, 'Glazed ceramic with a drainage hole and saucer.'],
  ['Kitchen scale', 2300, 28, 'Measures up to 5 kg in 1 g steps.'],
  ['Rain jacket', 9800, 6, 'Waterproof, breathable and packs into its own pocket.'],
  ['Wall clock', 3600, 11, 'Silent sweep movement, 30 cm oak face.'],
  ['Picnic blanket', 3300, 13, 'Water-resistant backing and a leather carry strap.'],
  ['Tea sampler', 1700, 45, 'Six loose-leaf teas from small farms.'],
  ['Bike light set', 2800, 19, 'USB-rechargeable front and rear lights.'],
  ['Running socks, 3 pairs', 1600, 70, 'Cushioned soles and a seamless toe.'],
  ['Chef knife', 6900, 8, '20 cm blade in Japanese stainless steel.'],
  ['Board game', 4200, 10, 'A cooperative game for two to five players.'],
  ['Hand cream', 1200, 55, 'Shea butter and oat, 75 ml.'],
  ['Laptop sleeve', 3100, 21, 'Padded felt sleeve for 13–14 inch laptops.'],
  ['Hammock', 5400, 5, 'Parachute nylon with tree straps included.'],
  ['Spice set', 2600, 17, 'Twelve spices in glass jars with a wooden rack.'],
  ['Bluetooth speaker', 5900, 13, 'Splash-proof with 12 hours of play.'],
  ['Cotton bathrobe', 6200, 9, 'Waffle-weave cotton, one size.'],
  ['Watering can', 2000, 14, 'Powder-coated steel, 1.5 litres.'],
  ['Puzzle, 1000 pieces', 2200, 23, 'A mountain lake at dawn.'],
  ['Pocket knife', 3500, 12, 'Locking blade and a walnut handle.'],
  ['Weekend duffel', 11900, 4, 'Waxed canvas duffel with leather trim, 45 litres.'],
]

export const PRODUCTS: Product[] = PRODUCT_SEEDS.map(([name, priceCents, stock, description], index) => {
  const id = index + 1
  return {
    id,
    sku: `SKU-${String(id).padStart(4, '0')}`,
    name,
    description,
    price_cents: priceCents,
    image_url: `/images/products/${id}.svg`,
    stock,
    created_at: new Date(Date.UTC(2026, 9, 1 + (index % 28), 9, 0, 0)).toISOString(),
  }
})

export const COUPONS: MockCoupon[] = [
  { code: 'WELCOME10', kind: 'percent', value: 10, min_total_cents: 0, expires_at: null, only_for: null },
  {
    code: 'BLACKFRIDAY',
    kind: 'percent',
    value: 30,
    min_total_cents: 5000,
    expires_at: '2027-12-01T00:00:00Z',
    only_for: null,
  },
  { code: 'FREESHIP', kind: 'fixed', value: 500, min_total_cents: 3000, expires_at: null, only_for: null },
  {
    code: 'VIP25',
    kind: 'percent',
    value: 25,
    min_total_cents: 0,
    expires_at: null,
    only_for: ['SKU-0005', 'SKU-0013', 'SKU-0023', 'SKU-0040'],
  },
  { code: 'EXPIRED5', kind: 'percent', value: 5, min_total_cents: 0, expires_at: '2025-01-01T00:00:00Z', only_for: null },
  { code: 'TEAM50', kind: 'percent', value: 50, min_total_cents: 20000, expires_at: null, only_for: null },
]

export const CART: MockCartLine[] = [
  { product_id: 1, quantity: 1 },
  { product_id: 3, quantity: 2 },
  { product_id: 7, quantity: 1 },
  { product_id: 10, quantity: 1 },
]

export const ORDERS: Order[] = [
  {
    id: 3,
    status: 'pending',
    currency: 'USD',
    subtotal_cents: 6400,
    total_cents: 6400,
    coupon_code: null,
    created_at: '2026-10-30T16:45:00Z',
    items: [
      { product_id: 18, name: 'Travel adapter', unit_price_cents: 2500, quantity: 1 },
      { product_id: 10, name: 'Cast iron skillet', unit_price_cents: 3900, quantity: 1 },
    ],
  },
  {
    id: 2,
    status: 'paid',
    currency: 'USD',
    subtotal_cents: 10800,
    total_cents: 10300,
    coupon_code: 'FREESHIP',
    created_at: '2026-10-21T11:02:00Z',
    items: [
      { product_id: 13, name: 'Wireless earbuds', unit_price_cents: 7900, quantity: 1 },
      { product_id: 16, name: 'French press', unit_price_cents: 2900, quantity: 1 },
    ],
  },
  {
    id: 1,
    status: 'paid',
    currency: 'USD',
    subtotal_cents: 1295,
    total_cents: 1165,
    coupon_code: 'WELCOME10',
    created_at: '2026-10-12T08:30:00Z',
    items: [{ product_id: 1, name: 'Enamel camp mug', unit_price_cents: 1295, quantity: 1 }],
  },
]
