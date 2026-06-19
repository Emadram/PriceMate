import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.fn();
const pricesListMock = vi.fn();

vi.mock('../lib/appwrite', () => ({
    db: {
        products: { list: (...args) => listMock(...args) },
        prices: { list: (...args) => pricesListMock(...args) },
        supermarkets: { list: vi.fn(), get: vi.fn() },
        priceHistory: { list: vi.fn() },
    },
    Query: {
        equal: vi.fn((field, value) => `equal:${field}:${value}`),
        limit: vi.fn((n) => `limit:${n}`),
        orderDesc: vi.fn((field) => `orderDesc:${field}`),
        select: vi.fn((fields) => `select:${fields.length}`),
        orderAsc: vi.fn((field) => `orderAsc:${field}`),
        cursorAfter: vi.fn((id) => `cursorAfter:${id}`),
        contains: vi.fn((field, value) => `contains:${field}:${value}`),
    },
    COLLECTIONS: { PRICE_HISTORY: 'price_history' },
    functions: {},
}));

const { fetchSimilarProductsByCategory, findRelatedProducts } = await import('./productUtils');

describe('fetchSimilarProductsByCategory', () => {
    beforeEach(() => {
        listMock.mockReset();
        pricesListMock.mockReset();
        pricesListMock.mockResolvedValue({ documents: [] });
    });

    it('returns at most 4 products when limit is 4', async () => {
        const docs = Array.from({ length: 6 }, (_, i) => ({
            $id: `prod-${i + 1}`,
            name: `Product ${i + 1}`,
            categoryId: 'cat-1',
        }));

        listMock.mockResolvedValue({ documents: docs });

        const result = await fetchSimilarProductsByCategory('cat-1', 'exclude-me', 4);

        expect(result).toHaveLength(4);
        expect(result.every((p) => p.$id !== 'exclude-me')).toBe(true);
    });

    it('uses Query.limit(limit + 1) to allow excluding current product', async () => {
        listMock.mockResolvedValue({
            documents: [
                { $id: 'current', name: 'Current' },
                { $id: 'other-1', name: 'Other 1' },
                { $id: 'other-2', name: 'Other 2' },
                { $id: 'other-3', name: 'Other 3' },
                { $id: 'other-4', name: 'Other 4' },
            ],
        });

        const result = await fetchSimilarProductsByCategory('cat-1', 'current', 4);

        expect(result).toHaveLength(4);
        expect(result.map((p) => p.$id)).not.toContain('current');
        expect(listMock).toHaveBeenCalled();
        const queries = listMock.mock.calls[0][0];
        expect(queries).toContain('limit:5');
    });
});

describe('findRelatedProducts', () => {
    beforeEach(() => {
        listMock.mockReset();
        listMock.mockResolvedValue({ documents: [] });
        pricesListMock.mockReset();
        pricesListMock.mockResolvedValue({ documents: [] });
    });

    it('matches products locally from fullProductList using name fuzzy matching', async () => {
        const localList = [
            { $id: 'p1', name: 'Coca-Cola Zero Sugar', categoryId: 'cat-soda' },
            { $id: 'p2', name: 'Migros Whole Milk', categoryId: 'cat-milk' },
            { $id: 'p3', name: 'Lays Potato Chips Classic', categoryId: 'cat-chips' },
        ];

        // Querying for coke should match Coca-Cola Zero Sugar locally
        const result = await findRelatedProducts('coke', localList, 1);
        expect(result).toHaveLength(1);
        expect(result[0].$id).toBe('p1');
        expect(listMock).not.toHaveBeenCalled(); // No DB queries needed since it matched locally and limit is satisfied
    });

    it('queries database via Query.contains when local list has no matching items', async () => {
        listMock.mockResolvedValue({
            documents: [
                { $id: 'db-p1', name: 'Pepsi Max Cherry', categoryId: 'cat-soda' },
            ]
        });

        const localList = [
            { $id: 'p2', name: 'Migros Whole Milk', categoryId: 'cat-milk' },
        ];

        const result = await findRelatedProducts('pepsi cherry', localList, 2);
        expect(result).toHaveLength(1);
        expect(result[0].$id).toBe('db-p1');
        expect(listMock).toHaveBeenCalled();
    });

    it('falls back to category lookup if direct keyword matches are fewer than limit', async () => {
        listMock.mockImplementation((queries) => {
            const queriesStr = JSON.stringify(queries);
            if (queriesStr.includes('equal:categoryId:cat-soda')) {
                return Promise.resolve({
                    documents: [
                        { $id: 'db-p1', name: 'Coca-Cola Classic', categoryId: 'cat-soda' },
                        { $id: 'db-p2', name: 'Fanta Orange', categoryId: 'cat-soda' },
                        { $id: 'db-p3', name: 'Sprite Lemon Lime', categoryId: 'cat-soda' },
                    ]
                });
            }
            if (queriesStr.includes('contains:name:coca') || queriesStr.includes('contains:name:cocacola')) {
                return Promise.resolve({
                    documents: [
                        { $id: 'db-p1', name: 'Coca-Cola Classic', categoryId: 'cat-soda' },
                    ]
                });
            }
            return Promise.resolve({ documents: [] });
        });

        const result = await findRelatedProducts('coca cola drink', [], 3);
        expect(result).toHaveLength(3);
        expect(result.map(p => p.$id)).toContain('db-p1');
        expect(result.map(p => p.$id)).toContain('db-p2');
        expect(result.map(p => p.$id)).toContain('db-p3');
    });
});
