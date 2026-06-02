## scripts/

Operational scripts you run manually during development.

### Contents
- `seed_sample_data.js`: seed sample categories, products, supermarkets, and current prices.
- `seed_prices_for_all_supermarkets.js`: ensure every supermarket has every product in `prices_collection` (large seed).
- `seed_price_history.js`: seed realistic **historical** rows in `price_history` (2023 → recent) for charts.

### Seed prices for all supermarkets (catalog availability)

Creates missing `prices_collection` rows for every (product × supermarket) pair.

**Requires**: `APPWRITE_API_KEY`, `VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_DATABASE_ID`, and `SEED_USER_ID`.

From `PriceMate/`:

```bash
# Preview (no writes)
npm run seed:prices-all -- --dry-run

# Seed one supermarket first
npm run seed:prices-all -- --supermarket-id=<supermarket-$id>

# Full seed (large)
npm run seed:prices-all
```

**Scale flags:**

| Flag | Description |
|------|-------------|
| `--limit-pairs=N` | Cap number of new price rows created |
| `--concurrency=8` | Parallel Appwrite creates |
| `--batch-by-supermarket` | Lower memory mode (lists prices per supermarket) |
| `--checkpoint-file=...` | Resume support file (JSON) |
| `--no-checkpoint` | Disable checkpointing |

### Seed price history (synthetic, TRY-anchored)

Populates `price_history` for every product that already has at least one row in `prices_collection`. Uses current shelf prices as the end anchor and category/name heuristics for plausibility; no external API calls.

Each history row sets **`priceId`** to the matching `prices_collection` document id (required by Appwrite schema).

**Requirements:** `APPWRITE_API_KEY`, `VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_DATABASE_ID`, and optional collection overrides (defaults match the app).

From `PriceMate/`:

```bash
# Preview counts (no writes)
npm run seed:price-history -- --dry-run --per-product-points=50

# Insert history (skips products that already have >= 50 points)
npm run seed:price-history -- --per-product-points=50

# Re-seed one product
npm run seed:price-history -- --product-id=<product-$id> --per-product-points=50 --force --clear-synthetic
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Print counts and sample payloads only |
| `--force` | Seed even if history count already >= `--min-points` |
| `--clear-synthetic` | Delete rows with `priceChangeReason=synthetic_seed` before insert |
| `--per-product-points=50` | Total points per product (distributed across supermarkets) |
| `--min-points=50` | Legacy alias for `--per-product-points` |
| `--start=2023-01-01` | Range start (UTC) |
| `--end=YYYY-MM-DD` | Range end (default: 7 days ago) |
| `--product-id=<id>` | Limit to one product |
| `--max-products=N` | Limit to first N products (useful for staged runs) |
| `--concurrency=8` | Parallel Appwrite creates |

**Volume:** ~50+ documents per priced product (e.g. 100 products ≈ 5,000 rows). Run in dev/staging.

### Recommended staged run (large seed)

1) Prices first:

```bash
npm run seed:prices-all -- --dry-run
npm run seed:prices-all -- --supermarket-id=<id> --limit-pairs=200
npm run seed:prices-all -- --limit-pairs=2000
npm run seed:prices-all
```

2) History second:

```bash
npm run seed:price-history -- --dry-run --per-product-points=50
npm run seed:price-history -- --max-products=10 --per-product-points=50
npm run seed:price-history -- --per-product-points=50
```

**Tests:** `npm run test:scripts` (from `PriceMate/`) runs unit tests for the generator in `scripts/test/`.

### Appwrite indexes (`price_history` collection)

Create these in the Appwrite Console so admin backfill and user-app price charts stay fast:

| Attribute | Type | Used for |
|-----------|------|----------|
| `productId` | key | User app `fetchPriceHistory` queries by product |
| `priceId` | key (optional) | Idempotent backfill (skip prices already logged) |
| `timestamp` | key | Admin list ordering |

Admin backfill: **Price History** → **Backfill from prices** (paginates all `prices_collection` rows, parallel writes).

### Open Price Engine (via `off-proxy`)

Historical grocery prices use the **same** Appwrite function as Open Food Facts (`appwrite-functions/off-proxy/`). No extra function slot is required.

1. Redeploy `off-proxy` from `PriceMate/appwrite-functions/off-proxy/` — see **`DEPLOY.md`** there. Entrypoint must be **`src/main.js`** (export default). Smoke test: `{"kind":"ping"}`.
2. **Execute access (required for admin panel):** In Appwrite Console → **off-proxy** → **Settings** → **Execute access**, add **Users** (or your admins team). Save, then **redeploy** the function so the permission takes effect.
3. On that function, set environment variable:
   - `OPENPRICEENGINE_API_KEY` — [Open Price Engine](https://openpricengine.com/documentation/) API key (server-only; never `VITE_*`).
4. Admin panel `.env` (already used for product barcode/search):
   - `VITE_APPWRITE_FUNCTION_OFF_PROXY=<function-id>`
5. Optional admin `.env`:
   - `VITE_OPE_IMPORT_SUPERMARKET_ID=<supermarket-$id>` — default storage supermarket for imported rows.

**Smoke-test** (Appwrite Console → execute function):

```json
{"kind":"ope_stores"}
```

Uses `GET /api/v1/stores_tracked` (not `/stores`, which no longer exists).

```json
{"kind":"ope_historical","store":"woolworths","productname":"milk","start_date":"2024-01-01","end_date":"2024-12-31","currency":"USD"}
```

Uses `GET /api/v1/{store}/products/prices/query`.

Admin UI: **Price History** → **Import from Open Price Engine** → **Find OPE matches** (picks best store/name by data points), preview, import.

Add optional string attributes on **products** for repeat imports: `opeStore`, `opeProductName`, `opeLastImportAt`.

The standalone `appwrite-functions/ope-proxy/` folder is deprecated; OPE kinds live on `off-proxy` only.
