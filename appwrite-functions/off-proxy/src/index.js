const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OPE_API_BASE = 'https://openpricengine.com/api/v1';

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
    if (req?.body) {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
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

    const url = `${OPE_API_BASE}/${encodeURIComponent(store)}/products/query?${params.toString()}`;
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
                throw { status: response.status, data };
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

/** Always HTTP 200 from the executor; real status lives in the JSON body (avoids Appwrite non-2xx failures). */
const sendJson = (res, payload) => res.json(payload, 200);

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

const handler = async ({ req, res, log, error }) => {
    try {
        const payload = parsePayload(req);
        const kind = String(payload.kind || payload.type || '').toLowerCase();

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
            const apiKey = process.env.OPENPRICEENGINE_API_KEY || '';
            if (!apiKey) {
                return sendJson(res, {
                    ok: false,
                    status: 500,
                    error: 'OPENPRICEENGINE_API_KEY is not configured on off-proxy.',
                });
            }
            url = `${OPE_API_BASE}/stores`;
            cacheTtl = 1000 * 60 * 60 * 6;
            fetchOpts = {
                timeout: 15000,
                headers: {
                    accept: 'application/json',
                    Authorization: apiKey,
                },
            };
            transform = (data) => ({ stores: parseOpeStoresList(data) });
        } else if (kind === 'ope_historical') {
            const apiKey = process.env.OPENPRICEENGINE_API_KEY || '';
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
                headers: {
                    accept: 'application/json',
                    Authorization: apiKey,
                },
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
            return sendJson(res, {
                ok: false,
                status: err.status,
                error: formatUpstreamError(err, fallback),
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

module.exports = handler;
module.exports.default = handler;
