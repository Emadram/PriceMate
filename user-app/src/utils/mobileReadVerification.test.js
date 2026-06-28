import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const listMock = vi.fn();

vi.mock('../lib/appwrite', () => ({
    db: {
        products: {
            list: (...args) => listMock(...args),
            get: vi.fn((id) => Promise.resolve({ $id: id, name: 'Mock Product' })),
        },
        prices: { list: vi.fn() },
        supermarkets: { list: vi.fn(), get: vi.fn() },
        categories: { list: vi.fn() },
        priceHistory: { list: vi.fn() },
        favorites: { list: vi.fn() },
        chatHistory: { list: vi.fn() },
        aiChatMemory: { list: vi.fn() },
    },
    Query: {
        equal: vi.fn((...args) => ['equal', ...args]),
        limit: vi.fn((n) => ['limit', n]),
        offset: vi.fn((n) => ['offset', n]),
        orderDesc: vi.fn((field) => ['orderDesc', field]),
        contains: vi.fn((field, value) => ['contains', field, value]),
        search: vi.fn((field, value) => ['search', field, value]),
        select: vi.fn((...fields) => ['select', ...fields]),
    },
    COLLECTIONS: { PRICE_HISTORY: 'price_history' },
    functions: {},
}));

vi.mock('../stores/categoriesStore', () => ({
    default: {
        getState: () => ({
            fetchCategories: vi.fn(),
        }),
    },
}));

vi.mock('../stores/supermarketsStore', () => ({
    default: {
        getState: () => ({
            fetchSupermarkets: vi.fn(),
        }),
    },
}));

vi.mock('../stores/productStore', () => ({
    default: {
        getState: () => ({
            invalidateBarcodeCache: vi.fn(),
        }),
    },
}));

const { resolveCatalogProductForIngredients } = await import('./productUtils');
const { refreshPageCache } = await import('./invalidateFreshData');
const { swrGetOrFetch, invalidateCacheKey, setCacheEntry } = await import('./swrCache');

const homeSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../pages/Home.jsx'),
    'utf8'
);

describe('mobile read verification — red flags', () => {
    beforeEach(() => {
        listMock.mockReset();
        listMock.mockResolvedValue({ documents: [{ $id: 'c1', name: 'Cocacola' }] });
    });

    it('Home uses stable SWR key home:v1 (not favorites-dependent)', () => {
        expect(homeSource).toContain("const HOME_SWR_KEY = 'home:v1'");
        expect(homeSource).not.toMatch(/home:v1:\$\{/);
        expect(homeSource).not.toContain('favoritesKey');
    });

    it('G3: identical AI resolver query hits cache on second call', async () => {
        const query = 'What is the price of Coca-Cola?';
        await resolveCatalogProductForIngredients(query);
        const firstCalls = listMock.mock.calls.length;
        expect(firstCalls).toBeGreaterThan(0);

        listMock.mockClear();
        await resolveCatalogProductForIngredients(query);
        expect(listMock).not.toHaveBeenCalled();
    });

    it('G4: negative resolver result cached briefly', async () => {
        listMock.mockResolvedValue({ documents: [{ $id: 'm1', name: 'Milk' }] });

        await resolveCatalogProductForIngredients('organic quinoa bowl');
        const firstCalls = listMock.mock.calls.length;
        expect(firstCalls).toBeGreaterThan(0);

        listMock.mockClear();
        await resolveCatalogProductForIngredients('organic quinoa bowl');
        expect(listMock).not.toHaveBeenCalled();
    });

    it('A3/C3: global refreshPageCache busts catalog productUtils keys', async () => {
        const { fetchProducts } = await import('./productUtils');
        await fetchProducts(12);
        refreshPageCache({ swrKey: 'home:v1', priceScope: 'global' });

        listMock.mockClear();
        await fetchProducts(12);
        expect(listMock).toHaveBeenCalledTimes(1);
    });

    it('C1: SWR second fetch within TTL skips network fetcher', async () => {
        const key = 'search:verify:milk:all:relevance';
        invalidateCacheKey(key);
        let fetcherCalls = 0;
        const fetcher = async () => {
            fetcherCalls += 1;
            return { items: [1] };
        };

        await swrGetOrFetch(key, { ttlMs: 60_000, fetcher });
        const entry = (await import('./swrCache')).getCacheEntry(key);
        if (entry?.promise) await entry.promise;

        await swrGetOrFetch(key, { ttlMs: 60_000, fetcher });
        expect(fetcherCalls).toBe(1);
    });

    it('B1 regression: SWR home key unchanged when only favorites cache invalidated', async () => {
        setCacheEntry('home:v1', { products: [] });
        invalidateCacheKey('favorites:v1:abc');
        const { getCacheEntry } = await import('./swrCache');
        const homeEntry = getCacheEntry('home:v1');
        expect(homeEntry?.data).toEqual({ products: [] });
    });
});

describe('mobile read verification — favorites sync TTL', () => {
    it('F2: favorites sync TTL is 2 minutes per cacheTtls policy', async () => {
        const { FAVORITES_SYNC_TTL_MS } = await import('./cacheTtls');
        expect(FAVORITES_SYNC_TTL_MS).toBe(2 * 60 * 1000);
    });

    it('G2/G6: chat summaries and messages TTL constants match policy', async () => {
        const { CHAT_MESSAGES_TTL_MS, CHAT_SUMMARIES_TTL_MS, AI_CONTEXT_TTL_MS } =
            await import('./cacheTtls');
        expect(CHAT_MESSAGES_TTL_MS).toBe(2 * 60 * 1000);
        expect(CHAT_SUMMARIES_TTL_MS).toBe(5 * 60 * 1000);
        expect(AI_CONTEXT_TTL_MS).toBe(3 * 60 * 1000);
    });
});
