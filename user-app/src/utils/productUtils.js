import { db, Query, COLLECTIONS } from '../lib/appwrite';

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

/**
 * Fetch product details from OpenFoodFacts API (Global Fallback)
 * @param {string} barcode
 * @returns {Promise<Object|null>}
 */
export const fetchGlobalProduct = async (barcode) => {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`);
        const data = await response.json();

        if (data.status === 1) {
            return {
                ...data.product,
                is_global: true,
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching global product:', error);
        return null;
    }
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
    for (const variant of collectBarcodeVariants(barcode)) {
        const product = await fetchGlobalProduct(variant);
        if (product) return product;
    }
    return null;
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

export const fetchIngredientsByBarcode = async (barcode) => {
    if (!barcode) return null;
    const product = await fetchGlobalProductWithRetries(barcode);
    if (!product) return null;
    return normalizeIngredientsPayload(product, barcode);
};

/**
 * Build ingredient-check payload from optional Appwrite product fields (sugarsPer100g, ingredientsText, nutritionSource).
 * Returns null if no nutrition fields are set on the document.
 */
export const ingredientPayloadFromAppwriteProduct = (doc) => {
    if (!doc) return null;

    const parseNumber = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
        return Number.isFinite(num) ? num : null;
    };

    const sugarsPer100g = parseNumber(doc.sugarsPer100g);
    const sodiumMgPer100g = parseNumber(doc.sodiumMgPer100g);
    const ingredientsText = String(doc.ingredientsText || '').trim();

    const hasData =
        sugarsPer100g !== null || sodiumMgPer100g !== null || ingredientsText.length > 0;
    if (!hasData) return null;

    return {
        barcode: doc.barcode || '',
        name: doc.name || doc.productName || 'Unknown Product',
        brand: doc.brand || '',
        ingredientsText,
        ingredientsList: ingredientsText
            ? ingredientsText.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)
            : [],
        allergens: [],
        nutriments: {
            sugarsPer100g,
            sodiumMgPer100g,
            caffeineMgPerL: null,
            caffeineMgPer100g: null,
            saltGPer100g: null,
        },
        source: 'PriceMate',
        sourceUrl: '',
        nutritionSourceLabel: String(doc.nutritionSource || '').trim(),
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

    const lowered = trimmed.toLowerCase().replace(/\b\d{8,14}\b/g, ' ');
    const terms = lowered
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !CATALOG_RESOLVE_STOPWORDS.has(w))
        .sort((a, b) => b.length - a.length);

    for (const term of terms) {
        if (term.length < 2) continue;
        try {
            // No Query.select: Appwrite rejects the request if any selected attribute is missing from the schema.
            const res = await db.products.list([Query.search('name', term), Query.limit(8)]);
            if (res.documents.length > 0) {
                const nameLower = (d) => (d.name || '').toLowerCase();
                const best =
                    res.documents.find((d) => nameLower(d).includes(term)) || res.documents[0];
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
        let best = null;
        let bestScore = 0;
        for (const d of res.documents) {
            const n = (d.name || '').toLowerCase();
            for (const term of terms) {
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
    if (!name) return null;
    try {
        const response = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5`
        );
        const data = await response.json();
        const products = Array.isArray(data?.products) ? data.products : [];
        if (products.length === 0) return null;

        const normalizedQuery = name.toLowerCase();
        const bestMatch = products.find((p) => (p.product_name || '').toLowerCase().includes(normalizedQuery)) || products[0];
        return normalizeIngredientsPayload(bestMatch);
    } catch (error) {
        console.error('Error searching OpenFoodFacts by name:', error);
        return null;
    }
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
            Query.select(['*', 'products.*', 'supermarkets.*', 'products.categoryId.*'])
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
    return prices.filter(price => {
        const priceProductId = getRelationshipId(price.products);
        return priceProductId === productId;
    });
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

/**
 * Standardize product data format
 */
export const normalizeProduct = (product, prices = []) => {
    if (!product) return null;

    const productId = product.$id || product.code; // code is used by OFF
    const productPrices = Array.isArray(prices) 
        ? prices.filter(p => getRelationshipId(p.products) === productId)
        : [];

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
    try {
        const historyColl = COLLECTIONS.PRICE_HISTORY || 'price_history';
        const historyDocs = [];
        const historyIds = new Set();

        const buildHistoryQueries = (productField, branchField) => {
            const queries = [
                Query.equal(productField, productId),
                Query.orderAsc('timestamp'),
                Query.limit(200)
            ];

            if (branchId) {
                queries.push(Query.equal(branchField, branchId));
            }

            return queries;
        };

        const fetchHistoryByField = async (productField, branchField) => {
            try {
                const response = await db.priceHistory.list(
                    buildHistoryQueries(productField, branchField)
                );

                response.documents.forEach((doc) => {
                    if (!historyIds.has(doc.$id)) {
                        historyIds.add(doc.$id);
                        historyDocs.push(doc);
                    }
                });
            } catch (innerError) {
                if (innerError.code === 404) {
                    console.warn(`Price history collection "${historyColl}" not found in Appwrite. Please ensure it is created.`);
                } else {
                    console.warn('Price history query failed:', innerError.message);
                }
            }
        };

        await fetchHistoryByField('productId', 'supermarketId');
        await fetchHistoryByField('products', 'supermarkets');

        const priceDocs = [];
        const priceQueries = (productField, branchField) => {
            const queries = [
                Query.equal(productField, productId),
                Query.limit(200),
                Query.select(['*', 'supermarkets.*'])
            ];

            if (branchId) {
                queries.push(Query.equal(branchField, branchId));
            }

            return queries;
        };

        const fetchPriceStack = async (productField, branchField) => {
            try {
                const response = await db.prices.list(
                    priceQueries(productField, branchField)
                );
                priceDocs.push(...response.documents);
            } catch (innerError) {
                console.warn('Price stack query failed:', innerError.message);
            }
        };

        await fetchPriceStack('products', 'supermarkets');
        await fetchPriceStack('productId', 'supermarketId');

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

    return withInflight(cacheKey, async () => {
        // Appwrite Query.equal supports arrays, but large arrays should be chunked
        const CHUNK_SIZE = 25;
        const allPrices = [];

        try {
            for (let i = 0; i < normalizedIds.length; i += CHUNK_SIZE) {
                const chunk = normalizedIds.slice(i, i + CHUNK_SIZE);
                const response = await db.prices.list([
                    Query.equal('products', chunk),
                    Query.limit(100),
                    Query.select(['*', 'supermarkets.*'])
                ]);
                allPrices.push(...response.documents);
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
            Query.select(['*', 'categoryId.*'])
        ]);

        if (response.documents.length > 0) {
            return response.documents[0];
        }

        const fallback = await db.products.list([
            Query.equal('$id', barcode),
            Query.limit(1),
            Query.select(['*', 'categoryId.*'])
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
