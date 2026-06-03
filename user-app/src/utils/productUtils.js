import { db, Query, COLLECTIONS, functions } from '../lib/appwrite';
import { createFunctionExecutionJson } from './appwriteFunctionExecution';
import {
    buildCatalogSearchTerms,
    findBestProductMatch,
    FUZZY_MATCH_MIN_SCORE,
} from './productNameMatch';

const cacheStore = new Map();
const inflightRequests = new Map();
const CACHE_TTL = {
    products: 60 * 1000,
    prices: 30 * 1000,
    categories: 5 * 60 * 1000,
    allPrices: 30 * 1000,
    search: 30 * 1000,
    similar: 60 * 1000
};
const OFF_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const OFF_MEMORY_TTL_MS = 5 * 60 * 1000;
const OFF_SEARCH_TTL_MS = 2 * 60 * 1000;
const PRODUCT_LIST_SELECT = [
    '$id',
    '$createdAt',
    '$updatedAt',
    'name',
    'product_name',
    'barcode',
    'code',
    'brand',
    'brands',
    'ingredientsText',
    'allergens',
    'nutritionSource',
    'sugarsPer100g',
    'sodiumMgPer100g',
    'caffeineMgPerL',
    'nutritionUpdatedAt',
    'imageUrl',
    'image',
    'image_url',
    'image_front_url',
    'description',
    'unit',
    'quantity',
    'weight',
    'nutriscore_grade',
    'allergens_tags',
    'categories',
    'categoryId.*',
];
const PRODUCT_PRICE_SELECT = [
    '$id',
    '$createdAt',
    '$updatedAt',
    'price',
    'currency',
    'products.$id',
    'supermarkets.$id',
];
/** Optional expanded supermarket fields (only attrs present in Appwrite schema). */
export const COMPARISON_PRICE_SELECT = [
    ...PRODUCT_PRICE_SELECT,
    'supermarkets.name',
    'supermarkets.branchName',
    'supermarkets.address',
    'supermarkets.latitude',
    'supermarkets.longitude',
    'supermarkets.icon',
    'supermarkets.rating',
    'supermarkets.reviewsCount',
    'supermarkets.parentId',
    'supermarkets.isParent',
];
export { PRODUCT_PRICE_SELECT };
const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OFF_DEBUG = import.meta.env.VITE_OFF_DEBUG === 'true';
const OFF_PROXY_FUNCTION_ID = import.meta.env.VITE_APPWRITE_FUNCTION_OFF_PROXY || '';
const OFF_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const NUTRITION_META_MARKER = '\n\n[PriceMate Nutrition]\n';
const pricesIndexCache = new WeakMap();
const priceFieldSupport = {
    products: null,
};

export const stripNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    return markerIndex >= 0 ? text.slice(0, markerIndex).trimEnd() : text.trimEnd();
};

const extractNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    if (markerIndex < 0) return null;
    const jsonText = text.slice(markerIndex + NUTRITION_META_MARKER.length).trim();
    if (!jsonText) return null;
    try {
        return JSON.parse(jsonText);
    } catch {
        return null;
    }
};

const logOffDebug = (...args) => {
    if (OFF_DEBUG) console.info('[OFF]', ...args);
};

const callOffProxy = async (payload) => {
    if (!OFF_PROXY_FUNCTION_ID) return null;
    try {
        return await createFunctionExecutionJson(functions, OFF_PROXY_FUNCTION_ID, payload);
    } catch (error) {
        logOffDebug('proxy-error', { message: error?.message || String(error) });
        return { ok: false, status: 0, error: 'Proxy error' };
    }
};

const getCachedValue = (key) => {
    const entry = cacheStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        cacheStore.delete(key);
        return null;
    }
    return entry.data;
};

const setCachedValue = (key, data, ttlMs) => {
    cacheStore.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
    });
};

const withInflight = async (key, fetcher) => {
    if (inflightRequests.has(key)) {
        return inflightRequests.get(key);
    }
    const promise = fetcher().finally(() => inflightRequests.delete(key));
    inflightRequests.set(key, promise);
    return promise;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value) => {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateMs = Date.parse(value);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
    return null;
};

const fetchWithBackoff = async (url, options = {}, config = {}) => {
    const {
        retries = 2,
        baseDelayMs = 400,
        maxDelayMs = 2000,
    } = config;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(url, options);
            if (response.ok || !OFF_RETRY_STATUSES.has(response.status) || attempt === retries) {
                return response;
            }

            const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
            const backoffMs = retryAfterMs ?? Math.min(
                baseDelayMs * (2 ** attempt) * (0.75 + Math.random() * 0.5),
                maxDelayMs
            );
            logOffDebug('api-backoff', { status: response.status, delayMs: Math.round(backoffMs), attempt: attempt + 1 });
            await sleep(backoffMs);
        } catch {
            if (attempt === retries) return null;
            const backoffMs = Math.min(
                baseDelayMs * (2 ** attempt) * (0.75 + Math.random() * 0.5),
                maxDelayMs
            );
            logOffDebug('api-backoff', { status: 'network', delayMs: Math.round(backoffMs), attempt: attempt + 1 });
            await sleep(backoffMs);
        }
    }

    return null;
};

