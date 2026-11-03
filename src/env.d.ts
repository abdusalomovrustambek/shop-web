/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API and auth routes; empty means same origin. */
  readonly VITE_API_URL?: string
  /** '1' starts the MSW mock backend before the app mounts. */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
