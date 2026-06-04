import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildTimeline,
    buildTimelineFixedCount,
    buildScatteredTimeline,
    createRng,
    hashSeed,
    inflationMultiplierAt,
    generateSyntheticHistory,
    countPromoPoints,
} from '../lib/syntheticPriceHistory.js';
import { resolvePriceBand, resolveAnchorPrice, clampToBand } from '../lib/groceryPriceAnchors.js';

describe('groceryPriceAnchors', () => {
    it('detects milk band', () => {
        const band = resolvePriceBand('Whole Milk 1L', '1L');
        assert.equal(band.category, 'dairy');
        assert.ok(band.min >= 30);
    });

    it('anchors from current price', () => {
        const { anchor, source } = resolveAnchorPrice(34.5, { name: 'Whole Milk 1L' });
        assert.equal(source, 'current');
        assert.ok(anchor >= 30 && anchor <= 55);
    });

    it('clamps absurd values toward band mid', () => {
        const band = resolvePriceBand('Water', '1.5L');
        assert.equal(clampToBand(0.5, band), band.mid);
    });
});

describe('buildTimeline', () => {
    it('produces at least minPoints between 2023 and 2025', () => {
        const start = new Date(Date.UTC(2023, 0, 1));
        const end = new Date(Date.UTC(2025, 4, 20));
        const timeline = buildTimeline(start, end, 50);
        assert.ok(timeline.length >= 50);
        assert.equal(timeline[0].getTime(), start.getTime());
    });
});

describe('buildScatteredTimeline', () => {
    const start = new Date(Date.UTC(2023, 0, 1));
    const end = new Date(Date.UTC(2025, 4, 20));

    it('returns exactly totalPoints strictly increasing timestamps', () => {
        const rng = createRng(hashSeed('prod_scatter_test'));
        const timeline = buildScatteredTimeline(start, end, 20, rng);
        assert.equal(timeline.length, 20);
        assert.equal(timeline[0].getTime(), start.getTime());
        assert.equal(timeline[timeline.length - 1].getTime(), end.getTime());
        for (let i = 1; i < timeline.length; i++) {
            assert.ok(timeline[i].getTime() > timeline[i - 1].getTime());
        }
    });

    it('is less uniform than evenly spaced timeline', () => {
        const rng = createRng(hashSeed('prod_scatter_variance'));
        const scattered = buildScatteredTimeline(start, end, 20, rng);
        const even = buildTimelineFixedCount(start, end, 20);
        const gaps = (arr) =>
            arr.slice(1).map((d, i) => d.getTime() - arr[i].getTime());
        const variance = (values) => {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
        };
        assert.ok(variance(gaps(scattered)) > variance(gaps(even)) * 1.5);
    });
});

describe('inflationMultiplierAt', () => {
    it('is lower in 2023 than at end date', () => {
        const end = new Date(Date.UTC(2025, 4, 20));
        const early = new Date(Date.UTC(2023, 0, 15));
        const late = new Date(Date.UTC(2025, 4, 1));
        assert.ok(inflationMultiplierAt(early, end) < inflationMultiplierAt(late, end));
        assert.ok(inflationMultiplierAt(late, end) <= 1.01);
    });
});

describe('generateSyntheticHistory', () => {
    const startDate = new Date(Date.UTC(2023, 0, 1));
    const endDate = new Date(Date.UTC(2025, 4, 20));

    it('returns at least 50 payloads for one store', () => {
        const payloads = generateSyntheticHistory({
            productId: 'prod_test_001',
            stores: [{ supermarketId: 'store_a', priceId: 'price_a', currentPrice: 34.5 }],
            productMeta: { name: 'Whole Milk 1L', unit: '1L' },
            startDate,
            endDate,
            minPoints: 50,
        });
        assert.ok(payloads.length >= 50);
        assert.ok(payloads.every((p) => p.price > 0));
        assert.ok(payloads.every((p) => p.productId === 'prod_test_001'));
        assert.ok(payloads.every((p) => p.priceId === 'price_a'));
    });

    it('ends at anchor price for each store', () => {
        const payloads = generateSyntheticHistory({
            productId: 'prod_test_002',
            stores: [
                { supermarketId: 'store_a', priceId: 'price_a', currentPrice: 40 },
                { supermarketId: 'store_b', priceId: 'price_b', currentPrice: 38 },
            ],
            productMeta: { name: 'Cola 1L' },
            startDate,
            endDate,
            minPoints: 50,
        });
        const lastA = payloads.filter((p) => p.supermarketId === 'store_a').at(-1);
        const lastB = payloads.filter((p) => p.supermarketId === 'store_b').at(-1);
        assert.ok(Math.abs(lastA.price - 40) < 0.02 || lastA.price === 40);
        assert.ok(Math.abs(lastB.price - 38) < 0.02 || lastB.price === 38);
    });

    it('is deterministic for same productId', () => {
        const opts = {
            productId: 'prod_deterministic',
            stores: [{ supermarketId: 's1', priceId: 'price_s1', currentPrice: 25 }],
            productMeta: { name: 'Chips' },
            startDate,
            endDate,
            minPoints: 52,
        };
        const a = generateSyntheticHistory(opts);
        const b = generateSyntheticHistory(opts);
        assert.equal(a.length, b.length);
        assert.equal(a[10].price, b[10].price);
        assert.equal(a[10].timestamp, b[10].timestamp);
    });

    it('includes some promotional points', () => {
        const payloads = generateSyntheticHistory({
            productId: 'prod_promo',
            stores: [{ supermarketId: 's1', priceId: 'price_promo', currentPrice: 30 }],
            productMeta: { name: 'Bread' },
            startDate,
            endDate,
            minPoints: 60,
        });
        const promos = countPromoPoints(payloads);
        assert.ok(promos >= 1);
        assert.ok(promos < payloads.length * 0.25);
    });

    it('first point is below end anchor (inflation)', () => {
        const payloads = generateSyntheticHistory({
            productId: 'prod_inflation',
            stores: [{ supermarketId: 's1', priceId: 'price_infl', currentPrice: 50 }],
            productMeta: { name: 'Rice 1kg' },
            startDate,
            endDate,
            minPoints: 50,
        });
        const first = payloads[0];
        const last = payloads.filter((p) => p.supermarketId === 's1').at(-1);
        assert.ok(first.price < last.price * 0.95);
    });

    it('scattered mode returns exactly totalPoints rows', () => {
        const payloads = generateSyntheticHistory({
            productId: 'prod_scattered_20',
            stores: [{ supermarketId: 's1', priceId: 'price_sc', currentPrice: 42 }],
            productMeta: { name: 'Ice Cream' },
            startDate,
            endDate,
            totalPoints: 20,
            timelineMode: 'scattered',
        });
        assert.equal(payloads.length, 20);
    });
});

describe('createRng', () => {
    it('hashSeed is stable', () => {
        assert.equal(hashSeed('abc'), hashSeed('abc'));
        assert.notEqual(hashSeed('abc'), hashSeed('abd'));
    });

    it('rng returns values in [0,1)', () => {
        const rng = createRng(12345);
        for (let i = 0; i < 20; i++) {
            const v = rng();
            assert.ok(v >= 0 && v < 1);
        }
    });
});