export const buildDirectionsUrl = (latitude, longitude, googleMapsUrl = null, embedHtml = null) => {
    const destinationCoords = extractGoogleMapsCoordinates(googleMapsUrl);
    if (destinationCoords) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destinationCoords.latitude},${destinationCoords.longitude}`)}`;
    }
    const embedCoords = extractGoogleMapsCoordinates(embedHtml);
    if (embedCoords) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${embedCoords.latitude},${embedCoords.longitude}`)}`;
    }
    if (googleMapsUrl && googleMapsUrl.trim()) return googleMapsUrl.trim();
    if (hasValidLatLon(latitude, longitude)) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`;
    }
    return '';
};

const toFiniteCoordinate = (value) => {
    const numeric = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(numeric) ? numeric : null;
};

const coordinatePairFromMatch = (match, order = 'latlon') => {
    if (!match || match.length < 3) return null;
    const first = toFiniteCoordinate(match[1]);
    const second = toFiniteCoordinate(match[2]);
    const latitude = order === 'lonlat' ? second : first;
    const longitude = order === 'lonlat' ? first : second;
    if (latitude === null || longitude === null) return null;
    return hasValidLatLon(latitude, longitude) ? { latitude, longitude } : null;
};

export const extractGoogleMapsCoordinates = (value) => {
    const text = String(value || '').trim();
    if (!text) return null;

    const patterns = [
        { regex: /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i, order: 'latlon' },
        { regex: /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i, order: 'lonlat' },
        { regex: /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,[^/?#]*)?/i, order: 'latlon' },
        { regex: /[?&](?:q|query|ll|saddr|daddr|destination|origin|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, order: 'latlon' },
    ];

    for (const { regex, order } of patterns) {
        const match = text.match(regex);
        const coordinates = coordinatePairFromMatch(match, order);
        if (coordinates) return coordinates;
    }

    try {
        const decoded = decodeURIComponent(text);
        if (decoded !== text) {
            return extractGoogleMapsCoordinates(decoded);
        }
    } catch {
        // ignore malformed escape sequences
    }

    return null;
};

export const resolveCoordinates = (entity) => {
    if (!entity) return null;

    if (hasValidLatLon(entity.latitude, entity.longitude)) {
        return {
            latitude: Number(entity.latitude),
            longitude: Number(entity.longitude)
        };
    }

    return (
        extractGoogleMapsCoordinates(entity.googleMapsUrl) ||
        extractGoogleMapsCoordinates(entity.embedHtml) ||
        extractGoogleMapsCoordinates(entity)
    );
};

const getOffCacheTimestamp = (doc) => doc?.sourceUpdatedAt || doc?.$updatedAt || doc?.$createdAt || '';

const isOffCacheFresh = (doc) => {
    if (!doc) return false;
    const stamp = getOffCacheTimestamp(doc);
    if (!stamp) return true;
    const ms = Date.parse(stamp);
    if (!Number.isFinite(ms)) return true;
    return Date.now() - ms <= OFF_CACHE_TTL_MS;
};

/**
 * Fetch product details from OpenFoodFacts API (Global Fallback)
 * @param {string} barcode
 * @returns {Promise<Object|null>}
 */
export const fetchGlobalProduct = async (barcode) => {
    if (!barcode) return null;
    const cacheKey = `off:barcode:${barcode}`;
    const cached = getCachedValue(cacheKey);
    if (cached) {
        logOffDebug('memory-hit', { kind: 'barcode', barcode });
        return cached;
    }

    return withInflight(cacheKey, async () => {
        try {
            logOffDebug('api-fetch', { kind: 'barcode', barcode });
            if (OFF_PROXY_FUNCTION_ID) {
                const proxyResult = await callOffProxy({ kind: 'barcode', barcode });
                if (!proxyResult?.ok) return null;
                const data = proxyResult.data;
                if (data?.status === 1) {
                    const product = {
                        ...data.product,
                        is_global: true,
                    };
                    setCachedValue(cacheKey, product, OFF_MEMORY_TTL_MS);
                    return product;
                }
                return null;
            }

            const response = await fetchWithBackoff(
                `${OFF_API_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json`
            );
            if (!response?.ok) return null;
            const data = await response.json();

            if (data.status === 1) {
                const product = {
                    ...data.product,
                    is_global: true,
                };
                setCachedValue(cacheKey, product, OFF_MEMORY_TTL_MS);
                return product;
            }
            return null;
        } catch (error) {
            console.error('Error fetching global product:', error);
            return null;
        }
    });
};

/** Try common barcode variants for OFF (leading zeros, EAN-12→13). */
const collectBarcodeVariants = (raw) => {
    const s = String(raw || '').trim();
    if (!s || !/^\d+$/.test(s)) return s ? [s] : [];
    const out = [];
    const push = (v) => {
        if (v && !out.includes(v)) out.push(v);
    };
    push(s);
    if (s.length === 12) push(s.padStart(13, '0'));
    if (s.length === 8) push(s.padStart(14, '0'));
    if (s.length === 13 && s.startsWith('0')) {
        const stripped = s.replace(/^0+/, '') || s;
        if (stripped !== s) push(stripped);
    }
    return out;
};

export const fetchGlobalProductWithRetries = async (barcode) => {
    if (!barcode) return null;
    return withInflight(`off:barcode:variants:${barcode}`, async () => {
        for (const variant of collectBarcodeVariants(barcode)) {
            const product = await fetchGlobalProduct(variant);
            if (product) return product;
        }
        return null;
    });
};

const normalizeIngredientsPayload = (product, fallbackBarcode) => {
    if (!product) return null;

    const parseNumber = (value) => {
        if (value === null || value === undefined) return null;
        const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
        return Number.isFinite(num) ? num : null;
    };

    const barcode = product.code || product.barcode || fallbackBarcode || '';
    const name = product.product_name || product.name || product.productName || 'Unknown Product';
    const brand = product.brands || product.brand || '';
    const ingredientsText = product.ingredients_text || product.ingredients_text_en || product.ingredients_text_tr || '';
    const allergensTags = Array.isArray(product.allergens_tags) ? product.allergens_tags : [];
    const allergens = allergensTags
        .map((tag) => tag.replace(/^[a-z]{2}:/, '').replace(/_/g, ' ').trim())
        .filter(Boolean);
    const ingredientsList = ingredientsText
        ? ingredientsText.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)
        : [];
    const sourceUrl = barcode ? `https://world.openfoodfacts.org/product/${barcode}` : 'https://world.openfoodfacts.org';

    const nutriments = product.nutriments || {};
    const sugarsPer100g = parseNumber(nutriments.sugars_100g ?? nutriments.sugars_value ?? nutriments.sugars);

    const sodiumValue = parseNumber(nutriments.sodium_100g ?? nutriments.sodium_value ?? nutriments.sodium);
    const sodiumUnit = String(nutriments.sodium_unit || '').toLowerCase();
    let sodiumMgPer100g = null;
    if (sodiumValue !== null) {
        sodiumMgPer100g = sodiumUnit === 'mg' ? sodiumValue : sodiumValue * 1000;
    }

    const saltValue = parseNumber(nutriments.salt_100g ?? nutriments.salt_value ?? nutriments.salt);
    const saltUnit = String(nutriments.salt_unit || '').toLowerCase();
    let saltGPer100g = null;
    if (saltValue !== null) {
        saltGPer100g = saltUnit === 'mg' ? saltValue / 1000 : saltValue;
    }

    if (sodiumMgPer100g === null && saltGPer100g !== null) {
        sodiumMgPer100g = (saltGPer100g / 2.5) * 1000;
    }

    const caffeineValue = parseNumber(nutriments.caffeine_100g ?? nutriments.caffeine_value ?? nutriments.caffeine);
    const caffeineUnit = String(nutriments.caffeine_unit || '').toLowerCase();
    let caffeineMgPer100g = null;
    if (caffeineValue !== null) {
        if (caffeineUnit === 'g') {
            caffeineMgPer100g = caffeineValue * 1000;
        } else {
            caffeineMgPer100g = caffeineValue;
        }
    }

    const caffeineMgPerL = caffeineMgPer100g !== null ? caffeineMgPer100g * 10 : null;

    return {
        barcode,
        name,
        brand,
        ingredientsText,
        ingredientsList,
        allergens,
        nutriments: {
            sugarsPer100g,
            sodiumMgPer100g,
            caffeineMgPerL,
            caffeineMgPer100g,
            saltGPer100g
        },
        source: 'OpenFoodFacts',
        sourceUrl
    };
};

const normalizeOffCacheRecord = (product, fallbackBarcode) => {
    if (!product) return null;
    const barcode = product.code || product.barcode || fallbackBarcode || '';
    const name = product.product_name || product.name || product.productName || 'Unknown Product';
    const brand = product.brands || product.brand || '';
    const imageUrl = product.image_url || product.image_front_url || product.imageUrl || product.image || '';
    const categories = product.categories || (Array.isArray(product.categories_tags) ? product.categories_tags.join(',') : '');
    const ingredientsText = product.ingredients_text || product.ingredients_text_en || product.ingredients_text_tr || '';
    const allergensTags = Array.isArray(product.allergens_tags) ? product.allergens_tags : [];
    const allergens = allergensTags
        .map((tag) => tag.replace(/^[a-z]{2}:/, '').replace(/_/g, ' ').trim())
        .filter(Boolean);
    const nutriments = product.nutriments ? JSON.stringify(product.nutriments) : '';
    const sourceUrl = barcode ? `https://world.openfoodfacts.org/product/${barcode}` : 'https://world.openfoodfacts.org';
    const sourceLang = product.lang || product.lc || '';
    const updatedAt = product.last_modified_t
        ? new Date(product.last_modified_t * 1000).toISOString()
        : new Date().toISOString();

    return {
        barcode,
        name,
        brand,
        imageUrl,
        categories,
        ingredientsText,
        allergens,
        nutriments,
        sourceUrl,
        sourceLang,
        source: 'OpenFoodFacts',
        sourceUpdatedAt: updatedAt,
    };
};

export const normalizeOffCacheDoc = (doc) => {
    if (!doc) return null;
    return {
        ...doc,
        barcode: doc.barcode || doc.$id || '',
        name: doc.name || doc.productName || 'Unknown Product',
        brand: doc.brand || '',
        imageUrl: doc.imageUrl || doc.image || '',
        categories: doc.categories || doc.category || '',
        is_global: true,
        is_off_cache: true,
        prices: [],
    };
};

export const ingredientPayloadFromOffCache = (doc) => {
    if (!doc) return null;
    const ingredientsText = doc.ingredientsText || '';
    const allergens = Array.isArray(doc.allergens)
        ? doc.allergens
        : (doc.allergens ? [doc.allergens] : []);
    let nutriments = {};
    if (doc.nutriments) {
        try {
            nutriments = typeof doc.nutriments === 'string' ? JSON.parse(doc.nutriments) : doc.nutriments;
        } catch {
            nutriments = {};
        }
    }

    const payload = normalizeIngredientsPayload(
        {
            code: doc.barcode,
            product_name: doc.name,
            brands: doc.brand,
            ingredients_text: ingredientsText,
            allergens_tags: allergens,
            nutriments,
        },
        doc.barcode
    );

    return {
        ...payload,
        source: 'OpenFoodFacts',
        sourceUrl: doc.sourceUrl || payload.sourceUrl,
    };
};

