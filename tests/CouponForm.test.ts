import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/client'
import type { Cart } from '@/api/types'
import CouponForm from '@/components/CouponForm.vue'
import { cartView, createMockState } from '@/mocks/handlers'

vi.mock(import('@/api/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  applyCoupon: vi.fn(),
}))

function mountForm() {
  // The real cart store, so the form is tested with the state it really uses.
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(CouponForm, { global: { plugins: [pinia] } })
}

const applied: Cart = {
  ...cartView(createMockState()),
  coupon: { code: 'WELCOME10', kind: 'percent', value: 10 },
}

beforeEach(() => {
  vi.mocked(api.applyCoupon).mockReset()
})

describe('CouponForm', () => {
  it('asks for a code when submitted empty, without calling the API', async () => {
    const wrapper = mountForm()

    await wrapper.get('input').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toBe('Enter a coupon code.')
    expect(api.applyCoupon).not.toHaveBeenCalled()
  })

  it('shows the API’s message when the coupon is refused', async () => {
    vi.mocked(api.applyCoupon).mockRejectedValueOnce(new api.ApiError(422, 'coupon_not_applicable', 'Coupon expired.'))
    const wrapper = mountForm()

    await wrapper.get('input').setValue('EXPIRED5')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.applyCoupon).toHaveBeenCalledWith('EXPIRED5')
    expect(wrapper.get('[role="alert"]').text()).toBe('Coupon expired.')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('EXPIRED5')
  })

  it('shows the message for an unknown coupon', async () => {
    vi.mocked(api.applyCoupon).mockRejectedValueOnce(new api.ApiError(422, 'coupon_not_found', 'Coupon not found.'))
    const wrapper = mountForm()

    await wrapper.get('input').setValue('NOPE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Coupon not found.')
  })

  it('clears the field and confirms the coupon on success', async () => {
    vi.mocked(api.applyCoupon).mockResolvedValueOnce(applied)
    const wrapper = mountForm()

    await wrapper.get('input').setValue(' welcome10 ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.applyCoupon).toHaveBeenCalledWith('welcome10')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Coupon WELCOME10 applied.')
  })
})
