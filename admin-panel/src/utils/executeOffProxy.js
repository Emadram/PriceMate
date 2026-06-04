import { account, functions } from '../lib/appwrite';
import {
    getFunctionExecutionBody,
    parseFunctionExecutionJson,
    waitForFunctionExecution,
} from './appwriteFunctionExecution';

export const OFF_PROXY_FUNCTION_ID = import.meta.env.VITE_APPWRITE_FUNCTION_OFF_PROXY || '';

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

const EXECUTE_PERMISSION_HINT =
    'In Appwrite Console: open the off-proxy function → Settings → Execute access → add Users (or your admins team), save, then redeploy the function.';

const mapExecuteError = (err) => {
    const message = String(err?.message || err || '');
    const type = String(err?.type || '');
    const lower = message.toLowerCase();

    if (
        lower.includes("action 'execute'") ||
        lower.includes('execute" permission') ||
        lower.includes('missing "execute"') ||
        type === 'general_unauthorized_scope'
    ) {
        return `Function execute permission denied. ${EXECUTE_PERMISSION_HINT}`;
    }

    if (lower.includes('guests') && lower.includes('users')) {
        return `Logged-in users cannot execute this function. ${EXECUTE_PERMISSION_HINT}`;
    }

    if (lower.includes('jwt') && lower.includes('cookie')) {
        return 'Authentication conflict. Refresh the page and try again while logged in as admin.';
    }

    return message || 'Proxy error';
};

/**
 * Run off-proxy with the admin session cookie (same client as login).
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ ok: boolean, status?: number, data?: unknown, error?: string }>}
 */
export const executeOffProxy = async (payload) => {
    if (!OFF_PROXY_FUNCTION_ID) {
        return {
            ok: false,
            status: 0,
            error: 'VITE_APPWRITE_FUNCTION_OFF_PROXY is not configured.',
        };
    }

    try {
        await account.get();
    } catch {
        return {
            ok: false,
            status: 401,
            error: 'Admin session expired. Log in again, then retry.',
        };
    }

    try {
        let execution = await functions.createExecution({
            functionId: OFF_PROXY_FUNCTION_ID,
            body: JSON.stringify(payload),
            async: false,
        });

        if (!TERMINAL_STATUSES.has(execution.status) || !getFunctionExecutionBody(execution)) {
            execution = await waitForFunctionExecution(functions, OFF_PROXY_FUNCTION_ID, execution);
        }

        const result = parseFunctionExecutionJson(execution);
        if (result?.ok === false) {
            console.error('off-proxy request failed:', {
                executionId: execution.$id,
                status: execution.status,
                responseStatusCode: execution.responseStatusCode,
                error: result.error,
                upstreamUrl: result.upstreamUrl,
                data: result.data,
            });
        }
        return result;
    } catch (err) {
        console.error('off-proxy execution error:', err);
        return {
            ok: false,
            status: err?.code || 0,
            error: mapExecuteError(err),
        };
    }
};