const OFF_CACHE_UNAVAILABLE_KEY = 'pricemate:offCacheUnavailable';
let offCacheCollectionAvailable = null;

const readOffCacheUnavailableFlag = () => {
    try {
        return sessionStorage.getItem(OFF_CACHE_UNAVAILABLE_KEY) === '1';
    } catch {
        return false;
    }
};

const markOffCacheUnavailable = () => {
    offCacheCollectionAvailable = false;
    try {
        sessionStorage.setItem(OFF_CACHE_UNAVAILABLE_KEY, '1');
    } catch {
        // ignore storage failures
    }
};

const isOffCacheUnavailableError = (error) => {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return (
        code === 404 ||
        message.includes('not found') ||
        message.includes('collection with the requested id could not be found')
    );
};

const isOffCacheEnabled = () => {
    const envFlag = import.meta.env.VITE_APPWRITE_OFF_CACHE_ENABLED;
    if (envFlag === 'false' || envFlag === '0') return false;
    if (offCacheCollectionAvailable === false) return false;
    if (offCacheCollectionAvailable === null && readOffCacheUnavailableFlag()) {
        offCacheCollectionAvailable = false;
        return false;
    }
    return true;
};

const handleOffCacheError = (error, context) => {
    if (isOffCacheUnavailableError(error)) {
        markOffCacheUnavailable();
        logOffDebug('collection-unavailable', { context });
        return;
    }
    console.warn(`OFF cache ${context} failed:`, error?.message || error);
};

export const fetchOffCacheByBarcode = async (barcode) => {
    if (!barcode || !isOffCacheEnabled()) return null;
    try {
        const res = await db.offCache.list([
            Query.equal('barcode', String(barcode)),
            Query.limit(1)
        ]);
        const doc = res.documents[0] || null;
        if (doc && isOffCacheFresh(doc)) {
            logOffDebug('appwrite-hit', { kind: 'barcode', barcode });
            return doc;
        }
        if (doc) {
            logOffDebug('appwrite-stale', { kind: 'barcode', barcode });
        }
        return null;
    } catch (error) {
        handleOffCacheError(error, 'lookup');
        return null;
    }
};

export const searchOffCacheByName = async (name, limit = 5) => {
    const term = String(name || '').trim();
    if (!term || !isOffCacheEnabled()) return [];
    try {
        const res = await db.offCache.list([
            Query.search('name', term),
            Query.limit(limit)
        ]);
        const docs = res.documents || [];
        const fresh = docs.filter((doc) => isOffCacheFresh(doc));
        if (fresh.length > 0) {
            logOffDebug('appwrite-hit', { kind: 'name', query: term, hits: fresh.length });
        }
        return fresh;
    } catch (error) {
        handleOffCacheError(error, 'name search');
        return [];
    }
};

export const fetchOffCacheSnapshot = async (limit = 30) => {
    if (!isOffCacheEnabled()) return [];
    try {
        const res = await db.offCache.list([
            Query.limit(limit),
            Query.orderDesc('$updatedAt')
        ]);
        const docs = res.documents || [];
        return docs.filter((doc) => isOffCacheFresh(doc));
    } catch (error) {
        handleOffCacheError(error, 'snapshot');
        return [];
    }
};

const saveOffCacheRecord = async (record) => {
    if (!record || !record.barcode || !isOffCacheEnabled()) return null;
    try {
        const existing = await db.offCache.list([
            Query.equal('barcode', record.barcode),
            Query.limit(1)
        ]);
        const current = existing.documents?.[0];
        if (current?.$id) {
            await db.offCache.update(current.$id, record);
            return current.$id;
        }
        const created = await db.offCache.create(record);
        return created?.$id || null;
    } catch (error) {
        handleOffCacheError(error, 'save');
        return null;
    }
};

export const saveOffCacheFromProduct = async (product, fallbackBarcode) => {
    const record = normalizeOffCacheRecord(product, fallbackBarcode);
    return saveOffCacheRecord(record);
};

export const saveOffCacheFromIngredientPayload = async (payload) => {
    if (!payload) return null;
    const record = normalizeOffCacheRecord(
        {
            code: payload.barcode,
            product_name: payload.name,
            brands: payload.brand,
            ingredients_text: payload.ingredientsText,
            allergens_tags: payload.allergens || [],
            nutriments: payload.nutriments || {},
        },
        payload.barcode
    );
    return saveOffCacheRecord(record);
};

export const resolveOffCacheProductForIngredients = async (userMessage) => {
    const empty = { product: null, barcode: '', name: '' };
    const trimmed = String(userMessage || '').trim();
    if (!trimmed) return empty;

    const barcodeMatch = trimmed.match(/\b(\d{8,14})\b/);
    if (barcodeMatch) {
        const doc = await fetchOffCacheByBarcode(barcodeMatch[1]);
        if (doc) {
            return {
                product: doc,
                barcode: doc.barcode || barcodeMatch[1],
                name: doc.name || '',
            };
        }
    }

    const candidates = await searchOffCacheByName(trimmed, 5);
    const best = candidates.find((d) => (d.name || '').toLowerCase().includes(trimmed.toLowerCase())) || candidates[0];
    if (best) {
        return {
            product: best,
            barcode: best.barcode || '',
            name: best.name || '',
        };
    }

    return empty;
};

export const fetchIngredientsByBarcode = async (barcode) => {
    if (!barcode) return null;
    const cacheKey = `off:ingredients:${barcode}`;
    const cachedPayload = getCachedValue(cacheKey);
    if (cachedPayload) {
        logOffDebug('memory-hit', { kind: 'ingredients', barcode });
        return cachedPayload;
    }

    return withInflight(cacheKey, async () => {
        const cached = await fetchOffCacheByBarcode(barcode);
        if (cached) {
            const payload = ingredientPayloadFromOffCache(cached);
            logOffDebug('appwrite-hit', { kind: 'ingredients', barcode });
            setCachedValue(cacheKey, payload, OFF_MEMORY_TTL_MS);
            return payload;
        }
        const product = await fetchGlobalProductWithRetries(barcode);
        if (!product) return null;
        const payload = normalizeIngredientsPayload(product, barcode);
        await saveOffCacheFromProduct(product, barcode);
        logOffDebug('api-fetch', { kind: 'ingredients', barcode });
        setCachedValue(cacheKey, payload, OFF_MEMORY_TTL_MS);
        return payload;
    });
};

const parseNutritionNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : null;
};

const hasIngredientPayloadContent = (payload) => {
    if (!payload) return false;
    const ingredientsText = String(payload.ingredientsText || '').trim();
    const nutriments = payload.nutriments || {};
    const sugar = parseNutritionNumber(nutriments.sugarsPer100g);
    const sodium = parseNutritionNumber(nutriments.sodiumMgPer100g);
    const caffeine = parseNutritionNumber(nutriments.caffeineMgPerL);
    return ingredientsText.length > 0 || sugar !== null || sodium !== null || caffeine !== null;
};

/**
 * Persist ingredient/nutrition info into catalog product document.
 * We store nutrition in the hidden JSON block under `description` to avoid schema mismatch.
 * Best-effort only: failures should never break chat responses.
 */
