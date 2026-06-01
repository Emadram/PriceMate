const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OPE_API_BASE = 'https://openpricengine.com/api/v1';
/** Bump when redeploying; exposed via { "kind": "ping" } so you can confirm active deployment. */
const OFF_PROXY_VERSION = '5';
const OPE_STORE_PATHS = ['/stores_tracked', '/available_stores/plans', '/countries_tracked'];
const MAX_PROBE_STORES = 12;
const MAX_PRODUCT_NAMES_PER_STORE = 100;
const MAX_PROBE_CANDIDATES = 10;

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

const buildOpeHistoricalUrls = (payload) => {
    const store = String(payload.store || '').trim();
    const productname = String(payload.productname || payload.productName || '').trim();
    const startDate = String(payload.start_date || payload.startDate || '').trim();
    const endDate = String(payload.end_date || payload.endDate || '').trim();

    if (!store || !productname || !startDate || !endDate) {
        return { error: 'Missing store, productname, start_date, or end_date.' };
    }

    if (startDate > endDate) {
        return { error: 'start_date must be on or before end_date.' };
    }

    const baseParams = new URLSearchParams();
    baseParams.append('productname', productname);
    baseParams.set('start_date', startDate);
    baseParams.set('end_date', endDate);

    const currency = String(payload.currency || '').trim();
    const withCurrency = new URLSearchParams(baseParams);
    let includeCurrency = false;
    if (currency && currency.toLowerCase() !== 'default') {
        withCurrency.set('currency', currency);
        includeCurrency = true;
    }

    const path = `${OPE_API_BASE}/${encodeURIComponent(store)}/products/prices/query`;
    return {
        url: `${path}?${withCurrency.toString()}`,
        urlWithoutCurrency: `${path}?${baseParams.toString()}`,
        includeCurrency,
    };
};

const isOpeDateNotFoundError = (err) => {
    const detail = formatUpstreamError(err, '').toLowerCase();
    return err?.status === 404 && detail.includes('date not found');
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

    if (normalized.includes('date not found')) {
        return (
            'Open Price Engine has no price history for this store, product, and date range.' +
            `${urlHint} Try currency "Default" or EUR (not USD) for European stores like Jumbo, ` +
            'a simpler product name (e.g. "cola"), or a shorter date range.'
        );
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

const normalizeProductLabel = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const scoreProductMatch = (query, name) => {
    const q = normalizeProductLabel(query);
    const n = normalizeProductLabel(name);
    if (!q || !n) return 0;
    if (n === q) return 100;
    if (n.includes(q)) return 95;
    const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
    if (!tokens.length) return 0;
    const hits = tokens.filter((t) => n.includes(t)).length;
    return hits === 0 ? 0 : Math.round((hits / tokens.length) * 85);
};

const parseOpeProductNamesList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) {
        return data.map((x) => (typeof x === 'string' ? x : x?.name || x?.productname || '')).filter(Boolean);
    }
    if (Array.isArray(data.products)) return parseOpeProductNamesList(data.products);
    if (Array.isArray(data.names)) return parseOpeProductNamesList(data.names);
    if (typeof data === 'object') {
        return Object.values(data).flatMap((v) => (Array.isArray(v) ? parseOpeProductNamesList(v) : []));
    }
    return [];
};

const parseStoresFromPayload = (payload) => {
    const raw = payload.stores ?? payload.store ?? [];
    const list = Array.isArray(raw) ? raw : [raw];
    return [...new Set(list.map((s) => String(s || '').trim()).filter(Boolean))];
};

const fetchOpeJson = async (url, apiKey, log) => {
    const headers = buildOpeHeaders(apiKey);
    const response = await fetchWithRetry(url, { timeout: 15000, headers }, 2, log);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
        throw { status: response.status, data, url };
    }
    return data;
};

const fetchOpeProductNamesForStores = async (apiKey, stores, log) => {
    const params = new URLSearchParams();
    stores.slice(0, 20).forEach((store) => params.append('stores', store));
    const url = `${OPE_API_BASE}/stores/products/names?${params.toString()}`;
    const data = await fetchOpeJson(url, apiKey, log);
    return parseOpeProductNamesList(data);
};

const countHistoryPoints = (data) => {
    let count = 0;
    const visit = (node) => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (typeof node === 'object') {
            const price = node.price ?? node.Price ?? node.product_price ?? node.amount;
            const date = node.date ?? node.Date ?? node.timestamp ?? node.recorded_at ?? node.price_date;
            if (price != null && price !== '' && date) {
                count += 1;
                return;
            }
            Object.values(node).forEach(visit);
        }
    };
    visit(data);
    return count;
};

