const sdk = require('node-appwrite');

const OFF_API_BASE = 'https://world.openfoodfacts.org';
const NUTRITION_META_MARKER = '\n\n[PriceMate Nutrition]\n';
const CACHE_TTL_MS = 30 * 1000;
const OFF_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SUGAR_THRESHOLD_G_PER_100G = 22.5;
const SODIUM_THRESHOLD_MG_PER_100G = 600;
const CAFFEINE_THRESHOLD_MG_PER_L = 150;

const memoryCache = new Map();
const inflight = new Map();

const COLLECTIONS = {
    PRODUCTS: process.env.APPWRITE_COLLECTION_PRODUCTS || process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    PRICES: process.env.APPWRITE_COLLECTION_PRICES || process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
    OFF_CACHE: process.env.APPWRITE_COLLECTION_OFF_CACHE || process.env.VITE_APPWRITE_COLLECTION_OFF_CACHE || 'off_cache',
};

const NO_ALLERGY_VALUES = new Set([
    'none',
    'no allergy',
    'no allergies',
    'no known allergy',
    'no known allergies',
    'no_known_allergies',
    'bilinen alerjim yok',
]);
const DIETARY_VALUES = new Set(['vegetarian', 'vegan', 'halal', 'kosher']);
const NUTRITION_VALUES = new Set(['low sugar', 'low sodium', 'low caffeine', 'high protein']);
const BUDGET_VALUES = new Set(['lowest_price', 'balanced', 'quality_first']);
const RESPONSE_STYLE_VALUES = new Set(['concise', 'balanced', 'detailed']);
const DIETARY_RESTRICTION_TERMS = {
    vegan: ['milk', 'dairy', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'egg', 'honey', 'gelatin', 'sut', 'laktoz', 'yumurta', 'bal', 'jelatin'],
    vegetarian: ['beef', 'chicken', 'pork', 'fish', 'shellfish', 'meat', 'gelatin', 'tavuk', 'sigir', 'domuz', 'balik', 'jelatin'],
    halal: ['pork', 'bacon', 'ham', 'lard', 'alcohol', 'wine', 'beer', 'gelatin', 'domuz', 'alkol', 'sarap', 'bira', 'jelatin'],
    kosher: ['pork', 'bacon', 'ham', 'lard', 'shellfish', 'shrimp', 'crab', 'lobster', 'domuz', 'karides', 'yengec'],
};
const ALLERGEN_GROUPS = [
    { label: 'milk', terms: ['milk', 'dairy', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'lactose', 'sut', 'laktoz', 'peynir', 'yogurt', 'tereyag', 'krema', 'kazein'] },
    { label: 'lactose', terms: ['lactose', 'laktoz', 'milk', 'dairy', 'whey', 'casein', 'sut'] },
    { label: 'peanut', terms: ['peanut', 'peanuts', 'yer fistigi', 'fistik'] },
    { label: 'tree nuts', terms: ['almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'pecan', 'nuts', 'badem', 'ceviz', 'findik', 'kaju'] },
    { label: 'egg', terms: ['egg', 'eggs', 'yumurta'] },
    { label: 'soy', terms: ['soy', 'soya'] },
    { label: 'gluten', terms: ['gluten', 'wheat', 'barley', 'rye', 'malt', 'bugday', 'arpa', 'cavdar'] },
    { label: 'fish', terms: ['fish', 'balik'] },
    { label: 'shellfish', terms: ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'karides', 'yengec', 'istakoz'] },
    { label: 'sesame', terms: ['sesame', 'susam'] },
    { label: 'mustard', terms: ['mustard', 'hardal'] },
    { label: 'celery', terms: ['celery', 'kereviz'] },
    { label: 'lupin', terms: ['lupin', 'aci bakla'] },
    { label: 'sulfites', terms: ['sulfite', 'sulphite', 'sulfit'] },
];
const ALLERGEN_BY_LABEL = new Map(ALLERGEN_GROUPS.map((group) => [group.label, group]));

const json = (res, payload, status = 200) => res.json(payload, status);

const parseBody = (req) => {
    if (!req?.body) return req?.query || {};
    try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
        return {};
    }
};

const normalizeText = (value) => String(value || '').trim().toLowerCase().replace(/_/g, ' ');
const normalizeLooseList = (value = []) => {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[,\n|]+/);
    return Array.from(new Set(raw.map(normalizeText).filter(Boolean)));
};
const normalizeAllowedList = (value, allowedValues) =>
    normalizeLooseList(value).filter((item) => allowedValues.has(item));
const normalizeFreeTextList = (value) =>
    normalizeLooseList(value).map((item) => item.replace(/\s+/g, ' ').trim()).filter((item) => item.length >= 2).slice(0, 12);