export const persistIngredientPayloadToCatalogProduct = async (productDoc, payload) => {
    if (!productDoc?.$id || !hasIngredientPayloadContent(payload)) return false;

    try {
        const hiddenNutrition = extractNutritionMeta(productDoc.description);
        const currentNutrition = {
            sugarsPer100g: parseNutritionNumber(
                productDoc?.nutrition?.sugarsPer100g ?? hiddenNutrition?.sugarsPer100g ?? productDoc.sugarsPer100g
            ),
            sodiumMgPer100g: parseNutritionNumber(
                productDoc?.nutrition?.sodiumMgPer100g ?? hiddenNutrition?.sodiumMgPer100g ?? productDoc.sodiumMgPer100g
            ),
            caffeineMgPerL: parseNutritionNumber(
                productDoc?.nutrition?.caffeineMgPerL ?? hiddenNutrition?.caffeineMgPerL ?? productDoc.caffeineMgPerL
            ),
            ingredientsText: String(
                productDoc?.nutrition?.ingredientsText ??
                hiddenNutrition?.ingredientsText ??
                productDoc.ingredientsText ??
                ''
            ).trim(),
            nutritionSource: String(
                productDoc?.nutrition?.nutritionSource ??
                hiddenNutrition?.nutritionSource ??
                productDoc.nutritionSource ??
                ''
            ).trim(),
        };

        const incomingNutrition = {
            sugarsPer100g: parseNutritionNumber(payload?.nutriments?.sugarsPer100g),
            sodiumMgPer100g: parseNutritionNumber(payload?.nutriments?.sodiumMgPer100g),
            caffeineMgPerL: parseNutritionNumber(payload?.nutriments?.caffeineMgPerL),
            ingredientsText: String(payload?.ingredientsText || '').trim(),
            nutritionSource: String(payload?.source || '').trim(),
        };

        const mergedNutrition = {
            sugarsPer100g: incomingNutrition.sugarsPer100g ?? currentNutrition.sugarsPer100g ?? null,
            sodiumMgPer100g: incomingNutrition.sodiumMgPer100g ?? currentNutrition.sodiumMgPer100g ?? null,
            caffeineMgPerL: incomingNutrition.caffeineMgPerL ?? currentNutrition.caffeineMgPerL ?? null,
            ingredientsText: incomingNutrition.ingredientsText || currentNutrition.ingredientsText || '',
            nutritionSource: incomingNutrition.nutritionSource || currentNutrition.nutritionSource || '',
        };
        const allergens = Array.isArray(payload?.allergens)
            ? payload.allergens.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30)
            : [];

        const hasMergedData =
            mergedNutrition.sugarsPer100g !== null ||
            mergedNutrition.sodiumMgPer100g !== null ||
            mergedNutrition.caffeineMgPerL !== null ||
            mergedNutrition.ingredientsText.length > 0 ||
            mergedNutrition.nutritionSource.length > 0;

        if (!hasMergedData) return false;

        const explicitPayload = {
            ingredientsText: mergedNutrition.ingredientsText,
            allergens,
            nutritionSource: mergedNutrition.nutritionSource || 'PriceMate',
            nutritionUpdatedAt: new Date().toISOString(),
        };
        if (mergedNutrition.sugarsPer100g !== null) explicitPayload.sugarsPer100g = mergedNutrition.sugarsPer100g;
        if (mergedNutrition.sodiumMgPer100g !== null) explicitPayload.sodiumMgPer100g = mergedNutrition.sodiumMgPer100g;
        if (mergedNutrition.caffeineMgPerL !== null) explicitPayload.caffeineMgPerL = mergedNutrition.caffeineMgPerL;

        try {
            await db.products.update(productDoc.$id, explicitPayload);
            return true;
        } catch (schemaError) {
            const message = String(schemaError?.message || '');
            if (!/Unknown attribute|Invalid document structure|attribute/i.test(message)) {
                throw schemaError;
            }
        }

        const baseDescription = stripNutritionMeta(productDoc.description || '');
        const nextDescription = `${baseDescription}${NUTRITION_META_MARKER}${JSON.stringify({
            ...mergedNutrition,
            allergens,
        })}`;

        if (String(productDoc.description || '') === nextDescription) {
            return false;
        }

        await db.products.update(productDoc.$id, { description: nextDescription });
        return true;
    } catch (error) {
        console.warn('Catalog nutrition save failed:', error?.message || error);
        return false;
    }
};

/**
 * Build ingredient-check payload from optional Appwrite product fields (sugarsPer100g, ingredientsText, nutritionSource).
 * Returns null if no nutrition fields are set on the document.
 */
export const ingredientPayloadFromAppwriteProduct = (doc) => {
    if (!doc) return null;

    const hiddenNutrition = extractNutritionMeta(doc.description);

    // Prefer explicit fields, then nested `nutrition`, then the hidden description block used before the schema existed.
    const sugarsPer100g = parseNutritionNumber(doc.sugarsPer100g ?? doc?.nutrition?.sugarsPer100g ?? hiddenNutrition?.sugarsPer100g);
    const sodiumMgPer100g = parseNutritionNumber(doc.sodiumMgPer100g ?? doc?.nutrition?.sodiumMgPer100g ?? hiddenNutrition?.sodiumMgPer100g);
    const caffeineMgPerL = parseNutritionNumber(doc.caffeineMgPerL ?? doc?.nutrition?.caffeineMgPerL ?? hiddenNutrition?.caffeineMgPerL);
    const ingredientsText = String(doc.ingredientsText ?? doc?.nutrition?.ingredientsText ?? hiddenNutrition?.ingredientsText ?? '').trim();
    const allergens = Array.isArray(doc.allergens)
        ? doc.allergens
        : (Array.isArray(hiddenNutrition?.allergens) ? hiddenNutrition.allergens : []);

    const hasData =
        sugarsPer100g !== null || sodiumMgPer100g !== null || caffeineMgPerL !== null || ingredientsText.length > 0;
    if (!hasData) return null;

    return {
        barcode: doc.barcode || '',
        name: doc.name || doc.productName || 'Unknown Product',
        brand: doc.brand || '',
        ingredientsText,
        ingredientsList: ingredientsText
            ? ingredientsText.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)
            : [],
        allergens: allergens.map((item) => String(item || '').replace(/^[a-z]{2}:/, '').replace(/_/g, ' ').trim()).filter(Boolean),
        nutriments: {
            sugarsPer100g,
            sodiumMgPer100g,
            caffeineMgPerL,
            caffeineMgPer100g: caffeineMgPerL !== null ? caffeineMgPerL / 10 : null,
            saltGPer100g: null,
        },
        source: 'PriceMate',
        sourceUrl: '',
        nutritionSourceLabel: String(doc.nutritionSource ?? doc?.nutrition?.nutritionSource ?? hiddenNutrition?.nutritionSource ?? '').trim(),
    };
};

const CATALOG_RESOLVE_STOPWORDS = new Set([
    'is', 'this', 'that', 'product', 'for', 'with', 'can', 'i', 'eat', 'drink', 'safe', 'suitable',
    'ingredients', 'ingredient', 'contains', 'has', 'please', 'need', 'check', 'about', 'my', 'me', 'the',
    'a', 'an', 'of', 'in', 'on', 'too', 'very', 'really', 'much', 'many', 'lot', 'how', 'what', 'when',
    'does', 'do', 'did', 'are', 'was', 'were', 'high', 'low', 'level', 'content', 'amount', 'tell',
    'sugar', 'sugary', 'salt', 'sodium', 'caffeine', 'kafein', 'gluten', 'lactose', 'milk', 'nuts',
    'bu', 'şu', 'su', 'mi', 'mı', 'mu', 'mü', 'var', 'içinde', 'nedir',
]);

/**
 * Resolve a catalog product from Appwrite for ingredient questions (full DB, not chat's 50-product slice).
 */
