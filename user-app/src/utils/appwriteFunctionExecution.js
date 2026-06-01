const TERMINAL_STATUSES = new Set(['completed', 'failed']);

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

    if (execution.status === 'failed') {
        const body = getFunctionExecutionBody(execution);
        let detail = execution.errors || 'Function execution failed.';
        if (body) {
            try {
                const parsed = JSON.parse(body);
                detail = parsed?.error || detail;
            } catch {
                detail = body;
            }
        }
        return { ok: false, status: execution.responseStatusCode || 500, error: detail };
    }

    const body = getFunctionExecutionBody(execution);
    if (!body) {
        return { ok: false, status: 0, error: 'Empty function response.' };
    }

    return JSON.parse(body);
};
