import assert from 'node:assert/strict';
import { buildBackfillPayloads } from '../src/utils/priceHistoryBackfill.js';

const existing = new Set(['price-1']);

const prices = [
    {
        $id: 'price-1',
        price: 10,
        products: { $id: 'p1' },
        supermarkets: { $id: 's1' },
        $updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
        $id: 'price-2',
        price: 20,
        products: 'p2',
        supermarkets: 's2',
        $createdAt: '2025-02-01T00:00:00.000Z',
    },
    {
        $id: 'price-3',
        price: 30,
        products: null,
        supermarkets: { $id: 's3' },
    },
];

const { payloads, skippedExisting, skippedInvalid } = buildBackfillPayloads(prices, existing);

assert.equal(skippedExisting, 1);
assert.equal(skippedInvalid, 1);
assert.equal(payloads.length, 1);
assert.equal(payloads[0].priceId, 'price-2');
assert.equal(payloads[0].productId, 'p2');
assert.equal(payloads[0].supermarketId, 's2');
assert.equal(payloads[0].timestamp, '2025-02-01T00:00:00.000Z');

console.log('priceHistoryBackfill.test.mjs: OK');