const normalizeChoice = (value, allowedValues, fallback) => {
    const normalized = normalizeText(value);
    return allowedValues.has(normalized) ? normalized : fallback;
};
const normalizeUserProfile = (profile = {}) => {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
        version: 1,
        dietaryPreferences: normalizeAllowedList(source.dietaryPreferences, DIETARY_VALUES),
        nutritionPriorities: normalizeAllowedList(source.nutritionPriorities, NUTRITION_VALUES),
        avoidIngredients: normalizeFreeTextList(source.avoidIngredients),
        budgetPreference: normalizeChoice(source.budgetPreference, BUDGET_VALUES, 'balanced'),
        preferredStores: normalizeFreeTextList(source.preferredStores),
        preferredBrands: normalizeFreeTextList(source.preferredBrands),
        dislikedBrands: normalizeFreeTextList(source.dislikedBrands),
        responseStyle: normalizeChoice(source.responseStyle, RESPONSE_STYLE_VALUES, 'balanced'),
    };
};
const normalizeCurrency = (value) => {
    const upper = String(value || 'TRY').trim().toUpperCase();
    return upper === 'TL' ? 'TRY' : upper;
};

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
};

const cacheGet = (key) => {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
};

const cacheSet = (key, value, ttlMs = CACHE_TTL_MS) => {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const withInflight = async (key, fn) => {
    if (inflight.has(key)) return inflight.get(key);
    const promise = fn().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
};

const metric = (log, name, details = {}) => {
    try {
        log(JSON.stringify({ metric: name, ...details }));
    } catch {
        // ignore logging failures
    }
};

const createDatabases = () => {
    const endpoint =
        process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
        process.env.APPWRITE_ENDPOINT ||
        process.env.VITE_APPWRITE_ENDPOINT;
    const projectId =
        process.env.APPWRITE_FUNCTION_PROJECT_ID ||
        process.env.APPWRITE_PROJECT_ID ||
        process.env.VITE_APPWRITE_PROJECT_ID;
    const apiKey =
        process.env.APPWRITE_API_KEY ||
        process.env.APPWRITE_FUNCTION_API_KEY ||
        process.env.APPWRITE_FUNCTION_API_KEY_SECRET;
    const databaseId =
        process.env.APPWRITE_DATABASE_ID ||
        process.env.APPWRITE_FUNCTION_DATABASE_ID ||
        process.env.VITE_APPWRITE_DATABASE_ID;

    if (!endpoint || !projectId || !apiKey || !databaseId) {
        return { databases: null, databaseId: '', configError: 'missing_appwrite_config' };
    }

    const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    return { databases: new sdk.Databases(client), databaseId, configError: '' };
};

const classifyIntent = (query) => {
    const text = normalizeText(query);
    const has = (items) => items.some((item) => text.includes(item));

    const ingredient = has([
        'ingredient', 'ingredients', 'allergen', 'allergens', 'contains', 'safe', 'suitable',
        'good for me', 'better for me', 'nutrition', 'nutrient', 'sugar', 'sodium', 'salt', 'caffeine', 'gluten', 'lactose',
        'icerik', 'icindekiler', 'alerji', 'alerjen', 'uygun', 'guvenli', 'seker', 'sodyum', 'tuz', 'kafein'
    ]);
    const price = has([
        'price', 'cheapest', 'cheap', 'expensive', 'cost', 'deal', 'compare price', 'best price',
        'fiyat', 'ucuz', 'pahali', 'kac para'
    ]);

    if (ingredient) return 'ingredient_safety';
    if (price) return 'price_check';
    return 'generic';
};

const barcodeFromQuery = (query) => {
    const match = String(query || '').match(/\b\d{8,14}\b/);
    return match ? match[0] : '';
};

const wordsForSearch = (query) => {
    const stop = new Set([
        'is', 'this', 'that', 'product', 'for', 'with', 'can', 'i', 'eat', 'drink', 'safe', 'suitable',
        'ingredients', 'ingredient', 'contains', 'has', 'please', 'need', 'check', 'about', 'my', 'me',
        'the', 'a', 'an', 'of', 'in', 'on', 'too', 'very', 'much', 'many', 'price', 'cheapest',
        'cheap', 'expensive', 'cost', 'good', 'better', 'sugar', 'salt', 'sodium', 'caffeine', 'gluten', 'lactose',
        'bu', 'su', 'urun', 'icerik', 'icindekiler', 'uygun', 'guvenli', 'var', 'mi', 'fiyat',
        'ucuz', 'pahali', 'seker', 'tuz', 'sodyum', 'kafein'
    ]);
    return normalizeText(query)
        .replace(/\b\d{8,14}\b/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2 && !stop.has(word))
        .sort((a, b) => b.length - a.length);
};

const stripNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    return markerIndex >= 0 ? text.slice(0, markerIndex).trimEnd() : text.trimEnd();
};

const extractNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    if (markerIndex < 0) return null;
    try {
        return JSON.parse(text.slice(markerIndex + NUTRITION_META_MARKER.length).trim());
    } catch {
        return null;
    }
};

const productShape = (doc) => doc ? {
    id: doc.$id || '',
    barcode: doc.barcode || doc.code || '',
    name: doc.name || doc.productName || 'Unknown Product',
    brand: doc.brand || '',
    source: doc.is_off_cache ? 'OpenFoodFacts' : 'PriceMate',
} : null;

const parseNutriments = (product) => {
    const nutriments = product?.nutriments || {};
    const sugarsPer100g = parseNumber(nutriments.sugars_100g ?? nutriments.sugars_value ?? nutriments.sugars ?? nutriments.sugarsPer100g);

    const sodiumValue = parseNumber(nutriments.sodium_100g ?? nutriments.sodium_value ?? nutriments.sodium ?? nutriments.sodiumMgPer100g);
    const sodiumUnit = String(nutriments.sodium_unit || '').toLowerCase();
    let sodiumMgPer100g = null;
    if (sodiumValue !== null) sodiumMgPer100g = sodiumUnit === 'mg' ? sodiumValue : sodiumValue * 1000;

    const saltValue = parseNumber(nutriments.salt_100g ?? nutriments.salt_value ?? nutriments.salt);
    const saltUnit = String(nutriments.salt_unit || '').toLowerCase();
    const saltGPer100g = saltValue === null ? null : (saltUnit === 'mg' ? saltValue / 1000 : saltValue);
    if (sodiumMgPer100g === null && saltGPer100g !== null) sodiumMgPer100g = (saltGPer100g / 2.5) * 1000;

    const caffeineValue = parseNumber(nutriments.caffeine_100g ?? nutriments.caffeine_value ?? nutriments.caffeine ?? nutriments.caffeineMgPer100g);
    const caffeineUnit = String(nutriments.caffeine_unit || '').toLowerCase();
    const caffeineMgPer100g = caffeineValue === null ? null : (caffeineUnit === 'g' ? caffeineValue * 1000 : caffeineValue);

    return {
        sugarsPer100g,
        sodiumMgPer100g,
        caffeineMgPerL: parseNumber(nutriments.caffeineMgPerL) ?? (caffeineMgPer100g !== null ? caffeineMgPer100g * 10 : null),
    };
};

const payloadFromCatalogProduct = (doc) => {
    if (!doc) return null;
    const hidden = extractNutritionMeta(doc.description);
    const ingredientsText = String(doc?.nutrition?.ingredientsText ?? hidden?.ingredientsText ?? doc.ingredientsText ?? '').trim();
    const nutriments = {
        sugarsPer100g: parseNumber(doc?.nutrition?.sugarsPer100g ?? hidden?.sugarsPer100g ?? doc.sugarsPer100g),
        sodiumMgPer100g: parseNumber(doc?.nutrition?.sodiumMgPer100g ?? hidden?.sodiumMgPer100g ?? doc.sodiumMgPer100g),
        caffeineMgPerL: parseNumber(doc?.nutrition?.caffeineMgPerL ?? hidden?.caffeineMgPerL ?? doc.caffeineMgPerL),
    };
    if (!ingredientsText && Object.values(nutriments).every((value) => value === null)) return null;
    return {
        barcode: doc.barcode || '',
        name: doc.name || doc.productName || 'Unknown Product',
        brand: doc.brand || '',
        ingredientsText,
        allergens: [],
        nutriments,
        source: 'PriceMate',
        asOf: doc.$updatedAt || doc.$createdAt || new Date().toISOString(),
    };
};

const payloadFromOffProduct = (product, fallbackBarcode = '') => {
    if (!product) return null;
    const barcode = product.code || product.barcode || fallbackBarcode || '';
    const name = product.product_name || product.name || product.productName || 'Unknown Product';
    const ingredientsText = String(product.ingredients_text || product.ingredients_text_en || product.ingredients_text_tr || '').trim();
    const rawAllergens = Array.isArray(product.allergens_tags) ? product.allergens_tags : (Array.isArray(product.allergens) ? product.allergens : []);
    const allergens = rawAllergens
        .map((tag) => String(tag || '').replace(/^[a-z]{2}:/, '').replace(/_/g, ' ').trim())
        .filter(Boolean);
    return {
        barcode,
        name,
        brand: product.brands || product.brand || '',
        ingredientsText,
        allergens,
        nutriments: parseNutriments(product),
        source: 'OpenFoodFacts',
        sourceUrl: barcode ? `${OFF_API_BASE}/product/${barcode}` : OFF_API_BASE,
        asOf: product.last_modified_t ? new Date(product.last_modified_t * 1000).toISOString() : new Date().toISOString(),
    };
};

