import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCacheEntry,
  setCacheEntry,
  invalidateCacheKey,
  isFresh,
  swrGetOrFetch,
} from '../src/utils/readCache.js';

test('isFresh returns true within ttl and false after expiry', () => {
  const key = 'test:fresh';
  setCacheEntry(key, { value: 1 });
  const entry = getCacheEntry(key);
  assert.equal(isFresh(entry, 1000), true);
  entry.updatedAt = Date.now() - 2000;
  assert.equal(isFresh(entry, 1000), false);
  invalidateCacheKey(key);
});

test('swrGetOrFetch returns cached data without calling fetcher twice', async () => {
  const key = 'test:swr';
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return ['a'];
  };

  const first = await swrGetOrFetch(key, { ttlMs: 60_000, fetcher });
  const entry = getCacheEntry(key);
  if (entry?.promise) {
    await entry.promise;
  }
  assert.equal(first.refreshing || first.fromCache, true);
  assert.equal(calls, 1);

  const second = await swrGetOrFetch(key, { ttlMs: 60_000, fetcher });
  assert.equal(second.fromCache, true);
  assert.deepEqual(second.data, ['a']);
  assert.equal(calls, 1);

  invalidateCacheKey(key);
});

test('invalidateCacheKey removes entry', () => {
  const key = 'test:invalidate';
  setCacheEntry(key, 42);
  assert.ok(getCacheEntry(key));
  invalidateCacheKey(key);
  assert.equal(getCacheEntry(key), null);
});
