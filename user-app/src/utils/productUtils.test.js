import { describe, it, expect } from 'vitest';
import { calculateDistance, getRelationshipId, hasValidLatLon, normalizeProduct } from './productUtils';

describe('productUtils', () => {
    describe('hasValidLatLon', () => {
        it('accepts zero latitude and valid longitude', () => {
            expect(hasValidLatLon(0, 28.97)).toBe(true);
        });
        it('rejects out-of-range latitude', () => {
            expect(hasValidLatLon(91, 0)).toBe(false);
        });
    });

    describe('calculateDistance', () => {
        it('calculates distance accurately between two points', () => {
            // Istanbul to Ankara roughly
            const dist = calculateDistance(41.0082, 28.9784, 39.9334, 32.8597);
            expect(parseFloat(dist)).toBeGreaterThan(300);
            expect(parseFloat(dist)).toBeLessThan(400);
        });

        it('returns null for missing coordinates', () => {
            expect(calculateDistance(null, 28.9784, 39.9334, 32.8597)).toBe(null);
        });

        it('does not treat equator as missing', () => {
            const dist = calculateDistance(0, 0, 0, 1);
            expect(dist).not.toBe(null);
            expect(parseFloat(dist)).toBeGreaterThan(100);
            expect(parseFloat(dist)).toBeLessThan(120);
        });
    });

    describe('getRelationshipId', () => {
        it('extracts ID from object', () => {
            expect(getRelationshipId({ $id: '123' })).toBe('123');
        });
        it('extracts ID from array', () => {
            expect(getRelationshipId([{ $id: '123' }])).toBe('123');
        });
        it('returns string as is', () => {
            expect(getRelationshipId('123')).toBe('123');
        });
    });

    describe('normalizeProduct', () => {
        it('standardizes a product with prices', () => {
            const product = { $id: 'p1', name: 'Milk', barcode: '123' };
            const prices = [
                { price: 20, products: 'p1' },
                { price: 15, products: 'p1' }
            ];
            const result = normalizeProduct(product, prices);
            expect(result.id).toBe('p1');
            expect(result.cheapestPrice).toBe(15);
            expect(result.priceCount).toBe(2);
        });
    });
});
