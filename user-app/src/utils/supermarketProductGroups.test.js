import { describe, it, expect } from 'vitest';
import { getProductCategoryMeta, groupSupermarketProductsByCategory } from './supermarketProductGroups';

const t = (key, fallback) => fallback || key;

describe('supermarketProductGroups', () => {
    it('groups products by category and sorts alphabetically', () => {
        const products = [
            { $id: 'p1', products: { name: 'Milk', categoryId: { $id: 'c2', name: 'Dairy' } } },
            { $id: 'p2', products: { name: 'Bread', categoryId: { $id: 'c1', name: 'Bakery' } } },
            { $id: 'p3', products: { name: 'Cheese', categoryId: { $id: 'c2', name: 'Dairy' } } },
        ];

        const sections = groupSupermarketProductsByCategory(products, t);
        expect(sections).toHaveLength(2);
        expect(sections[0].label).toBe('Bakery');
        expect(sections[0].products).toHaveLength(1);
        expect(sections[1].label).toBe('Dairy');
        expect(sections[1].products).toHaveLength(2);
    });

    it('omits categories with no products', () => {
        expect(groupSupermarketProductsByCategory([], t)).toEqual([]);
    });

    it('uses other fallback when category missing', () => {
        const meta = getProductCategoryMeta({ products: { name: 'X' } }, t);
        expect(meta.label).toBe('Other');
        expect(meta.key).toBe('other');
    });
});
