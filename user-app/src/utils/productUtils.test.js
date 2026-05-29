import { describe, it, expect } from 'vitest';
import {
    buildDirectionsUrl,
    buildSupermarketContextLines,
    calculateDistance,
    enrichProductPricesWithSupermarkets,
    extractGoogleMapsCoordinates,
    getRelationshipId,
    hasValidLatLon,
    isUserLocationAvailableForStores,
    normalizeProduct,
    resolveCoordinates,
    resolvePriceSupermarketMeta,
} from './productUtils';

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

    describe('buildDirectionsUrl', () => {
        it('builds a Google Maps directions link for valid coordinates', () => {
            expect(buildDirectionsUrl(41.0082, 28.9784)).toBe(
                'https://www.google.com/maps/dir/?api=1&destination=41.0082%2C28.9784'
            );
        });

        it('returns an empty string for invalid coordinates', () => {
            expect(buildDirectionsUrl(91, 0)).toBe('');
        });

        it('uses googleMapsUrl if provided', () => {
            expect(buildDirectionsUrl(41.0082, 28.9784, 'https://maps.google.com/test')).toBe('https://maps.google.com/test');
        });

        it('derives directions from Google Maps coordinate URLs', () => {
            expect(buildDirectionsUrl(null, null, 'https://www.google.com/maps/place/Store/@41.0082,28.9784,17z')).toBe(
                'https://www.google.com/maps/dir/?api=1&destination=41.0082%2C28.9784'
            );
        });
    });

    describe('extractGoogleMapsCoordinates', () => {
        it('parses coordinates from Google Maps embed URLs', () => {
            expect(extractGoogleMapsCoordinates('https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1234!2d28.9784!3d41.0082!2m3!1f0!2f0!3f0')).toEqual({
                latitude: 41.0082,
                longitude: 28.9784
            });
        });

        it('parses coordinates from place URLs with an @ marker', () => {
            expect(extractGoogleMapsCoordinates('https://www.google.com/maps/place/Store/@41.0082,28.9784,17z')).toEqual({
                latitude: 41.0082,
                longitude: 28.9784
            });
        });
    });

    describe('resolveCoordinates', () => {
        it('falls back to coordinates embedded in Google Maps data', () => {
            expect(resolveCoordinates({
                latitude: '',
                longitude: '',
                embedHtml: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1234!2d28.9784!3d41.0082!2m3!1f0!2f0!3f0"></iframe>'
            })).toEqual({
                latitude: 41.0082,
                longitude: 28.9784
            });
        });
    });

    describe('buildSupermarketContextLines', () => {
        const stores = [
            {
                $id: 'far',
                name: 'Far Market',
                latitude: 41.05,
                longitude: 29.05,
            },
            {
                $id: 'near',
                name: 'Near Market',
                latitude: 41.0082,
                longitude: 28.9784,
            },
            {
                $id: 'no-map',
                name: 'No Map Store',
                latitude: '',
                longitude: '',
            },
        ];

        it('sorts by distance when user location is available', () => {
            const text = buildSupermarketContextLines(stores, {
                latitude: 41.0082,
                longitude: 28.9784,
            });
            expect(text.indexOf('[STORE:near]')).toBeLessThan(text.indexOf('[STORE:far]'));
            expect(text).toContain('km');
        });

        it('sorts by name when user location is missing', () => {
            const text = buildSupermarketContextLines(stores, null);
            expect(text.indexOf('Far Market')).toBeLessThan(text.indexOf('Near Market'));
            expect(text).not.toMatch(/\d+\.?\d* km/);
        });

        it('lists stores without coordinates as location not on map', () => {
            const text = buildSupermarketContextLines(stores, null);
            expect(text).toContain('location not on map');
            expect(text).toContain('[STORE:no-map]');
        });
    });

    describe('resolvePriceSupermarketMeta', () => {
        it('resolves from expanded supermarkets relation', () => {
            const meta = resolvePriceSupermarketMeta({
                price: 60,
                supermarkets: [{ $id: 'sm-1', name: 'Migros', branchName: 'Kadıköy' }],
            });
            expect(meta.supermarketId).toBe('sm-1');
            expect(meta.label).toBe('Migros — Kadıköy');
        });

        it('resolves name via supermarketId lookup', () => {
            const meta = resolvePriceSupermarketMeta(
                { price: 45, supermarketId: 'sm-2' },
                [{ $id: 'sm-2', name: 'BIM' }]
            );
            expect(meta.name).toBe('BIM');
            expect(meta.label).toBe('BIM');
        });
    });

    describe('enrichProductPricesWithSupermarkets', () => {
        it('adds supermarketLabel on prices missing expanded relation', () => {
            const [product] = enrichProductPricesWithSupermarkets(
                [{ $id: 'p1', name: 'Twix', prices: [{ price: 50, supermarketId: 'sm-1' }] }],
                [{ $id: 'sm-1', name: 'CarrefourSA', branchName: 'Levent' }]
            );
            expect(product.prices[0].supermarketName).toBe('CarrefourSA');
            expect(product.prices[0].supermarketLabel).toBe('CarrefourSA — Levent');
        });
    });

    describe('isUserLocationAvailableForStores', () => {
        it('returns true for valid coordinates', () => {
            expect(isUserLocationAvailableForStores({ latitude: 41, longitude: 29 })).toBe(true);
        });
        it('returns false for invalid coordinates', () => {
            expect(isUserLocationAvailableForStores({ latitude: null, longitude: 29 })).toBe(false);
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
