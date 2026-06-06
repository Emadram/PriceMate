import { describe, it, expect } from 'vitest';
import {
    normalizeProductKey,
    productNameSimilarity,
    scoreProductNameMatch,
    findBestProductMatch,
    tokenizeProductQuery,
    buildCatalogSearchTerms,
} from './productNameMatch';

const cocaCola = { name: 'Coca-Cola', barcode: '5449000000996' };
const milk = { name: 'Whole Milk 1L', barcode: '1111111111111' };
const pepsi = { name: 'Pepsi Cola', barcode: '2222222222222' };

describe('productNameMatch', () => {
    describe('normalizeProductKey', () => {
        it('strips spaces and punctuation', () => {
            expect(normalizeProductKey('Coca-Cola')).toBe('cocacola');
            expect(normalizeProductKey('coco cola')).toBe('cococola');
        });
    });

    describe('productNameSimilarity', () => {
        it('scores coco cola vs cocacola highly', () => {
            expect(productNameSimilarity('coco cola', 'Coca-Cola')).toBeGreaterThanOrEqual(0.82);
        });
    });

    describe('scoreProductNameMatch', () => {
        it('matches typo/spacing variant coco cola to Coca-Cola', () => {
            expect(scoreProductNameMatch('is coco cola high in sugar?', 'Coca-Cola')).toBeGreaterThanOrEqual(0.82);
        });

        it('matches exact normalized cocacola', () => {
            expect(scoreProductNameMatch('cocacola price', 'Coca-Cola')).toBeGreaterThanOrEqual(0.82);
        });

        it('matches coke via alias', () => {
            expect(scoreProductNameMatch('how much is coke?', 'Coca-Cola')).toBeGreaterThanOrEqual(0.82);
        });

        it('matches cocacola DB spelling via alias', () => {
            const terms = buildCatalogSearchTerms('Coca-Cola price');
            expect(terms.some((t) => t.includes('cocacola') || t.includes('coca'))).toBe(true);
        });

        it('does not match unrelated milk to Coca-Cola', () => {
            expect(scoreProductNameMatch('is milk high in sugar?', 'Coca-Cola')).toBeLessThan(0.82);
        });
    });

    describe('findBestProductMatch', () => {
        it('picks Coca-Cola for coco cola over other colas', () => {
            const result = findBestProductMatch('coco cola sugar', [pepsi, milk, cocaCola]);
            expect(result?.product).toBe(cocaCola);
            expect(result?.matchedName).toBe('Coca-Cola');
        });

        it('returns null when no product meets threshold', () => {
            expect(findBestProductMatch('organic quinoa', [cocaCola, pepsi])).toBeNull();
        });
    });

    describe('tokenizeProductQuery', () => {
        it('builds joined key from spaced phrase', () => {
            const { joined, words } = tokenizeProductQuery('find coco cola');
            expect(words).toContain('coco');
            expect(words).toContain('cola');
            expect(joined).toBe('cococola');
        });
    });

    describe('buildCatalogSearchTerms', () => {
        it('includes joined and alias terms', () => {
            const terms = buildCatalogSearchTerms('coke ingredients');
            expect(terms.some((t) => t.includes('coca') || t === 'coke')).toBe(true);
        });
    });
});
