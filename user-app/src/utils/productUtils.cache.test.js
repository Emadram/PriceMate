import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/appwrite', () => ({
    db: {
        products: { list: vi.fn() },
        prices: { list: vi.fn() },
        supermarkets: { list: vi.fn(), get: vi.fn() },
        priceHistory: { list: vi.fn() },
    },
    Query: {
        equal: vi.fn(),
        limit: vi.fn(),
        orderDesc: vi.fn(),
        select: vi.fn(),
        contains: vi.fn(),
    },
    COLLECTIONS: { PRICE_HISTORY: 'price_history' },
    functions: {},
}));

const {
    invalidateCatalogReferenceCaches,
    invalidateGlobalPriceCaches,
    invalidateProductUtilsByPrefix,
    invalidateProductUtilsCache,
} = await import('./productUtils');

describe('productUtils cache invalidation', () => {
    beforeEach(() => {
        invalidateGlobalPriceCaches();
        invalidateProductUtilsByPrefix('catalog-test:');
    });

    it('invalidateProductUtilsCache removes a specific key', async () => {
        const { fetchProducts } = await import('./productUtils');
        const { db } = await import('../lib/appwrite');
        db.products.list.mockResolvedValue({ documents: [{ $id: 'p1', name: 'Milk' }] });

        await fetchProducts(12);
        invalidateProductUtilsCache('products:12');
        db.products.list.mockClear();
        await fetchProducts(12);
        expect(db.products.list).toHaveBeenCalledTimes(1);
    });

    it('invalidateGlobalPriceCaches clears price prefixes but not catalog list key', async () => {
        const { searchProducts, fetchProducts } = await import('./productUtils');
        const { db } = await import('../lib/appwrite');

        db.products.list.mockResolvedValue({ documents: [] });
        await searchProducts('milk', null, 20, 'relevance');
        await fetchProducts(50);

        invalidateGlobalPriceCaches();

        db.products.list.mockClear();
        await searchProducts('milk', null, 20, 'relevance');
        expect(db.products.list).toHaveBeenCalled();

        db.products.list.mockClear();
        await fetchProducts(50);
        expect(db.products.list).not.toHaveBeenCalled();
    });

    it('invalidateCatalogReferenceCaches clears products and categories keys', async () => {
        const { fetchProducts, fetchCategories } = await import('./productUtils');
        const { db } = await import('../lib/appwrite');

        db.products.list.mockResolvedValue({ documents: [{ $id: 'p1', name: 'Milk' }] });
        await fetchProducts(12);
        await fetchCategories();

        invalidateCatalogReferenceCaches();

        db.products.list.mockClear();
        await fetchProducts(12);
        expect(db.products.list).toHaveBeenCalledTimes(1);
    });
});