export const resolveCatalogProductForIngredients = async (userMessage) => {
    const empty = { product: null, catalogBarcode: '', catalogName: '' };
    const trimmed = String(userMessage || '').trim();
    if (!trimmed) return empty;

    const barcodeMatch = trimmed.match(/\b(\d{8,14})\b/);
    if (barcodeMatch) {
        try {
            const res = await db.products.list([Query.equal('barcode', barcodeMatch[1]), Query.limit(5)]);
            const doc = res.documents[0];
            if (doc) {
                return {
                    product: doc,
                    catalogBarcode: doc.barcode || barcodeMatch[1],
                    catalogName: doc.name || '',
                };
            }
        } catch (e) {
            console.warn('Catalog barcode lookup failed:', e);
        }
    }

    const searchTerms = buildCatalogSearchTerms(trimmed).filter(
        (term) => term.length >= 2 && !CATALOG_RESOLVE_STOPWORDS.has(term)
    );

    const pickFromDocuments = (documents, term) => {
        if (!documents?.length) return null;
        const fuzzy = findBestProductMatch(trimmed, documents, { minScore: FUZZY_MATCH_MIN_SCORE });
        if (fuzzy?.product) return fuzzy.product;
        const nameLower = (d) => (d.name || '').toLowerCase();
        return documents.find((d) => nameLower(d).includes(term)) || documents[0];
    };

    for (const term of searchTerms) {
        if (term.length < 2) continue;
        try {
            const res = await db.products.list([Query.search('name', term), Query.limit(8)]);
            const best = pickFromDocuments(res.documents, term);
            if (best) {
                return {
                    product: best,
                    catalogBarcode: best.barcode || '',
                    catalogName: best.name || '',
                };
            }
        } catch (e) {
            console.warn('Catalog search failed (index may be missing), trying scan:', e?.message);
        }
    }

    try {
        const res = await db.products.list([Query.limit(500), Query.orderDesc('$createdAt')]);
        const fuzzy = findBestProductMatch(trimmed, res.documents, { minScore: FUZZY_MATCH_MIN_SCORE });
        if (fuzzy?.product) {
            return {
                product: fuzzy.product,
                catalogBarcode: fuzzy.product.barcode || '',
                catalogName: fuzzy.matchedName || fuzzy.product.name || '',
            };
        }

        let best = null;
        let bestScore = 0;
        for (const d of res.documents) {
            const n = (d.name || '').toLowerCase();
            for (const term of searchTerms) {
                if (term.length >= 3 && n.includes(term) && term.length >= bestScore) {
                    best = d;
                    bestScore = term.length;
                }
            }
        }
        if (best) {
            return {
                product: best,
                catalogBarcode: best.barcode || '',
                catalogName: best.name || '',
            };
        }
    } catch (e) {
        console.warn('Catalog scan failed:', e);
    }

    return empty;
};

export const searchIngredientsByName = async (name) => {
    const term = String(name || '').trim();
    if (!term) return null;
    const cacheKey = `off:search:${term.toLowerCase()}`;
    const cached = getCachedValue(cacheKey);
    if (cached) {
        logOffDebug('memory-hit', { kind: 'search', query: term });
        return cached;
    }

    return withInflight(cacheKey, async () => {
        const cachedHits = await searchOffCacheByName(term, 3);
        if (cachedHits.length > 0) {
            const payload = ingredientPayloadFromOffCache(cachedHits[0]);
            if (payload) {
                logOffDebug('appwrite-hit', { kind: 'search', query: term });
                setCachedValue(cacheKey, payload, OFF_SEARCH_TTL_MS);
                return payload;
            }
        }
        try {
            logOffDebug('api-fetch', { kind: 'search', query: term });
            let data = null;
            if (OFF_PROXY_FUNCTION_ID) {
                const proxyResult = await callOffProxy({ kind: 'search', query: term, pageSize: 5 });
                if (!proxyResult?.ok) return null;
                data = proxyResult.data;
            } else {
                const response = await fetchWithBackoff(
                    `${OFF_API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=5`
                );
                if (!response?.ok) return null;
                data = await response.json();
            }
            const products = Array.isArray(data?.products) ? data.products : [];
            if (products.length === 0) return null;

            const normalizedQuery = term.toLowerCase();
            const bestMatch = products.find((p) => (p.product_name || '').toLowerCase().includes(normalizedQuery)) || products[0];
            const payload = normalizeIngredientsPayload(bestMatch);
            await saveOffCacheFromProduct(bestMatch, payload?.barcode);
            setCachedValue(cacheKey, payload, OFF_SEARCH_TTL_MS);
            return payload;
        } catch (error) {
            console.error('Error searching OpenFoodFacts by name:', error);
            return null;
        }
    });
};

// Helper to safely get ID from a relationship field (which could be an object, array, or string ID)
export const getRelationshipId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) {
        return field.length > 0 ? getRelationshipId(field[0]) : null;
    }
    if (typeof field === 'string') return field;
    return field.$id;
};

const normalizeProductKey = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    const relId = getRelationshipId(value);
    return relId ? String(relId) : null;
};

const getPriceProductId = (price) => {
    if (!price) return null;
    const relId = getRelationshipId(price.products);
    if (relId) return String(relId);
    return (
        normalizeProductKey(price.productId) ||
        normalizeProductKey(price.productID) ||
        normalizeProductKey(price.product)
    );
};

// Helper to safely get attribute from relationship (only if expanded)
export const getRelationshipAttribute = (field, attribute) => {
    if (!field) return null;
    if (Array.isArray(field)) {
        return field.length > 0 ? getRelationshipAttribute(field[0], attribute) : null;
    }
    if (typeof field === 'object' && field[attribute]) {
        return field[attribute];
    }
    return null;
};

const getPricesIndex = (prices) => {
    if (!Array.isArray(prices)) return null;
    const cached = pricesIndexCache.get(prices);
    if (cached) return cached;

    const index = new Map();
    for (const price of prices) {
        const productId = getPriceProductId(price);
        if (!productId) continue;
        const bucket = index.get(productId);
        if (bucket) {
            bucket.push(price);
        } else {
            index.set(productId, [price]);
        }
    }

    pricesIndexCache.set(prices, index);
    return index;
};

/** Expanded category document for icon/label (not a bare relation id string). */
export const getExpandedCategoryDoc = (categoryId) => {
    if (!categoryId) return null;
    if (typeof categoryId === 'string') return null;
    const doc = Array.isArray(categoryId) ? categoryId[0] : categoryId;
    if (!doc || typeof doc !== 'object') return null;
    if (doc.categoryName != null || doc.name != null || doc.icon != null) return doc;
    return null;
};

/**
 * Fetch all prices with supermarket relationship data
 */
