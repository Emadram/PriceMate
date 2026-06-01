const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OPE_API_BASE = 'https://openpricengine.com/api/v1';
/** Bump when redeploying; exposed via { "kind": "ping" } so you can confirm active deployment. */
const OFF_PROXY_VERSION = '3';
const OPE_STORE_PATHS = ['/stores_tracked', '/available_stores/plans', '/countries_tracked'];

// Simple TTL LRU cache
class SimpleCache {
    constructor(limit = 1000) {
        this.limit = limit;
        this.map = new Map(); // key -> { value, expires }
    }

    _prune() {
        if (this.map.size <= this.limit) return;
        const toRemove = this.map.size - this.limit;
        const keys = this.map.keys();
        for (let i = 0; i < toRemove; i++) {
            const k = keys.next().value;
            this.map.delete(k);
        }
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (entry.expires && Date.now() > entry.expires) {
            this.map.delete(key);
            return undefined;
        }
        // refresh position
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value, ttlMs = 0) {
        const expires = ttlMs > 0 ? Date.now() + ttlMs : null;
        this.map.delete(key);
        this.map.set(key, { value, expires });
        this._prune();
    }

    has(key) {
        return this.get(key) !== undefined;
    }
}

const cache = new SimpleCache(2000);
const inflight = new Map(); // key -> Promise

const parsePayload = (req) => {
    if (req?.body != null && req.body !== '') {
        if (typeof req.body === 'object') {
            return req.body;
        }
        if (typeof req.body === 'string') {
            try {
                return JSON.parse(req.body);
            } catch {
                return {};
            }
        }
    }
    return req?.query || {};
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseRetryAfter = (header) => {
    if (!header) return null;
    const s = header.trim();
    const seconds = Number(s);
    if (!Number.isNaN(seconds)) return seconds * 1000;
    const date = Date.parse(s);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
    return null;
};

async function fetchWithRetry(url, opts = {}, maxRetries = 4, log) {
    let attempt = 0;
    let lastErr = null;
    while (attempt <= maxRetries) {
        try {
            const requestOpts = { ...opts };
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeout = requestOpts.timeout || 10000;
            if (controller) {
                setTimeout(() => controller.abort(), timeout);
                requestOpts.signal = controller.signal;
            }
            delete requestOpts.timeout;

            const res = await fetch(url, requestOpts);
            if (res.ok) return res;

            // handle 429 Retry-After
            const ra = parseRetryAfter(res.headers.get('retry-after'));
            if (ra != null) {
                const jitter = Math.floor(Math.random() * Math.min(1000, ra));
                await sleep(ra + jitter);
                attempt++;
                continue;
            }

            // for other 5xx errors, retry
            if (res.status >= 500 && res.status < 600) {
                const base = 300 * Math.pow(2, attempt); // 300ms, 600ms, 1200ms...
                const jitter = Math.random() * base * 0.5;
                await sleep(base + jitter);
                attempt++;
                continue;
            }

            return res;
        } catch (err) {
            lastErr = err;
            // network / aborted
            const base = 300 * Math.pow(2, attempt);
            const jitter = Math.random() * base * 0.5;
            if (log) log(`Proxy fetch attempt ${attempt} failed: ${String(err)}; retrying after ${Math.round(base + jitter)}ms`);
            await sleep(base + jitter);
            attempt++;
            continue;
        }
    }
    throw lastErr || new Error('Fetch failed after retries');
}

const parseOpeStoresList = (data) => {
    const pickName = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        return String(
            item.store ||
                item.name ||
                item.store_name ||
                item.slug ||
                item.id ||
                ''
        ).trim();
    };

    if (!data) return [];
    if (Array.isArray(data)) {
        return [...new Set(data.map(pickName).filter(Boolean))].sort();
    }
    if (Array.isArray(data.stores)) {
        return [...new Set(data.stores.map(pickName).filter(Boolean))].sort();
    }
    if (typeof data === 'object') {
        const values = Object.values(data).flatMap((v) => {
            if (Array.isArray(v)) return v.map(pickName);
            return [pickName(v)];
        });
        return [...new Set(values.filter(Boolean))].sort();
    }
    return [];
};

