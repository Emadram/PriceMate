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
