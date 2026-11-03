import type { LocationQueryValue } from 'vue-router'

/** Route ids are positive integers; anything else is null (shown as not found). */
export function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

/**
 * Returns `next` when it is a path on this site, otherwise '/'. Rejects
 * absolute and protocol-relative URLs, and backslashes and control
 * characters that browsers may turn into another host.
 */
export function safeRedirect(next: LocationQueryValue | LocationQueryValue[] | undefined): string {
  if (typeof next !== 'string') return '/'
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/'
  if ([...next].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) return '/'
  const base = 'https://shop.invalid'
  const url = new URL(next, base)
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : '/'
}
