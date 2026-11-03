// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { compareTypes, currentBranch, loadSpec, schemaFields, typeFields } from '../scripts/check-types.mjs'

const SPEC = parse(`
openapi: 3.1.0
components:
  schemas:
    Product:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        price_cents: { type: integer }
    Order:
      allOf:
        - $ref: '#/components/schemas/OrderBase'
        - type: object
          properties:
            discount_cents: { type: integer }
    OrderBase:
      type: object
      properties:
        id: { type: integer }
        total_cents: { type: integer }
    OrderStatus:
      type: string
      enum: [pending, paid, failed]
`)

const TYPES = `
export interface Product { id: number; name: string; price_cents: number }
interface Base { id: number }
export interface OrderBase extends Base { total_cents: number }
export type Order = OrderBase & { note?: string }
`

function response(status: number, body = ''): Response {
  return new Response(body, { status })
}

describe('check-types', () => {
  it('lists every schema field missing from types.ts', () => {
    const problems = compareTypes(schemaFields(SPEC), typeFields(TYPES))

    expect(problems).toEqual(['Order.discount_cents: missing from src/api/types.ts'])
  })

  it('reports a schema with no matching type', () => {
    const problems = compareTypes(schemaFields(SPEC), typeFields('export interface Product { id: number }'))

    expect(problems).toEqual([
      'Product.name: missing from src/api/types.ts',
      'Product.price_cents: missing from src/api/types.ts',
      'Order: no interface or type named Order in src/api/types.ts',
      'OrderBase: no interface or type named OrderBase in src/api/types.ts',
    ])
  })

  it('passes when every field is there', () => {
    const complete = `${TYPES}\nexport interface Order2 {}`.replace('{ note?: string }', '{ discount_cents: number }')

    expect(compareTypes(schemaFields(SPEC), typeFields(complete))).toEqual([])
  })

  it('reads the fields of the real src/api/types.ts', () => {
    const types = typeFields(readFileSync('src/api/types.ts', 'utf8'))

    expect(types.get('Cart')).toEqual(
      new Set(['items', 'coupon', 'currency', 'subtotal_cents', 'discount_cents', 'total_cents']),
    )
    expect(types.get('Order')?.has('discount_cents')).toBe(false)
  })

  it('uses the PR branch, then the pushed branch', () => {
    expect(currentBranch({ GITHUB_HEAD_REF: 'SHOP-7', GITHUB_REF_NAME: '12/merge' })).toBe('SHOP-7')
    expect(currentBranch({ GITHUB_HEAD_REF: '', GITHUB_REF_NAME: 'main' })).toBe('main')
  })

  it('reads the spec from the branch with the same name', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(200, 'openapi: 3.1.0'))

    const spec = await loadSpec({ GITHUB_HEAD_REF: 'SHOP-7' }, fetchImpl)

    expect(spec).toEqual({ source: 'abdusalomovrustambek/shop-api@SHOP-7:api/openapi.yaml', text: 'openapi: 3.1.0' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/abdusalomovrustambek/shop-api/SHOP-7/api/openapi.yaml',
      { headers: {} },
    )
  })

  it('falls back to main when shop-api has no such branch', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(200, 'openapi: 3.1.0'))

    const spec = await loadSpec({ GITHUB_HEAD_REF: 'SHOP-7', SHOP_API_REPO: 'acme/shop-api' }, fetchImpl)

    expect(spec.source).toBe('acme/shop-api@main:api/openapi.yaml')
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://raw.githubusercontent.com/acme/shop-api/main/api/openapi.yaml',
      { headers: {} },
    )
  })

  it('uses the GitHub API with a token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(200, 'openapi: 3.1.0'))

    await loadSpec({ GITHUB_REF_NAME: 'main', SHOP_API_TOKEN: 'secret' }, fetchImpl)

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/abdusalomovrustambek/shop-api/contents/api/openapi.yaml?ref=main',
      { headers: { Authorization: 'Bearer secret', Accept: 'application/vnd.github.raw+json' } },
    )
  })

  it('fails when the spec is nowhere, instead of passing silently', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(404))

    await expect(loadSpec({ GITHUB_HEAD_REF: 'SHOP-7' }, fetchImpl)).rejects.toThrow(
      'api/openapi.yaml was not found in abdusalomovrustambek/shop-api at SHOP-7 or main',
    )
  })

  it('fails on other HTTP errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(500))

    await expect(loadSpec({ GITHUB_REF_NAME: 'main' }, fetchImpl)).rejects.toThrow('HTTP 500')
  })
})
