# PriceMate — Admin Panel

React + Vite admin dashboard for managing products, prices, supermarkets, and analytics. Backend: Appwrite.

## Quick start

### Prerequisites

- Node.js 18+
- Appwrite project with admin collections configured
- Admin team / credentials for login

### Install and run

```bash
cd PriceMate/admin-panel
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173` or the next free port).

### Environment

Create `PriceMate/admin-panel/.env` (or `.env.local`) with at least:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=your_database_id
```

See `src/lib/appwrite.js` for optional collection ID overrides.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run script tests (readCache, OPE, backfill, etc.) |
| `npm run lint` | ESLint |
| `npm run test:read-cache` | readCache unit tests only |

---

## Admin read verification (Appwrite read budget)

Use this checklist to confirm the admin panel is not sending excessive Appwrite **read** requests after cache optimizations.

Full reference (automated tests, red flags, results table): [`../docs/admin-read-verification-results.md`](../docs/admin-read-verification-results.md).

### Step 1 — Run automated checks first

```bash
cd PriceMate/admin-panel
npm test && npm run lint
```

All script tests should pass before manual browser QA.

### Step 2 — Enable read logging

```bash
cd PriceMate/admin-panel
cp .env.read-verification.example .env.local
```

Ensure `.env.local` contains your Appwrite vars **and**:

```env
VITE_READ_DEBUG=true
```

Restart the dev server after changing env files.

### Step 3 — Start the app

```bash
npm run dev
```

Log in as admin. For cold-start scenarios, hard refresh or clear site data in DevTools → Application.

### Step 4 — Scenario checklist

Perform each action below and compare behavior against the pass criteria. For env flags, console workflow, and recording results, see [`../docs/admin-read-verification-results.md`](../docs/admin-read-verification-results.md).

#### A — Dashboard (largest admin read surface)

| ID | Action | Pass if |
|----|--------|---------|
| A1 | Open Dashboard (first load after login) | One-time burst: 8 count queries + chart full scans (products/prices/supermarkets pagination) |
| A2 | Navigate away, return within **3 min** (totals) / **10 min** (charts) | **0** network reads (cache hit); console may show `[readCache] hit` |
| A3 | Click manual refresh on Dashboard | Force refresh: totals + charts refetch once |
| A4 | Realtime event debounce (wait ~2s after external change) | Light refresh only when cache stale; no full chart scan if charts still fresh |

#### B — Products page (reference + pagination)

| ID | Action | Pass if |
|----|--------|---------|
| B1 | Open Products (first visit) | 1 paginated products list + 1 categories + 1 supermarkets (reference) |
| B2 | Leave and return within **10 min** | **0** categories/supermarkets reads; **0** products if same page cached |
| B3 | Change page number | **1** products list only (no duplicate burst within ~500ms) |
| B4 | Add / update / delete product | Product list refresh + `admin:product-options:v1` invalidated (Prices dropdown fresh) |

#### C — Prices page

| ID | Action | Pass if |
|----|--------|---------|
| C1 | Open Prices (first visit) | 1 prices page + product options + supermarkets (reference) |
| C2 | Change page | **1** prices list only |
| C3 | Revisit same page within **2 min** | **0** prices list for that page key |

#### D — Price History page

| ID | Action | Pass if |
|----|--------|---------|
| D1 | Open Price History | 1 history page + reference dropdowns |
| D2 | Change page | **1** history list only |
| D3 | Realtime on products/supermarkets | Reference refresh only — **not** full history refetch |
| D4 | Realtime on price_history | History page refresh only |

#### E — Reference stores (Categories, Supermarkets, Feedback)

| ID | Action | Pass if |
|----|--------|---------|
| E1 | Open Categories twice within **10 min** | **0** reads on second open |
| E2 | Open Supermarkets twice within **10 min** | **0** reads on second open |
| E3 | Open Feedback with **empty** collection twice | **0** reads on second mount (`hasFetched` guard) |

#### F — Navigation churn

| ID | Action | Pass if |
|----|--------|---------|
| F1 | Dashboard → Products → Prices → back within TTLs | **0** reads when returning to cached pages |
| F2 | Sidebar switch between entity pages within reference TTL | Reference lists not refetched |

### Step 5 — Red flags (fail immediately)

- **Duplicate burst**: two identical paginated list calls within ~500ms on a single page change
- **Dashboard revisit** within TTL triggers 8 count queries + full chart scans again
- **Empty Feedback/Categories** refetches on every mount
- **Price History** refetches all history when only products/supermarkets change (realtime split broken)
- **Product CRUD** without invalidating product options (Prices dropdown stale for 10 min)

### Step 6 — Record results

Copy the manual results table from [`../docs/admin-read-verification-results.md`](../docs/admin-read-verification-results.md).

---

## Caching architecture (summary)

| Layer | Location | Cache keys / TTL |
|-------|----------|------------------|
| readCache | `src/utils/readCache.js` | In-memory SWR-style layer |
| Dashboard totals | `src/pages/Dashboard.jsx` | `dashboard:totals:v1` — **3 min** |
| Dashboard charts | `src/pages/Dashboard.jsx` | `dashboard:charts:v1` — **10 min** |
| Supermarkets | `src/stores/supermarketsStore.js` | `admin:supermarkets:v1` — **10 min** |
| Categories | `src/stores/categoriesStore.js` | `admin:categories:v1` — **10 min** |
| Product options | `src/stores/productsStore.js` | `admin:product-options:v1` — **10 min** |
| Prices pages | `src/stores/pricesStore.js` | `admin:prices:page:N` — **2 min** |
| Price history pages | `src/stores/priceHistoryStore.js` | `admin:price-history:page:N:size:M` — **2 min** |
| Feedback | `src/stores/feedbackStore.js` | Zustand TTL **3 min** + `hasFetched` |

Read debug counter: `src/utils/readStats.js` (when `VITE_READ_DEBUG=true`).

---

## Project structure

```
admin-panel/
├── src/
│   ├── pages/        # Dashboard, Products, Prices, PriceHistory, …
│   ├── stores/       # Zustand + readCache-backed reference stores
│   ├── utils/        # readCache.js, readStats.js, priceHistoryBackfill
│   └── lib/          # Appwrite client
├── scripts/          # Node tests (readCache, OPE, backfill)
└── .env.read-verification.example
```

---

## License

Private academic project — graduation work.