const buildProductNameVariants = (productname) => {
    const base = String(productname || '').trim();
    if (!base) return [];
    const variants = new Set([base]);
    variants.add(base.replace(/-/g, ' ').replace(/\s+/g, ' ').trim());
    variants.add(base.replace(/\s+/g, '-').trim());
    return [...variants].filter(Boolean).slice(0, 4);
};

const splitMonthRanges = (startDate, endDate) => {
    const ranges = [];
    let cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
        return [{ start_date: startDate, end_date: endDate }];
    }
    while (cursor <= end) {
        const monthStart = cursor.toISOString().slice(0, 10);
        const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
        const monthEndDate = new Date(next.getTime() - 86400000);
        const monthEnd =
            monthEndDate > end ? endDate : monthEndDate.toISOString().slice(0, 10);
        ranges.push({ start_date: monthStart, end_date: monthEnd });
        cursor = next;
    }
    return ranges.length ? ranges : [{ start_date: startDate, end_date: endDate }];
};

const mergeHistoricalData = (chunks) => {
    if (!chunks.length) return null;
    if (chunks.length === 1) return chunks[0];
    if (Array.isArray(chunks[0])) return chunks.flat();
    return chunks;
};

const fetchOpeHistoricalOnce = async (apiKey, payload, log) => {
    const built = buildOpeHistoricalUrls(payload);
    if (built.error) {
        throw { status: 400, data: { detail: built.error } };
    }
    const fetchOpts = { timeout: 15000, headers: buildOpeHeaders(apiKey) };
    try {
        const result = await runProxiedFetch({
            cacheKey: built.url,
            url: built.url,
            cacheTtl: 0,
            fetchOpts,
            transform: null,
            log,
        });
        return { data: result.data, url: built.url, currencyOmitted: false };
    } catch (historicalErr) {
        if (built.includeCurrency && isOpeDateNotFoundError(historicalErr)) {
            log('OPE historical: retry without currency');
            const result = await runProxiedFetch({
                cacheKey: built.urlWithoutCurrency,
                url: built.urlWithoutCurrency,
                cacheTtl: 0,
                fetchOpts,
                transform: null,
                log,
            });
            return { data: result.data, url: built.urlWithoutCurrency, currencyOmitted: true };
        }
        throw historicalErr;
    }
};

const fetchOpeHistoricalWithRetries = async (apiKey, payload, log) => {
    const store = String(payload.store || '').trim();
    const startDate = String(payload.start_date || payload.startDate || '').trim();
    const endDate = String(payload.end_date || payload.endDate || '').trim();
    const variants = [
        ...new Set([
            ...buildProductNameVariants(payload.productname || payload.productName),
            ...(Array.isArray(payload.productnameVariants) ? payload.productnameVariants : []),
        ]),
    ].filter(Boolean);

    let lastErr = null;
    for (const productname of variants) {
        try {
            const attempt = await fetchOpeHistoricalOnce(
                apiKey,
                { ...payload, store, productname, start_date: startDate, end_date: endDate },
                log
            );
            const points = countHistoryPoints(attempt.data);
            if (points > 0) {
                return { ...attempt, productname, pointCount: points };
            }
            lastErr = { status: 404, data: { detail: 'Empty history' }, url: attempt.url };
        } catch (err) {
            lastErr = err;
            if (!isOpeDateNotFoundError(err) && err?.status !== 404) break;
        }
    }

    const monthRanges = splitMonthRanges(startDate, endDate);
    if (monthRanges.length > 1) {
        const primaryName = variants[0] || String(payload.productname || '').trim();
        const chunks = [];
        for (const range of monthRanges) {
            try {
                const attempt = await fetchOpeHistoricalOnce(
                    apiKey,
                    {
                        ...payload,
                        store,
                        productname: primaryName,
                        start_date: range.start_date,
                        end_date: range.end_date,
                    },
                    log
                );
                if (countHistoryPoints(attempt.data) > 0) chunks.push(attempt.data);
            } catch {
                // skip empty months
            }
        }
        const merged = mergeHistoricalData(chunks);
        if (merged && countHistoryPoints(merged) > 0) {
            return {
                data: merged,
                url: `${OPE_API_BASE}/${encodeURIComponent(store)}/products/prices/query`,
                productname: primaryName,
                pointCount: countHistoryPoints(merged),
                meta: { monthlyChunks: monthRanges.length },
            };
        }
    }

    if (lastErr) throw lastErr;
    throw { status: 404, data: { detail: 'No historical prices found' } };
};

