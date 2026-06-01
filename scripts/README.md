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

