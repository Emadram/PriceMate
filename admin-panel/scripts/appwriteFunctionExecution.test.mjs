import assert from 'node:assert/strict';
import {
    getFunctionExecutionBody,
    executionFailureMessage,
    parseFunctionExecutionJson,
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

const proxyError = parseFunctionExecutionJson({
    status: 'completed',
    responseBody: JSON.stringify({ ok: false, status: 401, error: 'Invalid API key' }),
});
assert.equal(proxyError.ok, false);
assert.equal(proxyError.error, 'Invalid API key');

const runtimeFailed = parseFunctionExecutionJson({ status: 'failed', responseStatusCode: 500 });
assert.equal(runtimeFailed.ok, false);
assert.match(runtimeFailed.error, /runtime failed|Executions/i);

console.log('appwriteFunctionExecution.test.mjs: OK');
