import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/client'
import type { Product, ProductList } from '@/api/types'
import CatalogPage from '@/pages/CatalogPage.vue'
import { PRODUCTS } from '@/mocks/fixtures'

vi.mock(import('@/api/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
}))

interface Call {
  query: api.ProductQuery
  resolve: (list: ProductList) => void
  reject: (error: Error) => void
}

const calls: Call[] = []

function page(items: Product[], total = items.length, offset = 0): ProductList {
  return { items, total, limit: 12, offset }
}

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const empty = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'catalog', component: empty },
      { path: '/p/:id', name: 'product', component: empty },
    ],
  })
  await router.push('/')
  return mount(CatalogPage, { global: { plugins: [pinia, router] } })
}

/** Lets the debounce pass and the page's microtasks run. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await flushPromises()
}

function names(wrapper: Awaited<ReturnType<typeof mountPage>>): string[] {
  return wrapper.findAll('.product-card__name').map((node) => node.text())
}

beforeEach(() => {
  calls.length = 0
  // Like fetch, the mocked request rejects when the page aborts it.
  vi.mocked(api.listProducts).mockReset().mockImplementation(
    (query, signal) =>
      new Promise<ProductList>((resolve, reject) => {
        calls.push({ query, resolve, reject })
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
  )
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

const mug = PRODUCTS.filter((p) => p.name.includes('mug'))
const lamp = PRODUCTS.filter((p) => p.name.includes('lamp'))

describe('CatalogPage', () => {
  it('loads the first page', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Loading products')

    calls[0]?.resolve(page(PRODUCTS.slice(0, 3), 40))
    await settle()

    expect(calls[0]?.query).toEqual({ search: '', limit: 12, offset: 0 })
    expect(names(wrapper)).toEqual(PRODUCTS.slice(0, 3).map((p) => p.name))
  })

  it('keeps the newest search when an older response arrives last', async () => {
    const wrapper = await mountPage()
    calls[0]?.resolve(page(PRODUCTS.slice(0, 3), 40))
    await settle()

    await wrapper.get('#catalog-search').setValue('mug')
    await settle(300)
    await wrapper.get('#catalog-search').setValue('lamp')
    await settle(300)
    expect(calls.map((c) => c.query.search)).toEqual(['', 'mug', 'lamp'])

    calls[2]?.resolve(page(lamp))
    await settle()
    calls[1]?.resolve(page(mug))
    await settle()

    expect(names(wrapper)).toEqual(lamp.map((p) => p.name))
  })

  it('does not show an error for a request it replaced', async () => {
    const wrapper = await mountPage()
    calls[0]?.resolve(page(PRODUCTS.slice(0, 3), 40))
    await settle()

    await wrapper.get('#catalog-search').setValue('mug')
    await settle(300)
    await wrapper.get('#catalog-search').setValue('lamp')
    await settle(300)
    calls[2]?.resolve(page(lamp))
    await settle()

    expect(wrapper.find('.alert').exists()).toBe(false)
    expect(wrapper.find('.toast').exists()).toBe(false)
  })

  it('searches once after typing stops', async () => {
    const wrapper = await mountPage()
    calls[0]?.resolve(page(PRODUCTS.slice(0, 3), 40))
    await settle()

    for (const text of ['m', 'mu', 'mug']) {
      await wrapper.get('#catalog-search').setValue(text)
      await settle(100)
    }
    await settle(300)

    expect(calls.map((c) => c.query.search)).toEqual(['', 'mug'])
  })

  it('loads the next page after the ones shown and hides the button on the last page', async () => {
    const wrapper = await mountPage()
    calls[0]?.resolve(page(PRODUCTS.slice(0, 12), 14))
    await settle()
    expect(wrapper.text()).toContain('Load more')
    expect(wrapper.text()).toContain('Showing 12 of 14')

    await wrapper.get('button.button--secondary').trigger('click')
    expect(calls[1]?.query).toEqual({ search: '', limit: 12, offset: 12 })
    calls[1]?.resolve(page(PRODUCTS.slice(12, 14), 14, 12))
    await settle()

    expect(names(wrapper)).toHaveLength(14)
    expect(wrapper.text()).not.toContain('Load more')
  })

  it('shows an empty state with a way to clear the search', async () => {
    const wrapper = await mountPage()
    calls[0]?.resolve(page(PRODUCTS.slice(0, 3), 40))
    await settle()

    await wrapper.get('#catalog-search').setValue('zzz')
    await settle(300)
    calls[1]?.resolve(page([]))
    await settle()

    expect(wrapper.text()).toContain('No products found')
    expect(wrapper.text()).toContain('Nothing matches “zzz”.')
    await wrapper.get('.empty-state button').trigger('click')
    expect((wrapper.get('#catalog-search').element as HTMLInputElement).value).toBe('')
  })

  it('shows the error with a retry when the first load fails', async () => {
    const wrapper = await mountPage()

    calls[0]?.reject(new api.ApiError(0, 'network', 'Could not reach the server.'))
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not reach the server.')

    await wrapper.get('[role="alert"] button').trigger('click')
    calls[1]?.resolve(page(PRODUCTS.slice(0, 2), 2))
    await settle()

    expect(names(wrapper)).toHaveLength(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('aborts its request when it is unmounted', async () => {
    const wrapper = await mountPage()
    const signal = vi.mocked(api.listProducts).mock.calls[0]?.[1]

    wrapper.unmount()

    expect(signal?.aborted).toBe(true)
  })
})