export const fetchAllPrices = async (limit = 200) => {
    const cacheKey = `allPrices:${limit}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    try {
        const response = await db.prices.list([
            Query.limit(limit),
            Query.orderDesc('$createdAt'),
            Query.select(PRODUCT_PRICE_SELECT)
        ]);
        setCachedValue(cacheKey, response.documents, CACHE_TTL.allPrices);
        return response.documents;
    } catch (error) {
        console.error('Error fetching all prices:', error);
        return [];
    }
};

/**
 * Get prices for a specific product ID
 */
export const getPricesForProduct = (prices, productId) => {
    if (!prices || !productId) return [];
    const index = getPricesIndex(prices);
    if (index) {
        const bucket = index.get(productId);
        if (bucket) return bucket;
    }
    return prices.filter((price) => getPriceProductId(price) === productId);
};

/**
 * Get the cheapest price for a product
 * @returns {Object|null} Price object with lowest price, or null if no prices
 */
export const getCheapestPrice = (prices, productId) => {
    const productPrices = getPricesForProduct(prices, productId);
    if (productPrices.length === 0) return null;

    return productPrices.reduce((min, price) =>
        price.price < min.price ? price : min
    );
};

/**
 * Get price statistics for a product across all supermarkets
 * @returns {Object|null} Stats object with min, max, avg, count
 */
export const getPriceStats = (prices, productId) => {
    const productPrices = getPricesForProduct(prices, productId);
    if (productPrices.length === 0) return null;

    const priceValues = productPrices.map(p => p.price);
    return {
        min: Math.min(...priceValues),
        max: Math.max(...priceValues),
        avg: (priceValues.reduce((a, b) => a + b, 0) / priceValues.length).toFixed(2),
        count: productPrices.length,
        cheapestStore: getCheapestPrice(prices, productId)
    };
};

/**
 * Get the lowest price from a list of prices
 */
export const getLowestPrice = (prices) => {
    if (!prices || prices.length === 0) return null;
    return prices.reduce((min, p) => p.price < min.price ? p : min, prices[0]);
};

/**
 * Fetch products with category relationship
 */
export const fetchProducts = async (limit = 50) => {
    const cacheKey = `products:${limit}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    try {
        const response = await db.products.list([
            Query.limit(limit),
            Query.orderDesc('$createdAt'),
            Query.select(['*', 'categoryId.*'])
        ]);
        setCachedValue(cacheKey, response.documents, CACHE_TTL.products);
        return response.documents;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
};

/**
 * Fetch similar products for a category (excluding the current product).
 */
export const fetchSimilarProductsByCategory = async (categoryId, excludeId = null, limit = 6) => {
    if (!categoryId) return [];
    const cacheKey = `similar:${categoryId}:${excludeId || 'none'}:${limit}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    return withInflight(cacheKey, async () => {
        try {
            const response = await db.products.list([
                Query.equal('categoryId', categoryId),
                Query.limit(limit + 1),
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'categoryId.*'])
            ]);

            const filtered = response.documents
                .filter((doc) => doc.$id !== excludeId)
                .slice(0, limit);

            setCachedValue(cacheKey, filtered, CACHE_TTL.similar);
            return filtered;
        } catch (error) {
            console.error('Error fetching similar products:', error);
            return [];
        }
    });
};

/**
 * True if lat/lon are finite numbers within WGS84 ranges (string/number inputs OK).
 */
export const hasValidLatLon = (lat, lon) => {
    const la = typeof lat === 'number' ? lat : parseFloat(String(lat ?? ''));
    const lo = typeof lon === 'number' ? lon : parseFloat(String(lon ?? ''));
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
    if (la < -90 || la > 90) return false;
    if (lo < -180 || lo > 180) return false;
    return true;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!hasValidLatLon(lat1, lon1) || !hasValidLatLon(lat2, lon2)) return null;
    const a1 = typeof lat1 === 'number' ? lat1 : parseFloat(String(lat1));
    const o1 = typeof lon1 === 'number' ? lon1 : parseFloat(String(lon1));
    const a2 = typeof lat2 === 'number' ? lat2 : parseFloat(String(lat2));
    const o2 = typeof lon2 === 'number' ? lon2 : parseFloat(String(lon2));
    const R = 6371; // Radius of the earth in km
    const dLat = (a2 - a1) * (Math.PI / 180);
    const dLon = (o2 - o1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(a1 * (Math.PI / 180)) * Math.cos(a2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
};

const SUPERMARKET_CONTEXT_CAP = 20;
const SUPERMARKET_NO_COORDS_CAP = 5;

/**
 * Build ranked supermarket lines for AI system prompt (distance when user location known).
 */
export const buildSupermarketContextLines = (supermarkets = [], userLocation = null) => {
    const list = Array.isArray(supermarkets) ? supermarkets : [];
    const userOk = userLocation && hasValidLatLon(userLocation.latitude, userLocation.longitude);
    const userLat = userOk ? Number(userLocation.latitude) : null;
    const userLon = userOk ? Number(userLocation.longitude) : null;

    const withCoords = [];
    const withoutCoords = [];

    for (const doc of list) {
        if (!doc?.$id) continue;
        const coords = resolveCoordinates(doc);
        const name = String(doc.name || '').trim();
        const branch = String(doc.branchName || '').trim();
        const label = branch && branch !== name ? `${name} — ${branch}` : (name || 'Store');
        const address = String(doc.address || '').trim().slice(0, 80);

        if (!coords) {
            withoutCoords.push({ doc, label, address });
            continue;
        }

        let distanceKm = null;
        if (userOk) {
            const raw = calculateDistance(userLat, userLon, coords.latitude, coords.longitude);
            distanceKm = raw !== null ? parseFloat(raw) : null;
            if (!Number.isFinite(distanceKm)) distanceKm = null;
        }

        withCoords.push({
            id: doc.$id,
            label,
            address,
            coords,
            distanceKm,
        });
    }

    if (userOk) {
        withCoords.sort((a, b) => {
            if (a.distanceKm === null && b.distanceKm === null) {
                return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
            }
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
        });
    } else {
        withCoords.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }

    const lines = [];
    for (const row of withCoords.slice(0, SUPERMARKET_CONTEXT_CAP)) {
        const parts = [`[STORE:${row.id}]`, row.label];
        if (row.distanceKm !== null) parts.push(`${row.distanceKm} km`);
        parts.push(`${row.coords.latitude},${row.coords.longitude}`);
        if (row.address) parts.push(row.address);
        lines.push(`- ${parts.join(' | ')}`);
    }

    for (const row of withoutCoords.slice(0, SUPERMARKET_NO_COORDS_CAP)) {
        const tail = row.address ? ` | ${row.address}` : '';
        lines.push(`- [STORE:${row.doc.$id}] ${row.label} | location not on map${tail}`);
    }

    if (lines.length === 0) {
        return '(No supermarkets with map locations in the catalog yet.)';
    }

    return lines.join('\n');
};

export const isUserLocationAvailableForStores = (userLocation) =>
    Boolean(userLocation && hasValidLatLon(userLocation.latitude, userLocation.longitude));

const buildSupermarketDisplayLabel = (name, branchName) => {
    const storeName = String(name || '').trim();
    const branch = String(branchName || '').trim();
    if (storeName && branch && branch !== storeName) return `${storeName} — ${branch}`;
    return storeName || branch || '';
};

/**
 * Resolve supermarket id/name/label for a price row (expanded relation or id lookup).
 */
export const resolvePriceSupermarketMeta = (price, supermarkets = []) => {
    if (!price) {
        return { supermarketId: null, name: null, branchName: null, label: '' };
    }

    const supermarketId = getRelationshipId(price.supermarkets) || price.supermarketId || null;
    let name = getRelationshipAttribute(price.supermarkets, 'name') || price.supermarketName || null;
    let branchName =
        getRelationshipAttribute(price.supermarkets, 'branchName') ||
        price.supermarketBranchName ||
        null;

    const relDoc = Array.isArray(price.supermarkets) ? price.supermarkets[0] : price.supermarkets;
    if (relDoc && typeof relDoc === 'object') {
        if (relDoc.name) name = relDoc.name;
        if (relDoc.branchName) branchName = relDoc.branchName;
    }

    if (!name && supermarketId && Array.isArray(supermarkets)) {
        const doc = supermarkets.find((s) => s.$id === supermarketId);
        if (doc) {
            name = doc.name || name;
            branchName = doc.branchName || branchName;
        }
    }

    const label = buildSupermarketDisplayLabel(name, branchName) || name || '';
    return {
        supermarketId,
        name: name || null,
        branchName: branchName || null,
        label,
    };
};

/** Expand slim price rows with full supermarket documents (for comparison / maps). */
export const enrichPricesWithSupermarketDocs = (prices, supermarkets = []) => {
    if (!Array.isArray(prices) || prices.length === 0) return prices;
    const catalog = Array.isArray(supermarkets) ? supermarkets : [];
    if (catalog.length === 0) return prices;

    const byId = new Map(catalog.map((store) => [store.$id, store]));

    return prices.map((price) => {
        const supermarketId = getRelationshipId(price.supermarkets) || price.supermarketId || null;
        if (!supermarketId) return price;

        const rel = price.supermarkets;
        const hasExpanded =
            rel &&
            typeof rel === 'object' &&
            !Array.isArray(rel) &&
            (rel.name != null || rel.branchName != null || rel.latitude != null);
        if (hasExpanded) return price;

        const doc = byId.get(supermarketId);
        if (!doc) return price;
        return { ...price, supermarkets: doc };
    });
};

export const fetchSupermarketsCatalog = async (limit = 100) => {
    const cacheKey = `supermarkets:catalog:${limit}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    try {
        const response = await db.supermarkets.list([Query.limit(limit)]);
        setCachedValue(cacheKey, response.documents, CACHE_TTL.categories);
        return response.documents;
    } catch (error) {
        console.warn('Supermarket catalog fetch failed:', error?.message || error);
        return [];
    }
};

export const enrichProductPricesWithSupermarkets = (products, supermarkets = []) => {
    const list = Array.isArray(products) ? products : [];
    return list.map((product) => {
        const prices = Array.isArray(product.prices) ? product.prices : [];
        const enrichedPrices = prices.map((pr) => {
            const meta = resolvePriceSupermarketMeta(pr, supermarkets);
            return {
                ...pr,
                supermarketId: meta.supermarketId || pr.supermarketId,
                supermarketName: meta.name || pr.supermarketName,
                supermarketBranchName: meta.branchName || pr.supermarketBranchName,
                supermarketLabel: meta.label,
            };
        });
        return { ...product, prices: enrichedPrices };
    });
};

/**
 * Standardize product data format
 */
export const normalizeProduct = (product, prices = []) => {
    if (!product) return null;

    const productId = product.$id || product.code; // code is used by OFF
    const productPrices = getPricesForProduct(prices, productId);

    const cheapest = productPrices.length > 0 
        ? productPrices.reduce((min, p) => p.price < min.price ? p : min, productPrices[0])
        : null;

    // Handle OpenFoodFacts fields vs Appwrite fields
    const name = product.name || product.product_name || 'Unknown Product';
    const image = product.imageUrl || product.image || product.image_url || product.image_front_url || '';
    const brand = product.brand || product.brands || '';
    const categoryName =
        getRelationshipAttribute(product.categoryId, 'categoryName') ||
        getRelationshipAttribute(product.categoryId, 'name') ||
        product.categories?.split(',')[0] ||
        'Other';
    
    return {
        ...product,
        id: productId,
        name,
        image,
        description: stripNutritionMeta(product.description || ''),
        brand,
        category: categoryName,
        cheapestPrice: cheapest ? cheapest.price : null,
        priceCount: productPrices.length,
        prices: productPrices,
        unit: product.unit || product.quantity || '',
        weight: product.weight || '',
        nutriscore: product.nutriscore_grade || null,
        allergens: product.allergens_tags || [],
        is_global: !!product.is_global,
        updatedAt: product.$updatedAt
    };
};

/**
 * Checks if a store is currently open based on its opening hours.
 * Expects format: {"Mon": "08:00-22:00", "Tue": "08:00-22:00", ...}
 */
export const isStoreOpen = (openingHours) => {
    if (!openingHours) return true; // Default to open if no info
    
    try {
        const hours = typeof openingHours === 'string' ? JSON.parse(openingHours) : openingHours;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const dayName = days[now.getDay()];
        const todayHours = hours[dayName];
        
        if (!todayHours || todayHours.toLowerCase() === 'closed') return false;
        
        const [start, end] = todayHours.split('-');
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        const currentTime = currentH * 60 + currentM;
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;
        
        return currentTime >= startTime && currentTime < endTime;
    } catch (e) {
        console.warn('Error parsing opening hours:', e);
        return true;
    }
};

/**
 * Formats a Date/Timestamp to a human readable "Today, 9:24 AM" etc
 */
export const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
};

