import assert from 'node:assert/strict';
import { buildOpeImportPayloads } from '../src/utils/openPriceEngineImport.js';

const rows = [
    { price: 10, timestamp: '2024-01-01T00:00:00.000Z' },
    { price: 10, timestamp: '2024-01-01T00:00:00.000Z' },
    { price: 11, timestamp: '2024-02-01T00:00:00.000Z' },
];

const { payloads, skipped } = buildOpeImportPayloads(rows, {
    productId: 'prod-1',
    supermarketId: 'store-1',
    opeStore: 'woolworths',
});

assert.equal(skipped, 1);
assert.equal(payloads.length, 2);
assert.equal(payloads[0].productId, 'prod-1');
assert.equal(payloads[0].supermarketId, 'store-1');
assert.equal(payloads[0].priceId, null);
assert.match(payloads[0].priceChangeReason, /Open Price Engine import/);
assert.match(payloads[0].priceChangeReason, /woolworths/);

const empty = buildOpeImportPayloads(rows, { productId: '', supermarketId: 's' });
assert.equal(empty.payloads.length, 0);
assert.equal(empty.skipped, 3);

console.log('openPriceEngineImport.test.mjs: OK');
