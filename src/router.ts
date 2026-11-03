import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router'
import CartPage from '@/pages/CartPage.vue'
import CatalogPage from '@/pages/CatalogPage.vue'
import CheckoutPage from '@/pages/CheckoutPage.vue'
import OrderPage from '@/pages/OrderPage.vue'
import OrdersPage from '@/pages/OrdersPage.vue'
import ProductPage from '@/pages/ProductPage.vue'
import SignInPage from '@/pages/SignInPage.vue'
import { useSessionStore } from '@/stores/session'
import { parseId } from '@/utils/navigation'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const idProp = (route: RouteLocationNormalized) => ({ id: parseId(route.params.id) })

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'catalog', component: CatalogPage },
  { path: '/p/:id', name: 'product', component: ProductPage, props: idProp },
  { path: '/cart', name: 'cart', component: CartPage, meta: { requiresAuth: true } },
  { path: '/checkout', name: 'checkout', component: CheckoutPage, meta: { requiresAuth: true } },
  { path: '/orders', name: 'orders', component: OrdersPage, meta: { requiresAuth: true } },
  { path: '/orders/:id', name: 'order', component: OrderPage, props: idProp, meta: { requiresAuth: true } },
  { path: '/sign-in', name: 'sign-in', component: SignInPage },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  })

  router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth) return true
    const session = useSessionStore()
    await session.restore()
    if (session.isSignedIn) return true
    return { name: 'sign-in', query: { next: to.fullPath } }
  })

  return router
}