const payloadFromOffCache = (doc) => {
    if (!doc) return null;
    let nutriments = {};
    try {
        nutriments = typeof doc.nutriments === 'string' ? JSON.parse(doc.nutriments || '{}') : (doc.nutriments || {});
    } catch {
        nutriments = {};
    }
    return payloadFromOffProduct({
        code: doc.barcode,
        product_name: doc.name,
        brands: doc.brand,
        ingredients_text: doc.ingredientsText,
        allergens_tags: Array.isArray(doc.allergens) ? doc.allergens : [],
        nutriments,
        last_modified_t: doc.sourceUpdatedAt ? Math.floor(Date.parse(doc.sourceUpdatedAt) / 1000) : null,
    }, doc.barcode);
};

const isFreshOffCache = (doc) => {
    const stamp = doc?.sourceUpdatedAt || doc?.$updatedAt || doc?.$createdAt || '';
    if (!stamp) return true;
    const ms = Date.parse(stamp);
    return !Number.isFinite(ms) || Date.now() - ms <= OFF_CACHE_TTL_MS;
};

const fetchOff = async (kind, value) => {
    const cacheKey = `off:${kind}:${normalizeText(value)}`;
    const cached = cacheGet(cacheKey);
    if (cached !== null) return cached;

    return withInflight(cacheKey, async () => {
        let url = '';
        if (kind === 'barcode') {
            url = `${OFF_API_BASE}/api/v0/product/${encodeURIComponent(value)}.json`;
        } else {
            url = `${OFF_API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(value)}&search_simple=1&action=process&json=1&page_size=5`;
        }

        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'PriceMate/1.0' } });
            if (!response.ok) {
                cacheSet(cacheKey, null, 60 * 1000);
                return null;
            }
            const data = await response.json();
            const product = kind === 'barcode'
                ? (data.status === 1 ? data.product : null)
                : (Array.isArray(data.products) ? data.products[0] : null);
            const payload = payloadFromOffProduct(product, kind === 'barcode' ? value : '');
            cacheSet(cacheKey, payload, 5 * 60 * 1000);
            return payload;
        } catch {
            return null;
        }
    });
};

const getSupermarket = (price) => {
    if (!price?.supermarkets) return null;
    return Array.isArray(price.supermarkets) ? price.supermarkets[0] : price.supermarkets;
};

const getRelationId = (field) => {
    if (!field) return '';
    if (Array.isArray(field)) return field[0] ? getRelationId(field[0]) : '';
    if (typeof field === 'string') return field;
    return field.$id || '';
};

const getTimestamp = (doc) => doc?.$updatedAt || doc?.updatedAt || doc?.$createdAt || doc?.createdAt || '';

const listDocuments = async (databases, databaseId, collection, queries) => {
    return databases.listDocuments(databaseId, collection, queries);
};

const findCatalogProduct = async (databases, databaseId, query, barcodeHint, nameHint) => {
    if (!databases) return null;
    const barcode = barcodeHint || barcodeFromQuery(query);
    if (barcode) {
        try {
            const res = await listDocuments(databases, databaseId, COLLECTIONS.PRODUCTS, [
                sdk.Query.equal('barcode', barcode),
                sdk.Query.limit(1),
            ]);
            if (res.documents?.[0]) return res.documents[0];
        } catch {
            // continue to name resolution
        }
    }

    const terms = wordsForSearch(nameHint || query);
    for (const term of terms.slice(0, 4)) {
        try {
            const res = await listDocuments(databases, databaseId, COLLECTIONS.PRODUCTS, [
                sdk.Query.search('name', term),
                sdk.Query.limit(8),
            ]);
            if (res.documents?.length) {
                return res.documents.find((doc) => normalizeText(doc.name).includes(term)) || res.documents[0];
            }
        } catch {
            break;
        }
    }

    try {
        const res = await listDocuments(databases, databaseId, COLLECTIONS.PRODUCTS, [
            sdk.Query.limit(500),
            sdk.Query.orderDesc('$createdAt'),
        ]);
        let best = null;
        let bestScore = 0;
        for (const doc of res.documents || []) {
            const name = normalizeText(doc.name || doc.productName);
            for (const term of terms) {
                if (term.length >= 3 && name.includes(term) && term.length > bestScore) {
                    best = doc;
                    bestScore = term.length;
                }
            }
        }
        return best;
    } catch {
        return null;
    }
};

