import assert from 'node:assert/strict';
import {
    getFunctionExecutionBody,
    executionFailureMessage,
} from '../src/utils/appwriteFunctionExecution.js';

assert.equal(getFunctionExecutionBody({ responseBody: '{"ok":true}' }), '{"ok":true}');
assert.equal(getFunctionExecutionBody({ response: '{"legacy":true}' }), '{"legacy":true}');
assert.equal(getFunctionExecutionBody({}), '');

const failed = executionFailureMessage({
    status: 'failed',
    errors: 'timeout',
    responseBody: '{"error":"upstream"}',
});
assert.match(failed, /timeout|upstream/);

console.log('appwriteFunctionExecution.test.mjs: OK');
