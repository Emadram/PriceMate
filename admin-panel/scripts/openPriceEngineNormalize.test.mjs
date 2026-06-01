import assert from 'node:assert/strict';
import { normalizeOpeHistoricalResponse } from '../src/utils/openPriceEngineNormalize.js';

const sampleList = [
    { productname: 'Milk', price: 1.29, date: '2024-06-01' },
    { productname: 'Milk', price: 1.35, date: '2024-07-01' },
];

const fromList = normalizeOpeHistoricalResponse(sampleList);
assert.equal(fromList.length, 2);
assert.equal(fromList[0].price, 1.29);
assert.equal(fromList[0].timestamp, new Date('2024-06-01').toISOString());

const nested = normalizeOpeHistoricalResponse({
    results: [{ Price: '2.50', Date: '2025-01-15T12:00:00Z', store: 'woolworths' }],
});
assert.equal(nested.length, 1);
assert.equal(nested[0].price, 2.5);
assert.equal(nested[0].rawStore, 'woolworths');

const dupes = normalizeOpeHistoricalResponse([
    { price: 5, date: '2024-01-01' },
    { price: 5, date: '2024-01-01' },
]);
assert.equal(dupes.length, 1);

console.log('openPriceEngineNormalize.test.mjs: OK');
