# shop-web — Implementation Plan

Nov 3, 2026 · draft · @Rustam

## Overview

shop-web is the storefront of **Shop**, the demo store for agnts. It is a Vue 3 single-page app: catalog, product page, cart, checkout, orders and sign-in. It exists to show what agnts does for frontend work: **visual previews** (before/after screenshots at desktop and phone width, before anything is approved) and **multi-repo tickets** where one change spans the API and the UI.

**The Shop system**

| Repo | What it is | Stack |
|---|---|---|
| shop-api | Catalog, cart, coupons, orders, checkout | Go, PostgreSQL |
| **shop-web** (this) | Storefront | Vue 3, Vite, TypeScript |
| billing-worker | Charges orders, writes invoices | Go, PostgreSQL |
| auth-gateway | Sign-in, JWTs, rate limits, access log, static files, proxy | Go (Gin) |

In production auth-gateway serves the built files at `https://shop.agnts.uz` and proxies `/api` to shop-api (see shop-api's plan, Deploy).

**In scope:** the pages below, a typed API client, a mock mode for previews, tests, CI.
**Out of scope:** SSR, i18n, a sign-up page (the shopper registers accounts through the API), payments UI beyond a fake card form, an admin area.

**Principles**

1. Plain Vue: Composition API, `<script setup lang="ts">`, Pinia, Vue Router. No UI kit; one small set of CSS files, so a visual bug is in code a reviewer can read.
2. Money arrives as integer cents from the API and is formatted in one place (`formatMoney`). The web app never computes a price the API also computes (WEB-3 is the exception, planted).
3. The app runs with no backend at all (`VITE_USE_MOCKS=1`): previews in agnts's run container must render real-looking pages.
4. Responsive from 360 px up; the planted bugs are the only layout faults.

## Layout

```
shop-web/
  src/
    main.ts, App.vue, router.ts
    api/client.ts             fetch wrapper: base URL, bearer token, error type
    api/types.ts              types matching shop-api's openapi.yaml (hand-kept, checked in CI)
    stores/session.ts         token, user, sign-in/out (auth-gateway)
    stores/cart.ts            cart, coupon, totals from the API
    pages/                    CatalogPage, ProductPage, CartPage, CheckoutPage, OrdersPage, OrderPage, SignInPage
    components/               AppHeader, ProductCard, PriceTag, QuantityStepper, CouponForm, OrderSummary, EmptyState, Toast
    styles/                   tokens.css (colors, spacing, type), base.css, components.css
    utils/money.ts            formatMoney(cents, currency)
    mocks/                    MSW handlers and fixtures (products, cart, orders, user)
  public/                     favicon, product images (the API seed points at them)
  scripts/check-types.mjs     compares api/types.ts with shop-api's openapi.yaml
  tests/                      Vitest unit and component tests
  AGENTS.md                   conventions for coding agents
  .nvmrc (22), vite.config.ts, tsconfig.json, eslint.config.js, package.json ("engines": {"node": ">=22"}), pnpm-lock.yaml
  .github/workflows/ci.yml
```

agnts detects `node@22` from `engines` and `pnpm` from the lockfile, and the `lint`, `typecheck`, `test` and `build` scripts.

## Pages

| Route | Page | Data |
|---|---|---|
| `/` | Catalog: search box, product grid, "Load more" | `GET /api/products` |
| `/p/:id` | Product: image, price, stock, quantity, Add to cart | `GET /api/products/{id}` |
| `/cart` | Cart: items with steppers, coupon form, summary, Checkout | `GET /api/cart`, `PATCH`, `POST /api/cart/coupon` |
| `/checkout` | Fake card form (test cards only), currency, Place order | `POST /api/checkout` |
| `/orders` | My orders | `GET /api/orders` |
| `/orders/:id` | Order: items, subtotal, total, status | `GET /api/orders/{id}` |
| `/sign-in` | Email and password | `POST /auth/login` |

The header shows the cart count and the user's menu. Signed-out users who open `/cart`, `/checkout` or `/orders` go to `/sign-in?next=…`. The access token lives in memory with the refresh token in an HttpOnly cookie set by the gateway; `client.ts` refreshes once on a 401 and retries.

## Mock mode

`VITE_USE_MOCKS=1` starts MSW in the browser before the app mounts. Handlers in `src/mocks/` implement every route the app calls with in-memory state seeded from fixtures (the same 40 products and coupons as the API seed), and sign the user in as `demo@shop.test`. This is what agnts's preview uses, so the preview needs no network, no egress rule and no running API.

## Preview settings in agnts

| Setting | Value |
|---|---|
| Preview command | `pnpm install --frozen-lockfile && VITE_USE_MOCKS=1 pnpm dev --host 127.0.0.1 --port 4173` |
| Port / ready path | `4173` / `/` |
| Pinned routes | `/`, `/p/1`, `/cart`, `/orders/1` |
| UI paths | `src/**/*.vue`, `src/**/*.css`, `src/styles/**` |
| Login notes | "Mock mode signs in as demo@shop.test automatically." |
| Compare with base | on |

## Planted bugs

| ID | Where | The bug | What shows | Seen by |
|---|---|---|---|---|
| WEB-1 | `CartPage.vue` + `components.css` | the summary bar is `position: fixed; bottom: 0` with no bottom padding on the list; at phone width it covers the last item and the coupon form | the last cart item hidden behind the bar at 390 px | Preview (phone, before/after) |
| WEB-2 | `ProductCard.vue` | long product names are not clamped and the grid uses `minmax(220px, 1fr)` | horizontal scroll on 360–390 px screens | Preview |
| WEB-3 | `OrderSummary.vue` | shows the coupon discount computed in the browser, `Math.floor(subtotal * pct / 100)`, instead of the API's `discount_cents`; the API rounds half up | a 10% coupon on 12.95 shows a discount of 1.29 and a total of 11.66; the order then says 11.65 | Ticket from a "my total changed by a cent" report; agnts's review should ask to use the API's value |
| WEB-4 | `OrderPage.vue` | shows no discount: `discount_cents` is not in the order response yet | (not a bug; the multi-repo scenario adds it) | Multi-repo ticket |

WEB-1 and WEB-2 are the preview demo: a ticket such as "Make the cart page work well on phones" gets screenshots of the broken page (before) and the fix (after), at desktop and phone, with Muse's notes on what it saw, and the reviewer can point at a screenshot when asking for changes.

## Scenarios this repo plays in

| Scenario | Ticket | What the judges see |
|---|---|---|
| Visual preview | "Cart: the summary covers the last item on phones" (SHOP, repo shop-web) | Preview tab: before/after, desktop and phone; no console errors; the fix in `components.css` |
| Multi-repo (live) | **Shop** group ticket limited to shop-api + shop-web: "show the discount on the order page" | One run; shop-api adds `discount_cents` to the order schema and spec; shop-web adds it to `types.ts`, `OrderPage` and the mocks; two PRs linked to each other; a preview for the web PR |
| Code review | WEB-3's ticket | agnts's review comments on the diff before a person sees it |
| Commit links | push `SHOP-12: tidy header` by hand | the commit shows on ticket SHOP-12 and as a chip in the repository browser |

## Tests and CI

- Vitest + Vue Test Utils: `formatMoney`, the cart store, `CouponForm` errors, router guards. WEB-3's case is missing on purpose.
- `pnpm typecheck` (vue-tsc), `pnpm lint` (ESLint flat config, vue + ts).
- CI on push and PR: install, lint, typecheck, test, build; under 2 minutes.
- **Types check** (`scripts/check-types.mjs`): fetches `api/openapi.yaml` from shop-api at the **branch with the same name** as this one, falling back to `main`, and checks that `api/types.ts` has every schema field. agnts gives a multi-repo ticket the same branch name in every repo, so the web PR is checked against the API PR it goes with, not against `main` (which would fail until the API PR is merged). On `main` it checks against shop-api's `main`.

## Deploy

On the server (in shop-api's deploy steps): `pnpm install --frozen-lockfile && pnpm build` with `VITE_API_URL=` (same origin) writes `dist/` to `/opt/shop/web`. auth-gateway mounts that folder and serves it (see its plan). Nothing to restart.

## Phases

1. Scaffold (Vite, router, Pinia, tokens), API client, session, catalog and product pages, mock mode.
2. Cart, coupon, checkout, orders, sign-in; tests; CI with the types check.
3. Bugs WEB-1 to WEB-4 in place, preview settings in agnts, a dry run of the preview and multi-repo scenarios.

## Decisions

- **MSW mock mode over a staging API** for previews: no egress rule, no shared data that the last demo changed, same pages every time.
- **Hand-kept types plus a CI check** over generated types: the multi-repo ticket has to touch `types.ts` visibly, and the check makes forgetting it fail.
- **pnpm**: agnts detects it from the lockfile, and installs in the run container are faster.
