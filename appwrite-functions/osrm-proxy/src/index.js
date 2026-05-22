const ROUTER_BASE = 'https://router.project-osrm.org';

// Simple in-memory cache + inflight dedupe for the Appwrite function
class SimpleCache {
    constructor(limit = 1000) {
        this.limit = limit;
        this.map = new Map();
    }
    get(k) {
        const e = this.map.get(k);
        if (!e) return undefined;
        if (e.expires && Date.now() > e.expires) {
            this.map.delete(k);
            return undefined;
        }
        // refresh
        this.map.delete(k);
        this.map.set(k, e);
        return e.value;
    }
    set(k, v, ttlMs = 0) {
        const expires = ttlMs > 0 ? Date.now() + ttlMs : null;
        this.map.delete(k);
        this.map.set(k, { value: v, expires });
        if (this.map.size > this.limit) {
            const first = this.map.keys().next().value;
            this.map.delete(first);
        }
    }
}

const cache = new SimpleCache(2000);
const inflight = new Map();

// Optional Appwrite persistent cache
let appwriteClient = null;
let appwriteDB = null;
let AppwriteQuery = null;
const ROUTE_PERSIST_TTL = Number(process.env.ROUTE_CACHE_TTL_MS || 1000 * 60 * 60); // default 1 hour

const initAppwrite = () => {
    if (appwriteClient) return;
    const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_ENDPOINT;
    const project = process.env.APPWRITE_PROJECT || process.env.APPWRITE_FUNCTION_PROJECT;
    const apiKey = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
    const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.APPWRITE_FUNCTION_DATABASE_ID;
    const collectionId = process.env.APPWRITE_ROUTE_COLLECTION_ID || process.env.APPWRITE_FUNCTION_ROUTE_COLLECTION_ID;
    if (!endpoint || !project || !apiKey || !databaseId || !collectionId) return;
    try {
        const { Client, Databases, Query } = require('node-appwrite');
        const client = new Client();
        client.setEndpoint(endpoint).setProject(project).setKey(apiKey);
        const databases = new Databases(client);
        appwriteClient = { client, databaseId, collectionId };
        appwriteDB = databases;
        AppwriteQuery = Query;
    } catch (e) {
        // ignore if node-appwrite not available in environment
    }
};

const fetchPersistent = async (key, log) => {
    try {
        initAppwrite();
        if (!appwriteDB || !AppwriteQuery) return null;
        const { databaseId, collectionId } = appwriteClient;
        const res = await appwriteDB.listDocuments(databaseId, collectionId, [AppwriteQuery.equal('key', key), AppwriteQuery.limit(1)]);
        const doc = res.documents && res.documents[0];
        if (!doc) return null;
        // Check freshness by $updatedAt
        const updated = Date.parse(doc.$updatedAt || doc.$createdAt || Date.now());
        if (!Number.isFinite(updated)) return null;
        if (Date.now() - updated > ROUTE_PERSIST_TTL) {
            log && log(`osrm-proxy: persistent cache stale for ${key}`);
            return null;
        }
        log && log(`osrm-proxy: persistent cache hit ${key}`);
        return doc.payload || null;
    } catch (e) {
        // ignore persistent cache errors
        return null;
    }
};

const savePersistent = async (key, payload, log) => {
    try {
        initAppwrite();
        if (!appwriteDB || !AppwriteQuery) return;
        const { databaseId, collectionId } = appwriteClient;
        // Try find existing document
        const res = await appwriteDB.listDocuments(databaseId, collectionId, [AppwriteQuery.equal('key', key), AppwriteQuery.limit(1)]);
        const doc = res.documents && res.documents[0];
        if (doc && doc.$id) {
            try {
                await appwriteDB.updateDocument(databaseId, collectionId, doc.$id, { key, payload });
                log && log(`osrm-proxy: persistent cache updated ${key}`);
                return;
            } catch (e) {
                // fallback to create
            }
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        await appwriteDB.createDocument(databaseId, collectionId, id, { key, payload }, ['role:all'], ['role:all']);
        log && log(`osrm-proxy: persistent cache saved ${key}`);
    } catch (e) {
        // ignore errors
    }
};

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
        const cached = cache.get(key);
        if (cached) {
            log(`osrm-proxy: cache hit ${key}`);
            return res.json({ ok: true, status: 200, data: cached }, 200);
        }

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
                cache.set(key, json, 1000 * 60 * 60); // 1 hour
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
