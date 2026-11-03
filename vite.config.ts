import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// In dev, /api and /auth can be proxied to a running auth-gateway, e.g.
// API_PROXY_TARGET=http://localhost:8080 pnpm dev. Mock mode needs no proxy.
const proxyTarget = process.env.API_PROXY_TARGET

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: proxyTarget
      ? {
          '/api': { target: proxyTarget, changeOrigin: true },
          '/auth': { target: proxyTarget, changeOrigin: true },
        }
      : undefined,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
})
