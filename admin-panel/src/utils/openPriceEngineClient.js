import { executeOffProxy, OFF_PROXY_FUNCTION_ID } from './executeOffProxy';

export const isOpeProxyConfigured = () => Boolean(OFF_PROXY_FUNCTION_ID);

/**
 * Open Price Engine requests are routed through the shared off-proxy function.
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ ok: boolean, status?: number, data?: unknown, error?: string, upstreamUrl?: string }>}
 */
export const callOpeProxy = (payload) => executeOffProxy(payload);

const enhanceOpeError = (message, upstreamUrl) => {
    let text = String(message || '');
    const lower = text.toLowerCase();
    if (lower.includes('date not found')) {
        text =
            'Open Price Engine has no prices for this store, product, and dates. ' +
            'Use "Find OPE matches" to pick a store/name with data, currency Default or EUR, ' +
            'or a shorter date range.';
    } else if (lower === 'not found') {
        text =
            'Open Price Engine returned "Not Found". Redeploy off-proxy and run ping — ' +
            'you should see version 5.';
    }
    if (upstreamUrl) {
        text = `${text} (${upstreamUrl})`;
    }
    return text || 'Open Price Engine request failed.';
};

/**
 * @returns {Promise<string[]>}
 */
export const fetchOpeStores = async () => {
    const result = await callOpeProxy({ kind: 'ope_stores' });
    if (!result?.ok) {
        throw new Error(enhanceOpeError(result?.error, result?.upstreamUrl));
    }
    const stores = result.data?.stores;
    return Array.isArray(stores) ? stores : [];
};

/**
 * @param {string[]} stores
 * @returns {Promise<string[]>}
 */
export const fetchOpeProductNames = async (stores) => {
    if (!stores?.length) return [];
    const result = await callOpeProxy({
        kind: 'ope_product_names',
        stores,
    });
    if (!result?.ok) {
        throw new Error(enhanceOpeError(result?.error, result?.upstreamUrl));
    }
    const names = result.data?.names;
    return Array.isArray(names) ? names : [];
};

/**
 * Scan OPE stores for the best product/store match with historical points.
 * @param {{
 *   productQuery: string,
 *   start_date: string,
 *   end_date: string,
 *   stores?: string[],
 *   currency?: string,
 * }} params
 * @returns {Promise<{ candidates: Array<{ store: string, productname: string, pointCount: number, matchScore?: number }>, storesScanned?: number }>}
 */
export const probeOpeHistoricalMatches = async (params) => {
    const result = await callOpeProxy({
        kind: 'ope_probe_historical',
        productQuery: params.productQuery,
        start_date: params.start_date,
        end_date: params.end_date,
        stores: params.stores,
        currency: params.currency,
    });
    if (!result?.ok) {
        throw new Error(enhanceOpeError(result?.error, result?.upstreamUrl));
    }
    return {
        candidates: Array.isArray(result.data?.candidates) ? result.data.candidates : [],
        storesScanned: result.data?.storesScanned ?? 0,
    };
};

/**
 * @param {{ store: string, productname: string, start_date: string, end_date: string, currency?: string, productnameVariants?: string[] }} params
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
        productnameVariants: params.productnameVariants,
    });
    if (!result?.ok) {
        const detail =
            typeof result?.data === 'string'
                ? result.data
                : result?.data?.detail || result?.error || 'Historical price fetch failed.';
        throw new Error(enhanceOpeError(detail, result?.upstreamUrl));
    }
    return result.data;
};
