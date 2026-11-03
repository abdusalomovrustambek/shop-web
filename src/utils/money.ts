/** The currency catalog and cart prices are quoted in. */
export const STORE_CURRENCY = 'USD'

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    formatters.set(currency, formatter)
  }
  return formatter
}

/**
 * Formats an amount in minor units (cents for USD) for display. This is the
 * only place the app turns money into text. The amount is converted to a
 * decimal string with integer arithmetic, so no floating-point value is ever
 * formatted.
 */
export function formatMoney(cents: number, currency: string): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatMoney expects integer minor units, got ${cents}`)
  }
  const formatter = formatterFor(currency)
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  const unit = 10 ** digits
  const abs = Math.abs(cents)
  const fraction = abs % unit
  const whole = (abs - fraction) / unit
  const sign = cents < 0 ? '-' : ''
  const decimal = digits > 0 ? `${sign}${whole}.${String(fraction).padStart(digits, '0')}` : `${sign}${whole}`
  // The string is built above from integers only, so it is a valid numeric literal.
  return formatter.format(decimal as Intl.StringNumericLiteral)
}