const findOffCache = async (databases, databaseId, query, barcode) => {
    if (!databases) return null;
    if (barcode) {
        try {
            const res = await listDocuments(databases, databaseId, COLLECTIONS.OFF_CACHE, [
                sdk.Query.equal('barcode', barcode),
                sdk.Query.limit(1),
            ]);
            const doc = res.documents?.[0];
            if (doc && isFreshOffCache(doc)) return doc;
        } catch {
            // continue to name search
        }
    }

    for (const term of wordsForSearch(query).slice(0, 3)) {
        try {
            const res = await listDocuments(databases, databaseId, COLLECTIONS.OFF_CACHE, [
                sdk.Query.search('name', term),
                sdk.Query.limit(5),
            ]);
            const fresh = (res.documents || []).find(isFreshOffCache);
            if (fresh) return fresh;
        } catch {
            return null;
        }
    }
    return null;
};

const resolveIngredientPayload = async ({ databases, databaseId, query, barcodeHint, nameHint, log }) => {
    const catalog = await findCatalogProduct(databases, databaseId, query, barcodeHint, nameHint);
    const catalogPayload = payloadFromCatalogProduct(catalog);
    if (catalogPayload?.ingredientsText) {
        metric(log, 'ingredient_success', { source: 'catalog' });
        return { product: catalog || null, payload: catalogPayload, sourceHit: 'catalog' };
    }

    const barcode = barcodeHint || catalog?.barcode || barcodeFromQuery(query);
    const offCache = await findOffCache(databases, databaseId, query, barcode);
    const offCachePayload = payloadFromOffCache(offCache);
    if (offCachePayload?.ingredientsText || offCachePayload?.allergens?.length) {
        metric(log, 'off_cache_hit');
        metric(log, 'ingredient_success', { source: 'off_cache' });
        return { product: catalog || offCache || null, payload: offCachePayload, sourceHit: 'off_cache' };
    }

    const offBarcodePayload = barcode ? await fetchOff('barcode', barcode) : null;
    if (offBarcodePayload?.ingredientsText || offBarcodePayload?.allergens?.length) {
        metric(log, 'ingredient_success', { source: 'off_live_barcode' });
        return { product: catalog || null, payload: offBarcodePayload, sourceHit: 'off_live_barcode' };
    }

    const searchTerm = nameHint || catalog?.name || wordsForSearch(query).join(' ');
    const offSearchPayload = searchTerm ? await fetchOff('search', searchTerm) : null;
    if (offSearchPayload?.ingredientsText || offSearchPayload?.allergens?.length) {
        metric(log, 'ingredient_success', { source: 'off_live_search' });
        return { product: catalog || null, payload: offSearchPayload, sourceHit: 'off_live_search' };
    }

    metric(log, 'off_api_miss');
    metric(log, 'ingredient_unknown');
    return { product: catalog || null, payload: catalogPayload || offCachePayload || offBarcodePayload || offSearchPayload, sourceHit: 'miss' };
};

const normalizeAllergy = (value) => {
    const normalized = normalizeText(value);
    if (!normalized || NO_ALLERGY_VALUES.has(normalized)) return '';
    if (ALLERGEN_BY_LABEL.has(normalized)) return normalized;
    if (normalized === 'dairy') return 'milk';
    if (normalized === 'nut' || normalized === 'nuts') return 'tree nuts';
    for (const group of ALLERGEN_GROUPS) {
        if (group.terms.includes(normalized)) return group.label;
    }
    return normalized;
};

const termsForAllergies = (labels) => Array.from(new Set(labels.flatMap((label) => {
    const normalized = normalizeAllergy(label);
    const group = ALLERGEN_BY_LABEL.get(normalized);
    return group ? group.terms : [normalized];
}).filter(Boolean)));

const detectIngredientConditions = (query, allergyPrefs, userProfile = {}) => {
    const text = normalizeText(query);
    const has = (items) => items.some((item) => text.includes(item));
    const conditions = new Set();
    if (has(['sugar', 'seker', 'diabetes', 'diabetic', 'low sugar', 'high sugar'])) conditions.add('high_sugar');
    if (has(['sodium', 'salt', 'sodyum', 'tuz', 'hypertension'])) conditions.add('high_sodium');
    if (has(['caffeine', 'kafein', 'energy drink'])) conditions.add('high_caffeine');
    if (has(['gluten', 'celiac', 'coeliac', 'glutensiz'])) conditions.add('gluten');
    if (has(['lactose', 'laktoz', 'dairy free'])) conditions.add('lactose');
    if (has(['pregnant', 'pregnancy', 'hamile'])) conditions.add('pregnancy');

    const explicitAllergy = has(['allergy', 'allergic', 'alerji', 'alerjik', 'intolerant', 'avoid', 'cannot eat', "can't eat"]);
    const safetyIntent = explicitAllergy || has(['ingredient', 'ingredients', 'contains', 'safe', 'suitable', 'good for me', 'better for me', 'icerik', 'icindekiler', 'uygun', 'guvenli']);
    const prefAllergies = safetyIntent ? allergyPrefs.map(normalizeAllergy).filter(Boolean) : [];
    // Personal allergy verdicts must be driven by the saved profile. A product
    // containing milk is not automatically unsafe unless milk is in that profile.
    const allergenTargets = Array.from(new Set(prefAllergies));
    if (allergenTargets.length > 0) conditions.add('allergy');

    if (safetyIntent) {
        for (const priority of userProfile.nutritionPriorities || []) {
            if (priority === 'low sugar') conditions.add('high_sugar');
            if (priority === 'low sodium') conditions.add('high_sodium');
            if (priority === 'low caffeine') conditions.add('high_caffeine');
        }
    }

    if (safetyIntent && conditions.size === 0) {
        conditions.add('high_sugar');
        conditions.add('high_sodium');
        conditions.add('high_caffeine');
    }
    return { conditions: Array.from(conditions), allergenTargets };
};

