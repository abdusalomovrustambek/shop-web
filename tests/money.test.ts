import { describe, expect, it } from 'vitest'
import { formatMoney } from '@/utils/money'

describe('formatMoney', () => {
  it('formats cents as dollars', () => {
    expect(formatMoney(1295, 'USD')).toBe('$12.95')
  })

  it('formats zero', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('formats negative amounts', () => {
    expect(formatMoney(-129, 'USD')).toBe('-$1.29')
  })

  it('formats large amounts with grouping', () => {
    expect(formatMoney(123456789, 'USD')).toBe('$1,234,567.89')
  })

  it('keeps exact cents where floating point would drift', () => {
    // 0.1 + 0.2 style amounts and values that are not exact in binary
    expect(formatMoney(30, 'USD')).toBe('$0.30')
    expect(formatMoney(1005, 'USD')).toBe('$10.05')
    expect(formatMoney(9007199254740991, 'USD')).toBe('$90,071,992,547,409.91')
  })

  it('uses the currency’s own minor units', () => {
    expect(formatMoney(1295, 'JPY')).toBe('¥1,295')
    expect(formatMoney(1295, 'EUR')).toBe('€12.95')
  })

  it('rejects amounts that are not integer cents', () => {
    expect(() => formatMoney(12.95, 'USD')).toThrow(RangeError)
    expect(() => formatMoney(Number.NaN, 'USD')).toThrow(RangeError)
  })
})
