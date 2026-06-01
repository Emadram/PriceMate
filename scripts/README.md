## scripts/

Operational scripts you run manually during development.

### Contents
- `seed_sample_data.js`: seed sample data for development/testing.

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

1. Redeploy `off-proxy` from `PriceMate/appwrite-functions/off-proxy/` (Node 18).
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

```json
{"kind":"ope_historical","store":"woolworths","productname":"milk","start_date":"2024-01-01","end_date":"2024-12-31","currency":"USD"}
```

Admin UI: **Price History** → **Import from Open Price Engine** (fetch preview, then bulk import).

The standalone `appwrite-functions/ope-proxy/` folder is deprecated; OPE kinds live on `off-proxy` only.