const valueKnown = (value) => value !== null && value !== undefined;

const evaluateIngredient = (payload, query, allergyPrefs, userProfile = {}) => {
    const { conditions, allergenTargets } = detectIngredientConditions(query, allergyPrefs, userProfile);
    if (!payload) {
        return {
            status: 'unknown',
            checks: conditions,
            allergenTargets,
            reasons: ['Insufficient ingredient data.'],
            missingFields: ['ingredients', 'nutrition'],
        };
    }

    const ingredientsText = String(payload.ingredientsText || '').trim();
    const ingredientBlob = `${ingredientsText} ${(payload.allergens || []).join(' ')}`.toLowerCase();
    const nutriments = payload.nutriments || {};
    const reasons = [];
    const missingFields = [];
    let status = 'safe';
    const bump = (next) => {
        const rank = { safe: 0, caution: 1, unknown: 1, avoid: 2 };
        if (rank[next] > rank[status]) status = next;
    };

    if (!ingredientsText) missingFields.push('ingredients');

    const collectMatches = (terms) =>
        Array.from(new Set((terms || []).filter((term) => ingredientBlob.includes(String(term || '').toLowerCase()))));

    const avoidMatches = collectMatches(userProfile.avoidIngredients || []);
    if (avoidMatches.length > 0) {
        reasons.push(`Preference: avoid ingredient found (${avoidMatches.slice(0, 4).join(', ')}).`);
        bump('caution');
    }

    for (const dietary of userProfile.dietaryPreferences || []) {
        const matches = collectMatches(DIETARY_RESTRICTION_TERMS[dietary] || []);
        if (matches.length > 0) {
            reasons.push(`Preference (${dietary}): may not match (${matches.slice(0, 4).join(', ')}).`);
            bump('caution');
        }
    }

    if (conditions.includes('allergy') && allergenTargets.length > 0) {
        if (!ingredientsText && (!payload.allergens || payload.allergens.length === 0)) {
            reasons.push('Allergy check is incomplete because ingredient/allergen data is missing.');
            bump('unknown');
        } else {
            const allergyTerms = termsForAllergies(allergenTargets);
            const matches = collectMatches(allergyTerms);
            if (matches.length > 0) {
                reasons.push(`Allergy match found: ${Array.from(new Set(matches)).slice(0, 4).join(', ')}.`);
                bump('avoid');
            } else {
                reasons.push(`No listed match for: ${allergenTargets.join(', ')}.`);
            }
        }
    }

    const checkNutrient = (condition, label, value, unit, threshold) => {
        if (!conditions.includes(condition)) return;
        if (!valueKnown(value)) {
            missingFields.push(label.toLowerCase());
            reasons.push(`${label} data is unavailable.`);
            bump('unknown');
            return;
        }
        const high = value >= threshold;
        reasons.push(`${label}: ${high ? 'high' : 'within limit'} (${unit(value)}).`);
        if (high) bump('caution');
    };

    checkNutrient('high_sugar', 'Sugar', nutriments.sugarsPer100g, (v) => `${Number(v).toFixed(1)}g/100g`, SUGAR_THRESHOLD_G_PER_100G);
    checkNutrient('high_sodium', 'Sodium', nutriments.sodiumMgPer100g, (v) => `${Math.round(v)}mg/100g`, SODIUM_THRESHOLD_MG_PER_100G);
    checkNutrient('high_caffeine', 'Caffeine', nutriments.caffeineMgPerL, (v) => `${Math.round(v)}mg/L`, CAFFEINE_THRESHOLD_MG_PER_L);

    if (!ingredientsText && reasons.length === 0) {
        reasons.push('Insufficient ingredient data.');
        status = 'unknown';
    }

    return {
        status,
        checks: conditions.length ? conditions : ['ingredients'],
        allergenTargets,
        reasons: reasons.slice(0, 3),
        missingFields: Array.from(new Set(missingFields)),
    };
};