/**
 * Fetch price history for a specific product
 */
export const fetchPriceHistory = async (productId, branchId = null) => {
    if (!productId) return [];

    try {
        const historyColl = COLLECTIONS.PRICE_HISTORY || 'price_history';
        const historyDocs = [];
        const historyIds = new Set();

        const HISTORY_PAGE_SIZE = 100;
        const HISTORY_MAX_DOCS = 1000;

        const fetchHistoryByField = async (productField, branchField) => {
            try {
                let cursor = null;
                while (historyDocs.length < HISTORY_MAX_DOCS) {
                    const queries = [
                        Query.equal(productField, productId),
                        Query.orderAsc('timestamp'),
                        Query.limit(HISTORY_PAGE_SIZE),
                    ];
                    if (branchId) {
                        queries.push(Query.equal(branchField, branchId));
                    }
                    if (cursor) {
                        queries.push(Query.cursorAfter(cursor));
                    }
                    const response = await db.priceHistory.list(queries);
                    const docs = response.documents || [];
                    docs.forEach((doc) => {
                        if (!historyIds.has(doc.$id)) {
                            historyIds.add(doc.$id);
                            historyDocs.push(doc);
                        }
                    });
                    if (docs.length < HISTORY_PAGE_SIZE) break;
                    cursor = docs[docs.length - 1]?.$id;
                    if (!cursor) break;
                }
            } catch (innerError) {
                if (innerError.code === 404) {
                    console.warn(`Price history collection "${historyColl}" not found in Appwrite.`);
                }
            }
        };

        await fetchHistoryByField('productId', 'supermarketId');

        let priceDocs = [];
        try {
            priceDocs = await fetchPricesForProducts([productId]);
            if (branchId) {
                priceDocs = priceDocs.filter((price) => {
                    const smId = getRelationshipId(price.supermarkets) || price.supermarketId;
                    return smId === branchId;
                });
            }
        } catch (innerError) {
            console.warn('Price stack query failed:', innerError?.message || innerError);
        }

        const merged = [];

        historyDocs.forEach((item) => {
            const timestamp = item.timestamp || item.recordedAt || item.$createdAt || null;
            const supermarketId = item.supermarketId || getRelationshipId(item.supermarkets);
            merged.push({
                ...item,
                timestamp,
                supermarketId,
                price: Number(item.price)
            });
        });

        priceDocs.forEach((price) => {
            const timestamp = price.$updatedAt || price.updatedAt || price.$createdAt || price.createdAt || null;
            if (!timestamp) return;

            const supermarketId = getRelationshipId(price.supermarkets) || price.supermarketId || null;
            const supermarketName = getRelationshipAttribute(price.supermarkets, 'name') || price.supermarketName;

            merged.push({
                price: Number(price.price),
                timestamp,
                supermarketId,
                supermarketName,
                currency: price.currency || 'TRY'
            });
        });

        const unique = new Map();
        merged.forEach((item) => {
            if (!item.timestamp) return;
            const key = `${item.supermarketId || 'unknown'}-${item.timestamp}-${item.price}`;
            if (!unique.has(key)) unique.set(key, item);
        });

        return [...unique.values()].sort((a, b) => {
            const aTime = new Date(a.timestamp).getTime();
            const bTime = new Date(b.timestamp).getTime();
            return aTime - bTime;
        });
    } catch (error) {
        // Silently fail for other issues but log warning
        console.warn('Price history fetch issues:', error.message);
        return [];
    }
};

/**
 * Search products by name, barcode, or category with optimized server-side query
 */
