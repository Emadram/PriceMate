# PriceMate — User App (mobile + web)

React + Vite client for comparing supermarket prices. Backend: Appwrite.

## Quick start

### Prerequisites

- Node.js 18+
- Appwrite project with collections configured

### Install and run

```bash
cd PriceMate/user-app
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Environment

Create `PriceMate/user-app/.env` (or `.env.local`) with at least:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=your_database_id
```

Add collection/bucket IDs if your project uses non-default names (see `src/lib/appwrite.js`).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest suite |
| `npm run lint` | ESLint |

---

## Mobile read verification (Appwrite read budget)

Use this checklist to confirm the app is not sending excessive Appwrite **read** requests after cache optimizations.

Full reference (automated test mapping, red flags, results table): [`../docs/mobile-read-verification-results.md`](../docs/mobile-read-verification-results.md).

Admin panel guide: [`../admin-panel/README.md`](../admin-panel/README.md#admin-read-verification-appwrite-read-budget).

### Step 1 — Run automated checks first

```bash
cd PriceMate/user-app
npm test && npm run lint
```

All tests should pass before manual browser QA.

### Step 2 — Enable read logging

```bash
cd PriceMate/user-app
cp .env.read-verification.example .env.local
```

Ensure `.env.local` contains your Appwrite vars **and**:

```env
VITE_READ_DEBUG=true
```

Do **not** set `VITE_RUN_DIAGNOSTICS=true` while measuring reads — it triggers a large list burst on every reload. Diagnostics are automatically disabled when `VITE_READ_DEBUG=true`.

Restart the dev server after changing env files.

### Step 3 — Start the app

```bash
npm run dev
```

For cold-start scenarios, hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) or clear site data in DevTools → Application.

### Step 4 — Scenario checklist

Perform each action below and compare behavior against the pass criteria. For env flags, console workflow, and recording results, see [`../docs/mobile-read-verification-results.md`](../docs/mobile-read-verification-results.md).

#### A — Cold start (logged out)

| ID | Action | Pass if |
|----|--------|---------|
| A1 | Open Home (fresh session) | ≤ 5–6 list reads (products, prices, categories, announcements, supermarkets) |
| A2 | Leave Home 30s, return | **0** reads |
| A3 | Pull-to-refresh on Home | ≤ 4–5 reads; includes categories + supermarkets, not prices-only |

#### B — Home favorites

| ID | Action | Pass if |
|----|--------|---------|
| B1 | Toggle favorite on Home | **0** new products/prices reads from Home loader |
| B2 | Open Favorites (first visit) | 1 products + 1 supermarkets + 1 price batch |
| B3 | Return to Home within 2 min | **0** reads |

#### C — Search

| ID | Action | Pass if |
|----|--------|---------|
| C1 | Same search twice within 3 min | **0** reads on second visit |
| C2 | Change sort/filter | 1 search + 1 price batch (OK) |
| C3 | PTR on Search | Single bust, no duplicate products within ~500ms |

#### D — Product detail

| ID | Action | Pass if |
|----|--------|---------|
| D1 | Open same product twice within 2 min | **0** products on second open |
| D2 | PTR on Product Details | Product + prices only, not full catalog |
| D3 | Product Details → Price Comparison (same barcode) | No extra products list |

#### E — Supermarket profile

| ID | Action | Pass if |
|----|--------|---------|
| E1 | Same profile twice within 2 min | **0** reads on second open |
| E2 | PTR on profile | 1 get + 1 prices list (+ optional branch lists) |

#### F — Favorites sync (logged in)

| ID | Action | Pass if |
|----|--------|---------|
| F1 | Log in | ≤ 1 `favorites` list |
| F2 | Browse 2 min without favorite changes | **0** additional favorites lists |
| F3 | Toggle favorite | 1 write + at most 1 list |

#### G — AI chat

| ID | Action | Pass if |
|----|--------|---------|
| G1 | Open AI chat first time | One-time burst (products 50, prices, supermarkets, chat history) |
| G2 | Close and reopen within 3 min | **0** products(50); **0** full history rescan within 5 min |
| G3 | Same product question twice (e.g. Coca-Cola) | **0** products on second message |
| G4 | Nonsense product twice within 45s | **0** paginated products scan on second ask |
| G5 | 3 messages quickly in one thread | ≤ 1 `ai_chat_memory` list per 45s |
| G6 | Switch threads and back within 2 min | **0** chat_history pagination |

#### H — Navigation

| ID | Action | Pass if |
|----|--------|---------|
| H1 | Tab away 1 min, return to Home | **0** reads |
| H2 | Home ↔ Search ↔ Favorites within TTLs | **0** reads per revisit |

### Step 5 — Red flags (fail immediately)

- Duplicate identical `products` list within ~500ms on one action
- Home refetch when toggling a favorite
- Home PTR updates prices but not categories/supermarkets
- Chat reopen within TTL refetches full AI context **and** full history
- Same AI product question within 3 min triggers another large catalog scan
- Product card hover causes many barcode prefetches

### Step 6 — Record results

Copy the manual results table from [`../docs/mobile-read-verification-results.md`](../docs/mobile-read-verification-results.md) and fill in reads observed / pass-fail / notes.

---

## Caching architecture (summary)

| Layer | Location | Purpose |
|-------|----------|---------|
| Page SWR | `src/utils/swrCache.js` | Home, Search, Favorites, Supermarket profile bundles |
| productUtils TTL | `src/utils/productUtils.js`, `cacheTtls.js` | Prices, search, catalog resolver, categories |
| Zustand TTL | `src/stores/*` | Supermarkets, categories, favorites sync, AI context, chat |
| Pull-to-refresh | `src/utils/invalidateFreshData.js` | Coherent cache bust on PTR |
| Read debug | `src/utils/readStats.js` | Dev counter when `VITE_READ_DEBUG=true` |

---

## Project structure

```
user-app/
├── src/
│   ├── components/   # UI components (incl. AIChatBox, ProductCard)
│   ├── pages/        # Route pages
│   ├── stores/       # Zustand stores
│   ├── utils/        # productUtils, swrCache, readStats, invalidateFreshData
│   └── lib/          # Appwrite client
├── docs/             # See ../docs/mobile-read-verification-results.md
└── scripts/          # Tooling (icons, i18n check)
```

---

## License

Private academic project — graduation work.