const runIngredientCheck = async (ctx, payload) => {
    const resolved = await resolveIngredientPayload(ctx);
    const product = productShape(resolved.product) || (resolved.payload ? {
        id: '',
        barcode: resolved.payload.barcode || '',
        name: resolved.payload.name || 'Unknown Product',
        brand: resolved.payload.brand || '',
        source: resolved.payload.source || 'OpenFoodFacts',
    } : null);
    const userProfile = normalizeUserProfile(payload.userProfile || {});
    const check = evaluateIngredient(resolved.payload, payload.query, payload.allergyPrefs || [], userProfile);
    return {
        mode: 'ingredient_safety',
        product,
        ingredientCheck: {
            status: check.status,
            checks: check.checks,
            allergenTargets: check.allergenTargets,
            reasons: check.reasons,
            ingredients: resolved.payload?.ingredientsText || '',
            allergens: resolved.payload?.allergens || [],
            nutriments: resolved.payload?.nutriments || {},
            missingFields: check.missingFields,
        },
        priceCheck: null,
        status: check.status,
        reasons: check.reasons,
        source: 'PriceMate',
        asOf: resolved.payload?.asOf || new Date().toISOString(),
        stale: false,
        errorCode: product ? '' : 'product_not_found',
    };
};

const fetchPricesForProduct = async (databases, databaseId, productId) => {
    const cacheKey = `prices:${productId}`;
    try {
        let docs = [];
        try {
            const res = await listDocuments(databases, databaseId, COLLECTIONS.PRICES, [
                sdk.Query.equal('products', productId),
                sdk.Query.orderDesc('$createdAt'),
                sdk.Query.limit(100),
                sdk.Query.select(['*', 'products.*', 'supermarkets.*']),
            ]);
            docs = res.documents || [];
        } catch {
            const res = await listDocuments(databases, databaseId, COLLECTIONS.PRICES, [
                sdk.Query.orderDesc('$createdAt'),
                sdk.Query.limit(500),
                sdk.Query.select(['*', 'products.*', 'supermarkets.*']),
            ]);
            docs = (res.documents || []).filter((price) => getRelationId(price.products) === productId || price.productID === productId);
        }
        cacheSet(cacheKey, docs);
        return { docs, stale: false };
    } catch (error) {
        const cached = cacheGet(cacheKey);
        if (cached) return { docs: cached, stale: true };
        throw error;
    }
};

const aggregatePrices = (prices, query, userProfile = {}) => {
    const preferredStoreKeys = new Set((userProfile.preferredStores || []).map(normalizeText));
    const byStore = new Map();
    for (const price of prices || []) {
        const supermarket = getSupermarket(price);
        const storeId = getRelationId(price.supermarkets) || price.supermarketId || price.supermarketName || 'unknown';
        const storeName = typeof supermarket === 'object' ? supermarket?.name || 'Store' : (price.supermarketName || 'Store');
        const timestamp = getTimestamp(price);
        const current = byStore.get(storeId);
        if (!current || new Date(timestamp).getTime() > new Date(current.timestamp || '').getTime()) {
            const isPreferredStore = preferredStoreKeys.has(normalizeText(storeId)) || preferredStoreKeys.has(normalizeText(storeName));
            byStore.set(storeId, {
                price: parseNumber(price.price),
                currency: normalizeCurrency(price.currency || 'TRY'),
                supermarketId: typeof supermarket === 'object' ? supermarket?.$id || '' : '',
                supermarketName: storeName,
                isPreferredStore,
                timestamp,
            });
        }
    }

    const type = normalizeText(query).includes('expensive') || normalizeText(query).includes('pahali') ? 'highest' : 'cheapest';
    const budgetPreference = userProfile.budgetPreference || 'balanced';
    const prefersStoresFirst = budgetPreference !== 'lowest_price' && preferredStoreKeys.size > 0;
    const sortByPrice = (a, b) => type === 'highest' ? b.price - a.price : a.price - b.price;
    const items = Array.from(byStore.values())
        .filter((item) => valueKnown(item.price))
        .sort((a, b) => {
            if (prefersStoresFirst && a.isPreferredStore !== b.isPreferredStore) {
                return a.isPreferredStore ? -1 : 1;
            }
            return sortByPrice(a, b);
        });
    const latestTimestamp = items.reduce((latest, item) => {
        const ts = new Date(item.timestamp || 0).getTime();
        return ts > latest ? ts : latest;
    }, 0);
    const highest = items.length ? [...items].sort((a, b) => b.price - a.price)[0] : null;
    return {
        type,
        currencyBase: 'TRY',
        budgetPreference,
        preferenceApplied: prefersStoresFirst,
        items: items.slice(0, 5),
        best: items[0] || null,
        highest,
        count: items.length,
        asOf: latestTimestamp ? new Date(latestTimestamp).toISOString() : '',
    };
};

