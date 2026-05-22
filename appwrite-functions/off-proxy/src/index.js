const OFF_API_BASE = 'https://world.openfoodfacts.org';

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
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeout = opts.timeout || 10000;
            if (controller) {
                setTimeout(() => controller.abort(), timeout);
                opts.signal = controller.signal;
            }

            const res = await fetch(url, opts);
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
            if (log) log(`OFF proxy fetch attempt ${attempt} failed: ${String(err)}; retrying after ${Math.round(base + jitter)}ms`);
            await sleep(base + jitter);
            attempt++;
            continue;
        }
    }
    throw lastErr || new Error('Fetch failed after retries');
}

module.exports = async ({ req, res, log, error }) => {
    try {
        const payload = parsePayload(req);
        const kind = String(payload.kind || payload.type || '').toLowerCase();

        if (!kind) {
            return res.json({ ok: false, status: 400, error: 'Missing kind.' }, 400);
        }

        let url = '';
        let cacheTtl = 0;
        if (kind === 'barcode') {
            const barcode = String(payload.barcode || '').trim();
            if (!barcode) {
                return res.json({ ok: false, status: 400, error: 'Missing barcode.' }, 400);
            }
            url = `${OFF_API_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json`;
            cacheTtl = 1000 * 60 * 60 * 24; // 24h for product lookups
        } else if (kind === 'search') {
            const query = String(payload.query || payload.q || '').trim();
            if (!query) {
                return res.json({ ok: false, status: 400, error: 'Missing search query.' }, 400);
            }
            const pageSize = Math.min(Math.max(Number(payload.pageSize || 5), 1), 20);
            url = `${OFF_API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageSize}`;
            cacheTtl = 1000 * 60 * 10; // 10 minutes for searches
        } else {
            return res.json({ ok: false, status: 400, error: 'Unsupported kind.' }, 400);
        }

        const cacheKey = url;

        // Return cached value if present
        const cached = cache.get(cacheKey);
        if (cached) {
            log(`OFF proxy cache hit: ${cacheKey}`);
            return res.json({ ok: true, status: 200, data: cached }, 200);
        }

        // Inflight dedupe
        if (inflight.has(cacheKey)) {
            log(`OFF proxy dedupe wait: ${cacheKey}`);
            try {
                const result = await inflight.get(cacheKey);
                return res.json({ ok: true, status: result.status || 200, data: result.data }, result.status || 200);
            } catch (err) {
                // previous inflight failed, continue to fetch
                inflight.delete(cacheKey);
            }
        }

        const fetchPromise = (async () => {
            try {
                const response = await fetchWithRetry(url, { timeout: 10000 }, 4, log);
                const contentType = response.headers.get('content-type') || '';
                const data = contentType.includes('application/json')
                    ? await response.json()
                    : await response.text();

                if (!response.ok) {
                    throw { status: response.status, data };
                }

                // store in cache
                try {
                    cache.set(cacheKey, data, cacheTtl);
                } catch (e) {
                    // ignore cache set errors
                }

                return { status: response.status, data };
            } catch (err) {
                throw err;
            } finally {
                inflight.delete(cacheKey);
            }
        })();

        inflight.set(cacheKey, fetchPromise);

        const result = await fetchPromise;
        return res.json({ ok: true, status: result.status || 200, data: result.data }, result.status || 200);
    } catch (err) {
        error(err);
        if (err && err.status) {
            return res.json({ ok: false, status: err.status, error: 'OFF request failed.', data: err.data }, err.status);
        }
        return res.json({ ok: false, status: 500, error: 'Proxy error.' }, 500);
    }
};
