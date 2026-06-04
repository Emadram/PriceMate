const DEFAULT_TTL_MS = 3 * 60 * 1000;

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

export function invalidateCacheKey(key) {
  store.delete(key);
}

export function isFresh(entry, ttlMs = DEFAULT_TTL_MS) {
  if (!entry) return false;
  return now() - entry.updatedAt <= ttlMs;
}

/**
 * SWR-style cache: return fresh data immediately; refresh stale in background; dedupe in-flight.
 */
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

  if (fresh) {
    return { data: existing.data, fromCache: true, refreshing: false };
  }

  const hasStaleData = !!existing?.data;

  if (!shouldFetch(existing)) {
    return { data: existing?.data ?? null, fromCache: !!existing?.data, refreshing: false };
  }

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

export function createStaleFetchHelpers({ cacheKey, ttlMs = DEFAULT_TTL_MS }) {
  return {
    isStoreFresh: (lastFetchedAt) =>
      lastFetchedAt != null && now() - lastFetchedAt <= ttlMs,

    async fetchIfStale(getState, setState, fetcher, { force = false } = {}) {
      const { lastFetchedAt, loading } = getState();
      if (!force && getState().isStoreFresh?.(lastFetchedAt)) {
        return { skipped: true };
      }
      if (loading && !force) {
        return { skipped: true, inFlight: true };
      }
      setState({ loading: true, error: null });
      try {
        const data = await fetcher();
        setState({
          ...data,
          lastFetchedAt: now(),
          loading: false,
        });
        setCacheEntry(cacheKey, data);
        return { skipped: false };
      } catch (error) {
        setState({ error: error.message, loading: false });
        throw error;
      }
    },

    invalidate() {
      invalidateCacheKey(cacheKey);
    },
  };
}
