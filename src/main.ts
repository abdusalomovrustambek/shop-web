import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createAppRouter } from './router'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

async function startMocks(): Promise<void> {
  // VITE_USE_MOCKS is replaced at build time, so without it the mocks are
  // not part of the bundle.
  if (import.meta.env.VITE_USE_MOCKS !== '1') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

async function bootstrap(): Promise<void> {
  await startMocks()
  const app = createApp(App)
  app.use(createPinia())
  app.use(createAppRouter())
  app.mount('#app')
}

bootstrap().catch((error: unknown) => {
  console.error('shop-web failed to start', error)
})
