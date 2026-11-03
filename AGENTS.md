# AGENTS.md — shop-web

The storefront of **Shop**: a Vue 3 single-page app (catalog, product, cart,
checkout, orders, sign-in) on top of shop-api (`/api`) and auth-gateway
(`/auth`). See `Implementation plan.md` for the whole picture.

## Stack

- Vue 3 with `<script setup lang="ts">` and the Composition API, Pinia, Vue Router.
- Vite, TypeScript (strict), Vitest + Vue Test Utils, ESLint flat config.
- No UI kit and no CSS framework: three plain CSS files in `src/styles/`.
- Node 22 (`.nvmrc`), pnpm (`packageManager` in `package.json`).

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev                    # needs a backend; see "Running" below
VITE_USE_MOCKS=1 pnpm dev   # no backend at all
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check-types            # src/api/types.ts against shop-api's api/openapi.yaml
```

Run `lint`, `typecheck`, `test` and `build` before you hand in a change, and
`check-types` when you touch `src/api/types.ts`. There is no CI workflow in this
repository.

## Layout and where logic goes

| Path | Owns | Does not do |
|---|---|---|
| `src/api/types.ts` | wire types, snake_case, same names as shop-api's schemas | logic |
| `src/api/decode.ts` | checks response shapes at the boundary | anything else |
| `src/api/client.ts` | HTTP: base URL, bearer token, one refresh + retry on 401, `ApiError`, one function per endpoint | UI state |
| `src/stores/` | app state (`session`, `cart`, `toast`); actions call the client | DOM, formatting |
| `src/router.ts` | routes and the sign-in guard | data fetching |
| `src/pages/` | route-level loading, error and empty states; composes components | raw `fetch` |
| `src/components/` | presentational pieces, props in, events out (`CouponForm` uses the cart store) | routing decisions |
| `src/utils/money.ts` | `formatMoney(cents, currency)` | — |
| `src/utils/navigation.ts` | `parseId`, `safeRedirect` | — |
| `src/mocks/` | MSW handlers and fixtures for mock mode | being imported by app code other than `main.ts` |
| `src/styles/` | `tokens.css` (custom properties), `base.css`, `components.css` | — |

## Rules

- **Money** arrives from the API as integer cents. Show it only through
  `formatMoney` (or `PriceTag`, which wraps it). Never compute a price, discount
  or total the API also computes: show the API's `subtotal_cents`,
  `discount_cents` and `total_cents`.
- **API types**: an API change updates `src/api/types.ts` (the interface has the
  same name as the schema in shop-api's `components.schemas`), `src/api/decode.ts`
  and the mocks in `src/mocks/`. `pnpm check-types` fails when a field is missing.
- **Errors**: client functions throw `ApiError` (`status`, `code`, `message`;
  `status` 0 means the server was not reached). Pages show `message` inline or in a
  toast (`useToastStore().error`) and keep working. A 404 shows `EmptyState`.
- **Auth**: the access token lives in memory only (`client.ts`); the refresh token
  is an HttpOnly cookie the gateway sets. Routes with `meta.requiresAuth` send
  signed-out users to `/sign-in?next=…`; only `safeRedirect(next)` may decide
  where to go after sign-in.
- **Async in components**: requests started by a page are aborted or ignored when
  the input changes or the page unmounts (see `CatalogPage.vue`).
- **Layout**: responsive from 360 px. Use the tokens in `tokens.css` instead of new
  colors or sizes.
- **Tests** live in `tests/`, one file per unit (`money`, `client`, `cart.store`,
  `CouponForm`, `router`, `check-types`, `mocks`). Mock `@/api/client` with
  `vi.mock(import('@/api/client'), …)` and keep the real stores.

## Running

- **Mock mode** (`VITE_USE_MOCKS=1`): MSW starts in the browser before the app
  mounts and answers every route from in-memory state seeded from
  `src/mocks/fixtures.ts`. The app is signed in as `demo@shop.test` automatically;
  after signing out, sign back in with `demo@shop.test` / `demo-password`.
  Test cards: `4242 4242 4242 4242` (paid) and `4000 0000 0000 0002` (declined).
- **Real backend**: `VITE_API_URL` is the origin of `/api` and `/auth` (empty means
  same origin, as in production behind auth-gateway). In dev, proxy both to a
  running gateway with `API_PROXY_TARGET=http://localhost:8080 pnpm dev`.
- Product images are SVG placeholders in `public/images/products/<id>.svg`, the
  paths shop-api's seed uses.
