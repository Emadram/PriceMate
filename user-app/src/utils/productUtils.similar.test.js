import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.fn();

vi.mock('../lib/appwrite', () => ({
    db: {
        products: { list: (...args) => listMock(...args) },
        prices: { list: vi.fn() },
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
    },
    COLLECTIONS: { PRICE_HISTORY: 'price_history' },
    functions: {},
}));

const { fetchSimilarProductsByCategory } = await import('./productUtils');

describe('fetchSimilarProductsByCategory', () => {
    beforeEach(() => {
        listMock.mockReset();
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
