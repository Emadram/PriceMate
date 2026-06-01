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
 * @param {import('appwrite').Models.Execution} execution
 */
export const executionFailureMessage = (execution) => {
    const errors = String(execution?.errors || '').trim();
    const logs = String(execution?.logs || '').trim();
    const body = getFunctionExecutionBody(execution);

    if (errors) return errors;
    if (body) {
        try {
            const parsed = JSON.parse(body);
            if (parsed?.error) return String(parsed.error);
        } catch {
            return body.slice(0, 500);
        }
    }
    if (logs) return logs.slice(0, 500);
    return `Function execution ${execution?.status || 'failed'}.`;
};
