/**
 * Shared in-memory cache TTLs (user-app).
 *
 * Policy:
 * - Price paths (batch prices, barcode compare, search with prices): short TTLs (30s–2min).
 * - Catalog metadata (categories, store docs, product lists): longer TTLs (2–30min).
 * - User pull-to-refresh / refresh button bypasses cache via invalidateFreshData.js.
 */
export const HOME_CACHE_TTL_MS = 2 * 60 * 1000;
export const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000;
export const FAVORITES_CACHE_TTL_MS = 2 * 60 * 1000;
export const SUPERMARKET_PROFILE_CACHE_TTL_MS = 2 * 60 * 1000;
export const AI_CONTEXT_TTL_MS = 3 * 60 * 1000;
export const PRICE_HISTORY_CHART_TTL_MS = 2 * 60 * 1000;

/** Barcode product + prices in productStore (was 5 min). */
export const PRODUCT_BARCODE_CACHE_TTL_MS = 2 * 60 * 1000;

/** Documented alignment with productUtils CACHE_TTL.prices */
export const PRICE_BATCH_TTL_MS = 30 * 1000;

/** Documented alignment with productUtils CACHE_TTL.categories / supermarket doc */
export const CATALOG_LIST_TTL_MS = 5 * 60 * 1000;

/** AI catalog resolver positive match cache. */
export const CATALOG_RESOLVE_TTL_MS = 3 * 60 * 1000;

/** Brief cache for unresolved catalog queries (avoid repeated full scans). */
export const CATALOG_RESOLVE_NEGATIVE_TTL_MS = 45 * 1000;

/** AI memory prompt cache per conversation. */
export const AI_MEMORY_PROMPT_TTL_MS = 45 * 1000;

/** Chat conversation summaries index. */
export const CHAT_SUMMARIES_TTL_MS = 5 * 60 * 1000;

/** Chat messages per thread. */
export const CHAT_MESSAGES_TTL_MS = 2 * 60 * 1000;

/** Favorites sync from Appwrite after login. */
export const FAVORITES_SYNC_TTL_MS = 2 * 60 * 1000;
