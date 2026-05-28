const ROUTER_BASE = 'https://router.project-osrm.org';

// inflight dedupe for the Appwrite function
const inflight = new Map();

// No persistent caching — we prefer external direction providers (Google Maps) and fresh fetches.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const fetchWithRetry = async (url, opts = {}, retries = 2, log) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, opts);
            if (res.ok) return res;
            if (attempt === retries) return res;
            await sleep(200 * Math.pow(2, attempt) + Math.random() * 100);
        } catch (err) {
            if (attempt === retries) throw err;
            await sleep(200 * Math.pow(2, attempt) + Math.random() * 100);
        }
    }
};

module.exports = async ({ req, res, log, error }) => {
    try {
        const payload = parsePayload(req);
        const from = payload.from || payload.fromCoord || payload.fromCoords || null;
        const to = payload.to || payload.toCoord || payload.toCoords || null;

        // Accept either {from: {lat,lon}, to: {lat,lon}} or four params
        let fromLat, fromLon, toLat, toLon;
        if (from && from.latitude != null && from.longitude != null) {
            fromLat = Number(from.latitude);
            fromLon = Number(from.longitude);
        } else if (payload.fromLat && payload.fromLon) {
            fromLat = Number(payload.fromLat);
            fromLon = Number(payload.fromLon);
        }
        if (to && to.latitude != null && to.longitude != null) {
            toLat = Number(to.latitude);
            toLon = Number(to.longitude);
        } else if (payload.toLat && payload.toLon) {
            toLat = Number(payload.toLat);
            toLon = Number(payload.toLon);
        }

        if (![fromLat, fromLon, toLat, toLon].every((v) => typeof v === 'number' && Number.isFinite(v))) {
            return res.json({ ok: false, status: 400, error: 'Invalid coordinates' }, 400);
        }

        const key = `${fromLon},${fromLat}:${toLon},${toLat}`;

        if (inflight.has(key)) {
            log(`osrm-proxy: dedupe wait ${key}`);
            try {
                const r = await inflight.get(key);
                return res.json({ ok: true, status: 200, data: r }, 200);
            } catch (e) {
                inflight.delete(key);
            }
        }

        const url = `${ROUTER_BASE}/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;

        const p = (async () => {
            try {
                const resp = await fetchWithRetry(url, { cache: 'no-cache' }, 2, log);
                if (!resp) throw new Error('No response from OSRM');
                const json = await resp.json();
                if (!json || !json.routes || !json.routes[0]) throw new Error('No route');
                // No caching: return fresh route (we prefer external map providers like Google Maps)
                return json;
            } catch (err) {
                throw err;
            } finally {
                inflight.delete(key);
            }
        })();

        inflight.set(key, p);
        const result = await p;
        return res.json({ ok: true, status: 200, data: result }, 200);
    } catch (err) {
        error(err);
        return res.json({ ok: false, status: 500, error: String(err) }, 500);
    }
};
