import { describe, it, expect, beforeEach } from 'vitest';
import {
    invalidateCacheByPrefix,
    invalidateCacheKey,
    setCacheEntry,
    getCacheEntry,
    swrGetOrFetch,
} from './swrCache';

describe('swrCache invalidation', () => {
    beforeEach(() => {
        invalidateCacheByPrefix('');
    });

    it('invalidateCacheKey removes a single entry', async () => {
        setCacheEntry('home:v1:test', { ok: true });
        expect(getCacheEntry('home:v1:test')?.data).toEqual({ ok: true });
        invalidateCacheKey('home:v1:test');
        expect(getCacheEntry('home:v1:test')).toBeNull();
    });

    it('invalidateCacheByPrefix removes matching keys only', () => {
        setCacheEntry('search:a', 1);
        setCacheEntry('search:b', 2);
        setCacheEntry('home:v1:x', 3);
        const removed = invalidateCacheByPrefix('search:');
        expect(removed).toBe(2);
        expect(getCacheEntry('search:a')).toBeNull();
        expect(getCacheEntry('home:v1:x')?.data).toBe(3);
    });

    it('swrGetOrFetch refetches after invalidation', async () => {
        let calls = 0;
        const fetcher = async () => {
            calls += 1;
            return { n: calls };
        };
        setCacheEntry('demo:key', { n: 1 });
        await swrGetOrFetch('demo:key', { ttlMs: 60_000, fetcher });
        expect(calls).toBe(0);
        invalidateCacheKey('demo:key');
        await swrGetOrFetch('demo:key', { ttlMs: 60_000, fetcher });
        expect(calls).toBe(1);
    });
});
