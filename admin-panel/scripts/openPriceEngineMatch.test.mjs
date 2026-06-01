import assert from 'node:assert/strict';
import {
    scoreProductMatch,
    rankProductNames,
    buildProductNameVariants,
} from '../src/utils/openPriceEngineMatch.js';

assert.ok(scoreProductMatch('Coca-Cola', 'Coca Cola') >= 80);
assert.ok(scoreProductMatch('coca cola', 'Coca-Cola Zero 1.5L') >= 40);
assert.equal(rankProductNames('milk', ['Milk', 'Bread', 'Almond milk'])[0].name, 'Milk');

const variants = buildProductNameVariants('Coca-Cola');
assert.ok(variants.includes('Coca-Cola'));
assert.ok(variants.some((v) => v.includes('Coca Cola') || v === 'Coca-Cola'));

console.log('openPriceEngineMatch.test.mjs: OK');