const buildOpeHistoricalUrl = (payload) => {
    const store = String(payload.store || '').trim();
    const productname = String(payload.productname || payload.productName || '').trim();
    const startDate = String(payload.start_date || payload.startDate || '').trim();
    const endDate = String(payload.end_date || payload.endDate || '').trim();

    if (!store || !productname || !startDate || !endDate) {
        return { error: 'Missing store, productname, start_date, or end_date.' };
    }

    const params = new URLSearchParams();
    params.set('productname', productname);
    params.set('start_date', startDate);
    params.set('end_date', endDate);
    const currency = String(payload.currency || '').trim();
    if (currency && currency.toLowerCase() !== 'default') {
        params.set('currency', currency);
    }

    const url = `${OPE_API_BASE}/${encodeURIComponent(store)}/products/prices/query?${params.toString()}`;
    return { url };
};

const runProxiedFetch = async ({ cacheKey, url, cacheTtl, fetchOpts, transform, log }) => {
    const cached = cache.get(cacheKey);
    if (cached) {
        log(`Proxy cache hit: ${cacheKey}`);
        return { status: 200, data: cached };
    }

    if (inflight.has(cacheKey)) {
        log(`Proxy dedupe wait: ${cacheKey}`);
        try {
            return await inflight.get(cacheKey);
        } catch {
            inflight.delete(cacheKey);
        }
    }

    const fetchPromise = (async () => {
        try {
            const response = await fetchWithRetry(url, fetchOpts, 4, log);
            const contentType = response.headers.get('content-type') || '';
            let data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) {
                throw { status: response.status, data, url };
            }

            if (transform) {
                data = transform(data);
            }

            try {
                cache.set(cacheKey, data, cacheTtl);
            } catch {
                // ignore cache set errors
            }

            return { status: response.status, data };
        } finally {
            inflight.delete(cacheKey);
        }
    })();

    inflight.set(cacheKey, fetchPromise);
    return fetchPromise;
};

/** Real status lives in JSON body; omit HTTP status arg (some runtimes 503 on res.json(_, code)). */
const sendJson = (res, payload) => res.json(payload);

const formatUpstreamError = (err, fallback) => {
    if (!err?.data) return fallback;
    if (typeof err.data === 'string') return err.data.slice(0, 500);
    if (typeof err.data?.detail === 'string') return err.data.detail;
    if (typeof err.data?.error === 'string') return err.data.error;
    if (typeof err.data?.message === 'string') return err.data.message;
    try {
        return JSON.stringify(err.data).slice(0, 500);
    } catch {
        return fallback;
    }
};

const getOpeApiKey = () =>
    String(process.env.OPENPRICEENGINE_API_KEY || process.env.OPE_API_KEY || '').trim();

const buildOpeHeaders = (rawKey) => {
    let key = String(rawKey || '').trim();
    if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
    ) {
        key = key.slice(1, -1).trim();
    }
    return {
        accept: 'application/json',
        Authorization: key,
    };
};

const mapOpeUpstreamError = (status, data, fallback, url = '') => {
    const detail = formatUpstreamError({ data }, '');
    const normalized = detail.toLowerCase();
    const urlHint = url ? ` URL: ${url}` : '';

    if (status === 403 || normalized.includes('api key')) {
        return (detail || 'Invalid or missing Open Price Engine API key.') + urlHint;
    }

    if (status === 404) {
        const base =
            detail && detail.toLowerCase() !== 'not found'
                ? `Open Price Engine 404: ${detail}`
                : 'Open Price Engine 404 (wrong route, store slug, or plan).';
        return (
            `${base}${urlHint} Deploy off-proxy v${OFF_PROXY_VERSION} (ping to verify). ` +
            'Routes: /stores_tracked and /{store}/products/prices/query.'
        );
    }

    return (detail || fallback) + urlHint;
};

const fetchOpeStoreList = async (apiKey, log) => {
    const headers = buildOpeHeaders(apiKey);
    const attempts = [];

    for (const path of OPE_STORE_PATHS) {
        const url = `${OPE_API_BASE}${path}`;
        try {
            const response = await fetchWithRetry(url, { timeout: 15000, headers }, 2, log);
            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) {
                attempts.push({
                    path,
                    status: response.status,
                    detail: formatUpstreamError({ data }, response.statusText),
                });
                continue;
            }

            let stores = parseOpeStoresList(data);
            if (!stores.length && data && typeof data === 'object') {
                stores = parseOpeStoresList(data.stores ?? data.data ?? data.results);
            }

            if (stores.length > 0) {
                log(`OPE stores: ${stores.length} from ${path}`);
                return { stores, source: path };
            }

            attempts.push({ path, status: response.status, detail: 'Empty store list in response' });
        } catch (err) {
            attempts.push({
                path,
                status: err?.status || 0,
                detail: formatUpstreamError(err, String(err?.message || err)),
            });
        }
    }

    throw {
        status: 404,
        data: { detail: 'No OPE store list endpoint returned stores', attempts },
        url: `${OPE_API_BASE}${OPE_STORE_PATHS[0]}`,
    };
};

