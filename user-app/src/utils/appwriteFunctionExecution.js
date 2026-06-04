const TERMINAL_STATUSES = new Set(['completed', 'failed']);

const CONSOLE_LOG_HINT =
    'If this persists, check Appwrite Console → off-proxy → Executions for logs.';

/**
 * Appwrite SDK v21+ uses responseBody; older SDKs used response.
 * @param {import('appwrite').Models.Execution | null | undefined} execution
 */
export const getFunctionExecutionBody = (execution) =>
    String(execution?.responseBody ?? execution?.response ?? '').trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {import('appwrite').Functions} functions
 * @param {string} functionId
 * @param {import('appwrite').Models.Execution} execution
 * @param {number} [maxWaitMs]
 */
export const waitForFunctionExecution = async (functions, functionId, execution, maxWaitMs = 90000) => {
    let current = execution;
    const start = Date.now();

    while (!TERMINAL_STATUSES.has(current.status) && Date.now() - start < maxWaitMs) {
        await sleep(400);
        current = await functions.getExecution({
            functionId,
            executionId: current.$id,
        });
    }

    return current;
};

/**
 * @param {import('appwrite').Models.Execution} execution
 */
export const executionFailureMessage = (execution) => {
    const errors = String(execution?.errors || '').trim();
    const logs = String(execution?.logs || '').trim();
    const body = getFunctionExecutionBody(execution);
    const code = execution?.responseStatusCode;

    if (errors) return errors;
    if (body) {
        try {
            const parsed = JSON.parse(body);
            if (parsed?.error) return String(parsed.error);
            if (parsed?.message) return String(parsed.message);
        } catch {
            return body.slice(0, 500);
        }
    }
    if (logs) return logs.slice(0, 500);

    const codeSuffix = code ? ` (HTTP ${code})` : '';
    return `Function runtime failed${codeSuffix}. ${CONSOLE_LOG_HINT}`;
};

/**
 * @param {import('appwrite').Models.Execution} execution
 */
export const parseFunctionExecutionJson = (execution) => {
    const status = execution?.status;

    if (!TERMINAL_STATUSES.has(status)) {
        return {
            ok: false,
            status: 0,
            error: 'Function execution timed out before finishing.',
        };
    }

    if (status === 'failed') {
        return {
            ok: false,
            status: execution.responseStatusCode || 500,
            error: executionFailureMessage(execution),
        };
    }

    const body = getFunctionExecutionBody(execution);
    if (!body) {
        return { ok: false, status: 0, error: 'Empty function response.' };
    }

    let parsed;
    try {
        parsed = JSON.parse(body);
    } catch {
        return { ok: false, status: execution.responseStatusCode || 0, error: body.slice(0, 500) };
    }

    if (parsed?.ok === false) {
        return {
            ok: false,
            status: parsed.status || execution.responseStatusCode || 500,
            error: parsed.error || 'Proxy request failed.',
            upstreamUrl: parsed.upstreamUrl,
            data: parsed.data,
        };
    }

    return parsed;
};

/**
 * @param {import('appwrite').Functions} functions
 * @param {string} functionId
 * @param {Record<string, unknown>} payload
 * @param {{ async?: boolean, maxWaitMs?: number }} [options]
 */
export const createFunctionExecutionJson = async (functions, functionId, payload, options = {}) => {
    const async = options.async ?? false;
    let execution = await functions.createExecution({
        functionId,
        body: JSON.stringify(payload),
        async,
    });

    if (!async && (!TERMINAL_STATUSES.has(execution.status) || !getFunctionExecutionBody(execution))) {
        execution = await waitForFunctionExecution(
            functions,
            functionId,
            execution,
            options.maxWaitMs
        );
    }

    return parseFunctionExecutionJson(execution);
};
