const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Very small in-memory SWR cache:
 * - returns cached data immediately (if any)
 * - refreshes stale entries in background
 * - dedupes in-flight fetches per key
 */
const store = new Map();

const now = () => Date.now();

export function getCacheEntry(key) {
  return store.get(key) || null;
}

export function setCacheEntry(key, data) {
  const entry = {
    data,
    updatedAt: now(),
    promise: null,
  };
  store.set(key, entry);
  return entry;
}

export function isFresh(entry, ttlMs = DEFAULT_TTL_MS) {
  if (!entry) return false;
  return now() - entry.updatedAt <= ttlMs;
}

export function invalidateCacheKey(key) {
  store.delete(key);
}

export function invalidateCacheByPrefix(prefix) {
  if (!prefix) return 0;
  let removed = 0;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export async function swrGetOrFetch(
  key,
  {
    ttlMs = DEFAULT_TTL_MS,
    fetcher,
    onUpdate,
    shouldFetch = () => true,
  }
) {
  if (typeof fetcher !== 'function') {
    throw new Error('swrGetOrFetch requires a fetcher function');
  }

  const existing = getCacheEntry(key);
  const fresh = isFresh(existing, ttlMs);

  // If we have fresh cached data, return it without fetching.
  if (fresh) {
    return { data: existing.data, fromCache: true, refreshing: false };
  }

  // If there is cached data but stale, return it and refresh in background.
  const hasStaleData = !!existing?.data;

  if (!shouldFetch(existing)) {
    return { data: existing?.data ?? null, fromCache: !!existing?.data, refreshing: false };
  }

  // Dedupe in-flight refreshes.
  if (existing?.promise) {
    return { data: existing.data ?? null, fromCache: !!existing.data, refreshing: true };
  }

  const run = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      const next = setCacheEntry(key, data);
      if (typeof onUpdate === 'function') onUpdate(data, next);
      return data;
    })
    .catch((err) => {
      // Keep stale data if fetch fails; clear promise marker.
      const current = getCacheEntry(key);
      if (current) {
        store.set(key, { ...current, promise: null });
      }
      throw err;
    })
    .finally(() => {
      const current = getCacheEntry(key);
      if (current) {
        store.set(key, { ...current, promise: null });
      }
    });

  store.set(key, {
    data: existing?.data ?? null,
    updatedAt: existing?.updatedAt ?? 0,
    promise: run,
  });

  return { data: hasStaleData ? existing.data : null, fromCache: hasStaleData, refreshing: true };
}