const runPriceCheck = async ({ databases, databaseId, query, barcodeHint, nameHint, userProfile, log }) => {
    if (!databases) {
        return {
            mode: 'price_check',
            product: null,
            ingredientCheck: null,
            priceCheck: null,
            status: 'unknown',
            reasons: ['Price service is not configured.'],
            source: 'PriceMate',
            asOf: new Date().toISOString(),
            stale: false,
            errorCode: 'missing_appwrite_config',
        };
    }

    const product = await findCatalogProduct(databases, databaseId, query, barcodeHint, nameHint);
    if (!product) {
        return {
            mode: 'price_check',
            product: null,
            ingredientCheck: null,
            priceCheck: null,
            status: 'unknown',
            reasons: ['Product not found in PriceMate.'],
            source: 'PriceMate',
            asOf: new Date().toISOString(),
            stale: false,
            errorCode: 'product_not_found',
        };
    }

    try {
        const { docs, stale } = await fetchPricesForProduct(databases, databaseId, product.$id);
        const priceCheck = aggregatePrices(docs, query, normalizeUserProfile(userProfile || {}));
        if (priceCheck.count === 0) {
            metric(log, stale ? 'price_fallback_used' : 'price_live_success', { count: 0 });
            return {
                mode: 'price_check',
                product: productShape(product),
                ingredientCheck: null,
                priceCheck,
                status: 'unknown',
                reasons: ['Price temporarily unavailable.'],
                source: 'PriceMate',
                asOf: new Date().toISOString(),
                stale,
                errorCode: 'price_unavailable',
            };
        }
        metric(log, stale ? 'price_fallback_used' : 'price_live_success', { count: priceCheck.count });
        return {
            mode: 'price_check',
            product: productShape(product),
            ingredientCheck: null,
            priceCheck,
            status: 'ok',
            reasons: [],
            source: 'PriceMate',
            asOf: priceCheck.asOf || new Date().toISOString(),
            stale,
            errorCode: '',
        };
    } catch {
        metric(log, 'price_fallback_used', { failed: true });
        return {
            mode: 'price_check',
            product: productShape(product),
            ingredientCheck: null,
            priceCheck: null,
            status: 'unknown',
            reasons: ['Price temporarily unavailable.'],
            source: 'PriceMate',
            asOf: new Date().toISOString(),
            stale: false,
            errorCode: 'price_unavailable',
        };
    }
};

module.exports = async ({ req, res, log, error }) => {
    const correlationId = req.headers?.['x-correlation-id'] || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = parseBody(req);
    const query = String(payload.query || '').trim();
    const mode = classifyIntent(query);
    const { databases, databaseId, configError } = createDatabases();
    const base = {
        correlationId,
        mode,
        product: null,
        ingredientCheck: null,
        priceCheck: null,
        status: mode === 'generic' ? 'ok' : 'unknown',
        reasons: [],
        source: 'PriceMate',
        asOf: new Date().toISOString(),
        stale: false,
        errorCode: configError,
    };

    if (!query) {
        return json(res, { ...base, mode: 'generic', errorCode: 'empty_query' });
    }

    const key = `${mode}:${query}:${JSON.stringify(payload.allergyPrefs || [])}:${JSON.stringify(payload.userProfile || {})}:${payload.barcodeHint || ''}:${payload.nameHint || ''}`;
    return withInflight(key, async () => {
        try {
            const ctx = {
                databases,
                databaseId,
                query,
                barcodeHint: payload.barcodeHint || '',
                nameHint: payload.nameHint || '',
                userProfile: payload.userProfile || {},
                log,
            };

            if (mode === 'ingredient_safety') {
                const result = await runIngredientCheck(ctx, {
                    ...payload,
                    query,
                    allergyPrefs: Array.isArray(payload.allergyPrefs) ? payload.allergyPrefs : [],
                });
                return json(res, { ...base, ...result, correlationId, errorCode: result.errorCode || configError || '' });
            }

            if (mode === 'price_check') {
                const result = await runPriceCheck(ctx);
                return json(res, { ...base, ...result, correlationId, errorCode: result.errorCode || configError || '' });
            }

            return json(res, { ...base, mode: 'generic', errorCode: '' });
        } catch (err) {
            error(err);
            return json(res, {
                ...base,
                status: 'unknown',
                reasons: ['AI check temporarily unavailable.'],
                errorCode: 'ai_check_failed',
            }, 200);
        }
    });
};
