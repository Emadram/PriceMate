import { executeOffProxy, OFF_PROXY_FUNCTION_ID } from './executeOffProxy';

export const isOpeProxyConfigured = () => Boolean(OFF_PROXY_FUNCTION_ID);

/**
 * Open Price Engine requests are routed through the shared off-proxy function.
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ ok: boolean, status?: number, data?: unknown, error?: string }>}
 */
export const callOpeProxy = (payload) => executeOffProxy(payload);

/**
 * @returns {Promise<string[]>}
 */
const enhanceOpeError = (message) => {
    const text = String(message || '');
    if (text.toLowerCase() === 'not found') {
        return (
            'Open Price Engine returned "Not Found" (usually an invalid or missing API key). ' +
            'Set OPENPRICEENGINE_API_KEY on the off-proxy function in Appwrite and redeploy.'
        );
    }
    return text || 'Open Price Engine request failed.';
};

export const fetchOpeStores = async () => {
    const result = await callOpeProxy({ kind: 'ope_stores' });
    if (!result?.ok) {
        throw new Error(enhanceOpeError(result?.error));
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
        throw new Error(enhanceOpeError(detail));
    }
    return result.data;
};
