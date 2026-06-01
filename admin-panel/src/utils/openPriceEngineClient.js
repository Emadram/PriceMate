import { functions } from '../lib/appwrite';

const OFF_PROXY_FUNCTION_ID = import.meta.env.VITE_APPWRITE_FUNCTION_OFF_PROXY || '';

export const isOpeProxyConfigured = () => Boolean(OFF_PROXY_FUNCTION_ID);

/**
 * Open Price Engine requests are routed through the shared off-proxy function.
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ ok: boolean, status?: number, data?: unknown, error?: string } | null>}
 */
export const callOpeProxy = async (payload) => {
    if (!OFF_PROXY_FUNCTION_ID) {
        return {
            ok: false,
            status: 0,
            error: 'VITE_APPWRITE_FUNCTION_OFF_PROXY is not configured.',
        };
    }

    try {
        const execution = await functions.createExecution(
            OFF_PROXY_FUNCTION_ID,
            JSON.stringify(payload),
            false
        );
        if (!execution?.response) {
            return { ok: false, status: 0, error: 'Empty proxy response.' };
        }
        return JSON.parse(execution.response);
    } catch (err) {
        console.error('OPE via off-proxy error:', err);
        return { ok: false, status: 0, error: err?.message || 'Proxy error' };
    }
};

/**
 * @returns {Promise<string[]>}
 */
export const fetchOpeStores = async () => {
    const result = await callOpeProxy({ kind: 'ope_stores' });
    if (!result?.ok) {
        throw new Error(result?.error || 'Failed to load Open Price Engine stores.');
    }
    const stores = result.data?.stores;
    return Array.isArray(stores) ? stores : [];
};

/**
 * @param {{ store: string, productname: string, start_date: string, end_date: string, currency?: string }} params
 * @returns {Promise<unknown>}
 */
export const fetchOpeHistoricalPrices = async (params) => {
    const result = await callOpeProxy({
        kind: 'ope_historical',
        store: params.store,
        productname: params.productname,
        start_date: params.start_date,
        end_date: params.end_date,
        currency: params.currency,
    });
    if (!result?.ok) {
        const detail =
            typeof result?.data === 'string'
                ? result.data
                : result?.data?.detail || result?.error || 'Historical price fetch failed.';
        throw new Error(String(detail));
    }
    return result.data;
};