export const searchProducts = async (query = '', categoryId = null, limit = 20, sortBy = 'relevance') => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const normalizedCategory = categoryId || 'all';
    const cacheKey = `search:${normalizedQuery || 'all'}:${normalizedCategory}:${limit}:${sortBy}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    return withInflight(cacheKey, async () => {
        try {
            const queries = [
                Query.limit(limit),
                Query.select(['*', 'categoryId.*'])
            ];

            if (categoryId) {
                queries.push(Query.equal('categoryId', categoryId));
            }

            // Handle Sorting Server-Side where possible
            if (sortBy === 'name') {
                queries.push(Query.orderAsc('name'));
            } else if (sortBy === 'newest') {
                queries.push(Query.orderDesc('$createdAt'));
            }

            let results = null;

            // Optimized Search Strategy:
            // If query is a digit sequence, suspect barcode
            if (/^\d+$/.test(normalizedQuery)) {
                queries.push(Query.equal('barcode', normalizedQuery));
            } else if (normalizedQuery) {
                // First attempt server-side search indexing
                try {
                    results = await db.products.list(
                        [...queries, Query.contains('name', normalizedQuery)]
                    );

                    // If we have results, return them. If not, don't fallback to "all latest" 
                    // because it confuses users to see unrelated products when they searched for something specific.
                    if (results.documents.length > 0) {
                        setCachedValue(cacheKey, results.documents, CACHE_TTL.search);
                        return results.documents;
                    }
                    if (normalizedQuery.length > 2) {
                        setCachedValue(cacheKey, [], CACHE_TTL.search);
                        return [];
                    }
                } catch (error) {
                    console.warn('Server-side search index issue:', error.message);
                }
            }

            // Fallback: Fetch latest and filter (best for small datasets or missing indexes)
            const response = results || await db.products.list(queries);

            if (!normalizedQuery) {
                setCachedValue(cacheKey, response.documents, CACHE_TTL.search);
                return response.documents;
            }

            const filtered = response.documents.filter(product =>
                product.name.toLowerCase().includes(normalizedQuery) ||
                product.barcode?.includes(normalizedQuery)
            );

            setCachedValue(cacheKey, filtered, CACHE_TTL.search);
            return filtered;
        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    });
};

/**
 * Fetch prices for a list of products in one request
 */
export const fetchPricesForProducts = async (productIds) => {
    if (!productIds || productIds.length === 0) return [];

    const normalizedIds = [...new Set(productIds)].sort();
    const cacheKey = `prices:${normalizedIds.join(',')}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    const isMissingAttributeError = (error) => {
        const message = String(error?.message || '').toLowerCase();
        if (error?.code === 400 && (message.includes('attribute') || message.includes('schema'))) {
            return true;
        }
        return false;
    };

    return withInflight(cacheKey, async () => {
        // Appwrite Query.equal supports arrays, but large arrays should be chunked
        const CHUNK_SIZE = 25;
        const allPrices = [];
        const seenPriceIds = new Set();

        const addPrices = (prices) => {
            for (const price of prices) {
                if (!price?.$id || seenPriceIds.has(price.$id)) continue;
                seenPriceIds.add(price.$id);
                allPrices.push(price);
            }
        };

        const fetchByField = async (field, ids, select) => {
            if (!ids.length) return [];
            if (priceFieldSupport[field] === false) return [];
            try {
                const response = await db.prices.list([
                    Query.equal(field, ids),
                    Query.limit(100),
                    Query.select(select)
                ]);
                priceFieldSupport[field] = true;
                return response.documents;
            } catch (error) {
                if (isMissingAttributeError(error)) {
                    priceFieldSupport[field] = false;
                    return [];
                }
                console.error('Error fetching prices for batch products:', error);
                return [];
            }
        };

        try {
            for (let i = 0; i < normalizedIds.length; i += CHUNK_SIZE) {
                const chunk = normalizedIds.slice(i, i + CHUNK_SIZE);
                const batch = await fetchByField('products', chunk, PRODUCT_PRICE_SELECT);
                addPrices(batch);
            }
            setCachedValue(cacheKey, allPrices, CACHE_TTL.prices);
            return allPrices;
        } catch (error) {
            console.error('Error fetching prices for batch products:', error);
            return [];
        }
    });
};

/**
 * Fetch single product by barcode
 */
export const fetchProductByBarcode = async (barcode) => {
    try {
        const response = await db.products.list([
            Query.equal('barcode', barcode),
            Query.limit(1),
            Query.select(PRODUCT_LIST_SELECT)
        ]);

        if (response.documents.length > 0) {
            return response.documents[0];
        }

        const fallback = await db.products.list([
            Query.equal('$id', barcode),
            Query.limit(1),
            Query.select(PRODUCT_LIST_SELECT)
        ]);

        return fallback.documents[0] || null;
    } catch (error) {
        console.error('Error fetching product by barcode:', error);
        return null;
    }
};

/**
 * Fetch supermarket by ID
 */
export const fetchSupermarketById = async (id) => {
    try {
        const response = await db.supermarkets.get(id);
        return response;
    } catch (error) {
        console.error('Error fetching supermarket:', error);
        return null;
    }
};

/**
 * Fetch prices by supermarket ID
 */
export const fetchPricesBySupermarket = async (supermarketId) => {
    try {
        // Use server-side Query.equal for relationship filtering
        const pricesResponse = await db.prices.list([
            Query.equal('supermarkets', supermarketId),
            Query.limit(100),
            Query.orderDesc('$createdAt'),
            Query.select(['*', 'products.*', 'supermarkets.*', 'products.categoryId.*'])
        ]);

        const prices = pricesResponse.documents;
        if (prices.length === 0) return [];

        // Enrich with comparisons (requires fetching other store prices for these products)
        // For performance, we'll return the prices with their product info attached
        return prices.filter(p => p.products).map(price => ({
            ...price,
            product: normalizeProduct(price.products, [price])
        }));
    } catch (error) {
        console.error('Error fetching supermarket prices:', error);
        return [];
    }
};

/**
 * Fetch all supermarkets with the same name (branches)
 */
export const fetchSupermarketBranches = async (name) => {
    try {
        const response = await db.supermarkets.list([
            Query.equal('name', name),
            Query.limit(50)
        ]);
        return response.documents;
    } catch (error) {
        console.error('Error fetching supermarket branches:', error);
        return [];
    }
};

/**
 * All supermarkets in the same group as `currentDoc`: parent + siblings when `parentId` is set,
 * otherwise children with `parentId === currentDoc.$id` plus legacy same-name branches.
 * Deduplicated by `$id`. Caller should order with current first for display.
 */
export const resolveRelatedSupermarkets = async (currentDoc) => {
    if (!currentDoc || !currentDoc.$id) return [];

    const byId = new Map();
    const addDocs = (docs) => {
        for (const d of docs || []) {
            if (d && d.$id) byId.set(d.$id, d);
        }
    };

    try {
        if (currentDoc.parentId) {
            const siblingsResponse = await db.supermarkets.list([
                Query.equal('parentId', currentDoc.parentId),
                Query.limit(50)
            ]);
            addDocs(siblingsResponse.documents);
            const parent = await fetchSupermarketById(currentDoc.parentId);
            if (parent) addDocs([parent]);
        } else {
            const childrenResponse = await db.supermarkets.list([
                Query.equal('parentId', currentDoc.$id),
                Query.limit(50)
            ]);
            addDocs(childrenResponse.documents);
            const byName = await fetchSupermarketBranches(currentDoc.name || '');
            addDocs(byName);
        }

        addDocs([currentDoc]);
        return Array.from(byId.values());
    } catch (error) {
        console.error('Error resolving related supermarkets:', error);
        return [currentDoc];
    }
};

/**
 * Update a product price and record its history for tracking trends.
 * @param {string} priceId - Document ID in the prices collection.
 * @param {string} productId - ID of the product.
 * @param {string} supermarketId - ID of the branch/supermarket.
 * @param {number} newPrice - The new validated price.
 * @param {string} currency - e.g., 'AED'.
 */
export const updatePriceWithHistory = async (priceId, productId, supermarketId, newPrice, currency = 'AED') => {
    try {
        const timestamp = new Date().toISOString();

        // 1. Update the main price document
        await db.prices.update(priceId, { 
            price: parseFloat(newPrice),
            $updatedAt: timestamp 
        });

        // 2. Create a historical record entry
        await db.priceHistory.create({
            products: productId,
            supermarkets: supermarketId,
            price: parseFloat(newPrice),
            currency: currency,
            recordedAt: timestamp
        });

        return { success: true, message: 'Price and history updated successfully' };
    } catch (error) {
        console.error('Error in multi-step price update:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Fetch extended price history for trending charts
 */
export const fetchPriceHistoryExtended = async (productId, branchId = null) => {
    try {
        const queries = [
            Query.equal('products', productId),
            Query.orderDesc('recordedAt'),
            Query.limit(50)
        ];

        if (branchId) {
            queries.push(Query.equal('supermarkets', branchId));
        }

        const response = await db.priceHistory.list(queries);

        return response.documents;
    } catch (error) {
        console.warn('Price history fetch failed:', error.message);
        return [];
    }
};

/**
 * Fetch all categories sorted by name
 */
export const fetchCategories = async () => {
    const cacheKey = 'categories';
    const cached = getCachedValue(cacheKey);
    if (cached) return cached;

    try {
        try {
            const response = await db.categories.list([
                Query.limit(100),
                Query.orderAsc('categoryName')
            ]);
            setCachedValue(cacheKey, response.documents, CACHE_TTL.categories);
            return response.documents;
        } catch (error) {
            console.warn('Category sort by name failed, falling back to unsorted fetch:', error.message);
            const response = await db.categories.list([Query.limit(100)]);
            const sorted = response.documents.sort((a, b) => {
                const aName = (a.categoryName || a.name || '').toLowerCase();
                const bName = (b.categoryName || b.name || '').toLowerCase();
                return aName.localeCompare(bName);
            });
            setCachedValue(cacheKey, sorted, CACHE_TTL.categories);
            return sorted;
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
};