const probeOpeHistorical = async (apiKey, payload, log) => {
    const productQuery = String(payload.productQuery || payload.query || payload.productname || '').trim();
    const startDate = String(payload.start_date || payload.startDate || '').trim();
    const endDate = String(payload.end_date || payload.endDate || '').trim();

    if (!productQuery || !startDate || !endDate) {
        return { error: 'Missing productQuery, start_date, or end_date.' };
    }

    let stores = parseStoresFromPayload(payload);
    if (!stores.length) {
        const storeList = await fetchOpeStoreList(apiKey, log);
        stores = storeList.stores.slice(0, MAX_PROBE_STORES);
    } else {
        stores = stores.slice(0, MAX_PROBE_STORES);
    }

    const candidates = [];

    for (const store of stores) {
        let names = [];
        try {
            names = await fetchOpeProductNamesForStores(apiKey, [store], log);
        } catch (err) {
            log(`OPE product names failed for ${store}: ${formatUpstreamError(err, '')}`);
            continue;
        }

        const ranked = names
            .map((name) => ({ name, score: scoreProductMatch(productQuery, name) }))
            .filter((row) => row.score >= 35)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        for (const { name, score } of ranked) {
            try {
                const result = await fetchOpeHistoricalWithRetries(
                    apiKey,
                    {
                        store,
                        productname: name,
                        start_date: startDate,
                        end_date: endDate,
                        currency: payload.currency,
                    },
                    log
                );
                const pointCount = result.pointCount ?? countHistoryPoints(result.data);
                if (pointCount <= 0) continue;

                candidates.push({
                    store,
                    productname: result.productname || name,
                    matchScore: score,
                    pointCount,
                    sampleUrl: result.url,
                    currencyOmitted: Boolean(result.meta?.currencyOmitted),
                });
            } catch {
                // try next name
            }
            if (candidates.length >= MAX_PROBE_CANDIDATES) break;
        }
        if (candidates.length >= MAX_PROBE_CANDIDATES) break;
    }

    candidates.sort((a, b) => b.pointCount - a.pointCount || b.matchScore - a.matchScore);
    return { candidates: candidates.slice(0, MAX_PROBE_CANDIDATES), storesScanned: stores.length };
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
                        productNames: '/stores/products/names',
                        historical: '/{store}/products/prices/query',
                        probe: 'ope_probe_historical',
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
        } else if (kind === 'ope_product_names') {
            const apiKey = getOpeApiKey();
            if (!apiKey) {
                return sendJson(res, {
                    ok: false,
                    status: 500,
                    error: 'OPENPRICEENGINE_API_KEY is not configured on off-proxy.',
                });
            }
            const stores = parseStoresFromPayload(payload);
            if (!stores.length) {
                return sendJson(res, { ok: false, status: 400, error: 'Missing stores (array or store).' });
            }
            const names = await fetchOpeProductNamesForStores(apiKey, stores, log);
            return sendJson(res, {
                ok: true,
                status: 200,
                data: {
                    stores,
                    names: [...new Set(names)].sort().slice(0, MAX_PRODUCT_NAMES_PER_STORE),
                },
            });
        } else if (kind === 'ope_probe_historical') {
            const apiKey = getOpeApiKey();
            if (!apiKey) {
                return sendJson(res, {
                    ok: false,
                    status: 500,
                    error: 'OPENPRICEENGINE_API_KEY is not configured on off-proxy.',
                });
            }
            const probe = await probeOpeHistorical(apiKey, payload, log);
            if (probe.error) {
                return sendJson(res, { ok: false, status: 400, error: probe.error });
            }
            return sendJson(res, { ok: true, status: 200, data: probe });
        } else if (kind === 'ope_historical') {
            const apiKey = getOpeApiKey();
            if (!apiKey) {
                return sendJson(res, {
                    ok: false,
                    status: 500,
                    error: 'OPENPRICEENGINE_API_KEY is not configured on off-proxy.',
                });
            }
            const result = await fetchOpeHistoricalWithRetries(apiKey, payload, log);
            return sendJson(res, {
                ok: true,
                status: 200,
                data: result.data,
                meta: {
                    productname: result.productname,
                    pointCount: result.pointCount,
                    currencyOmitted: result.currencyOmitted,
                    ...(result.meta || {}),
                },
                upstreamUrl: result.url,
            });
        } else {
            return sendJson(res, {
                ok: false,
                status: 400,
                error:
                    'Unsupported kind. Use barcode, search, ope_stores, ope_product_names, ope_probe_historical, or ope_historical.',
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
        const opeKinds = [
            'ope_stores',
            'ope_historical',
            'ope_product_names',
            'ope_probe_historical',
        ];
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
