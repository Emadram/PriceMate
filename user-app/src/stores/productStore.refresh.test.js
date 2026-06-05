import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/appwrite', () => ({
    db: {
        products: {
            list: vi.fn(),
        },
    },
    Query: {
        equal: vi.fn(),
        limit: vi.fn(),
        select: vi.fn(),
    },
}));

vi.mock('../utils/productUtils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        fetchOffCacheByBarcode: vi.fn().mockResolvedValue(null),
        fetchGlobalProductWithRetries: vi.fn().mockResolvedValue(null),
        saveOffCacheFromProduct: vi.fn(),
        fetchPricesForProducts: vi.fn().mockResolvedValue([]),
        fetchSupermarketsCatalog: vi.fn().mockResolvedValue([]),
        enrichPricesWithSupermarketDocs: vi.fn((prices) => prices),
        normalizeProduct: vi.fn((p) => p),
        normalizeOffCacheDoc: vi.fn((d) => d),
    };
});

const { db } = await import('../lib/appwrite');
const useProductStore = (await import('./productStore')).default;

describe('productStore force refresh', () => {
    beforeEach(() => {
        useProductStore.setState({
            product: null,
            prices: [],
            loading: false,
            error: null,
            cache: { products: {}, search: {} },
        });
        db.products.list.mockReset();
    });

    it('fetchProductByBarcode with force bypasses cache', async () => {
        const product = { $id: 'prod-1', barcode: '12345678', name: 'Test' };
        db.products.list.mockResolvedValue({ documents: [product] });

        useProductStore.setState({
            cache: {
                products: {
                    '12345678': { product, prices: [], timestamp: Date.now() },
                },
                search: {},
            },
        });

        await useProductStore.getState().fetchProductByBarcode('12345678');
        expect(db.products.list).not.toHaveBeenCalled();

        await useProductStore.getState().fetchProductByBarcode('12345678', { force: true });
        expect(db.products.list).toHaveBeenCalled();
    });
});
