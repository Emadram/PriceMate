import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.fn();

vi.mock('../lib/appwrite', () => ({
    db: {
        products: {
            list: (...args) => listMock(...args),
            get: vi.fn((id) => {
                if (id === 'c1') return Promise.resolve({ $id: 'c1', name: 'Cocacola', barcode: '5449000000996' });
                if (id === 'm1') return Promise.resolve({ $id: 'm1', name: 'Whole Milk', barcode: '111' });
                return Promise.resolve({ $id: id });
            }),
        },
        prices: { list: vi.fn() },
        supermarkets: { list: vi.fn(), get: vi.fn() },
        priceHistory: { list: vi.fn() },
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

const { resolveCatalogProductForIngredients } = await import('./productUtils');

const cocaColaOld = { $id: 'c1', name: 'Cocacola', barcode: '5449000000996' };
const milk = { $id: 'm1', name: 'Whole Milk', barcode: '111' };

describe('resolveCatalogProductForIngredients', () => {
    beforeEach(() => {
        listMock.mockReset();
    });

    it('matches coca cola query to Cocacola via contains search', async () => {
        listMock.mockImplementation(async () => ({ documents: [cocaColaOld] }));

        const result = await resolveCatalogProductForIngredients('What is the price of Coca-Cola?');
        expect(result.product).toEqual(cocaColaOld);
        expect(result.catalogName).toBe('Cocacola');
    });

    it('matches coke via alias search terms', async () => {
        listMock.mockImplementation(async () => ({ documents: [cocaColaOld, milk] }));

        const result = await resolveCatalogProductForIngredients('how much is coke?');
        expect(result.product).toEqual(cocaColaOld);
    });

    it('finds older catalog products outside the first page via paginated scan', async () => {
        let call = 0;
        listMock.mockImplementation(async () => {
            call += 1;
            if (call === 1) {
                return { documents: [] };
            }
            if (call === 2) {
                return { documents: Array.from({ length: 100 }, (_, i) => ({ $id: `new-${i}`, name: `Product ${i}` })) };
            }
            return { documents: [cocaColaOld] };
        });

        const result = await resolveCatalogProductForIngredients('coca cola sugar');
        expect(result.product).toEqual(cocaColaOld);
    });

    it('returns empty for unrelated queries when no match exists', async () => {
        listMock.mockResolvedValue({ documents: [milk] });

        const result = await resolveCatalogProductForIngredients('organic quinoa bowl');
        expect(result.product).toBeNull();
    });

    it('G3: caches identical queries (no second products.list)', async () => {
        listMock.mockResolvedValue({ documents: [cocaColaOld] });
        const query = 'What is the price of Coca-Cola?';

        await resolveCatalogProductForIngredients(query);
        listMock.mockClear();
        await resolveCatalogProductForIngredients(query);
        expect(listMock).not.toHaveBeenCalled();
    });
});
