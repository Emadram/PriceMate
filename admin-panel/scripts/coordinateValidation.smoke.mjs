import assert from 'node:assert/strict';
import { validateSupermarketCoordinates } from '../src/utils/coordinateValidation.js';

assert.equal(validateSupermarketCoordinates(41.01, 29.02), '');
assert.match(validateSupermarketCoordinates('abc', 29.02), /numeric/);
assert.match(validateSupermarketCoordinates(0, 0), /not allowed/);
assert.match(validateSupermarketCoordinates(100, 29.02), /between -90 and 90/);

console.log('coordinate validation smoke test passed');