const handler = async ({ req, res, log, error }) => {
    try {
        const payload = parsePayload(req);
        const kind = String(payload.kind || payload.type || '').toLowerCase();

        if (kind === 'ping') {
            return sendJson(res, {
                ok: true,
                status: 200,
                data: {
                    pong: true,
                    version: OFF_PROXY_VERSION,
                    opeRoutes: {
                        stores: OPE_STORE_PATHS,
                        historical: '/{store}/products/prices/query',
                    },
                },
            });
        }

        if (!kind) {
            return sendJson(res, { ok: false, status: 400, error: 'Missing kind.' });
        }

        let url = '';
        let cacheTtl = 0;
        let fetchOpts = { timeout: 10000 };
        let transform = null;

        if (kind === 'barcode') {
            const barcode = String(payload.barcode || '').trim();
            if (!barcode) {
                return sendJson(res, { ok: false, status: 400, error: 'Missing barcode.' });
            }
            url = `${OFF_API_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json`;
            cacheTtl = 1000 * 60 * 60 * 24; // 24h for product lookups
        } else if (kind === 'search') {
            const query = String(payload.query || payload.q || '').trim();
            if (!query) {
                return sendJson(res, { ok: false, status: 400, error: 'Missing search query.' });
            }
            const pageSize = Math.min(Math.max(Number(payload.pageSize || 5), 1), 20);
            url = `${OFF_API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageSize}`;
            cacheTtl = 1000 * 60 * 10; // 10 minutes for searches
        } else if (kind === 'ope_stores') {
            const apiKey = getOpeApiKey();
            if (!apiKey) {
                return sendJson(res, {
                    ok: false,
                    status: 500,
                    error: 'OPENPRICEENGINE_API_KEY is not configured on off-proxy.',
                });
            }
            const storeList = await fetchOpeStoreList(apiKey, log);
            return sendJson(res, { ok: true, status: 200, data: storeList });
        } else if (kind === 'ope_historical') {
            const apiKey = getOpeApiKey();
            if (!apiKey) {
                return sendJson(res, {
                    ok: false,
                    status: 500,
                    error: 'OPENPRICEENGINE_API_KEY is not configured on off-proxy.',
                });
            }
            const built = buildOpeHistoricalUrl(payload);
            if (built.error) {
                return sendJson(res, { ok: false, status: 400, error: built.error });
            }
            url = built.url;
            cacheTtl = 1000 * 60 * 15;
            fetchOpts = {
                timeout: 15000,
                headers: buildOpeHeaders(apiKey),
            };
        } else {
            return sendJson(res, {
                ok: false,
                status: 400,
                error: 'Unsupported kind. Use barcode, search, ope_stores, or ope_historical.',
            });
        }

        const cacheKey = url;
        const result = await runProxiedFetch({
            cacheKey,
            url,
            cacheTtl,
            fetchOpts,
            transform,
            log,
        });

        return sendJson(res, { ok: true, status: result.status || 200, data: result.data });
    } catch (err) {
        const kind = String(parsePayload(req).kind || '').toLowerCase();
        const opeKinds = ['ope_stores', 'ope_historical'];
        log(`off-proxy error (${kind || 'unknown'}): ${String(err?.message || err)}`);
        if (error) {
            error(String(err?.message || err));
        }
        if (err && err.status) {
            const fallback = opeKinds.includes(kind)
                ? 'Open Price Engine request failed.'
                : 'Open Food Facts request failed.';
            const message = opeKinds.includes(kind)
                ? mapOpeUpstreamError(err.status, err.data, fallback, err.url || url)
                : formatUpstreamError(err, fallback);
            return sendJson(res, {
                ok: false,
                status: err.status,
                error: message,
                upstreamUrl: err.url || url || undefined,
                data: err.data,
            });
        }
        return sendJson(res, {
            ok: false,
            status: 500,
            error: String(err?.message || err || 'Proxy error.'),
        });
    }
};

export default handler;
