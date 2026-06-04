import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';
import * as productUtils from '../utils/productUtils';
import {
    enrichPricesWithSupermarketDocs,
    fetchPricesForProducts,
    fetchSupermarketsCatalog,
} from '../utils/productUtils';

const CACHE_STALENESS_LIMIT = 5 * 60 * 1000; // 5 minutes
const inflightProductRequests = new Map();

const normalizeBarcodeKey = (barcode) => String(barcode ?? '').trim();

const withInflightProduct = async (barcode, fetcher) => {
    const key = normalizeBarcodeKey(barcode);
    if (!key) return null;

    if (inflightProductRequests.has(key)) {
        return inflightProductRequests.get(key);
    }

    const promise = fetcher().finally(() => {
        inflightProductRequests.delete(key);
    });
    inflightProductRequests.set(key, promise);
    return promise;
};

const loadProductPayload = async (barcode) => {
    const key = normalizeBarcodeKey(barcode);
    if (!key) return null;

    const fetchByBarcode = async (value) => db.products.list(
        [
            Query.equal('barcode', value),
            Query.limit(1),
            Query.select(['*', 'categoryId.*'])
        ]
    );

    let response = await fetchByBarcode(key);

    if (response.documents.length === 0) {
        const numericBarcode = Number(key);
        if (!Number.isNaN(numericBarcode) && String(numericBarcode) === key) {
            response = await fetchByBarcode(numericBarcode);
        }
    }

    if (response.documents.length === 0) {
        response = await db.products.list(
            [
                Query.equal('$id', key),
                Query.limit(1),
                Query.select(['*', 'categoryId.*'])
            ]
        );
    }

    let product = null;
    let prices = [];

    if (response.documents.length === 0) {
        const cachedOff = await productUtils.fetchOffCacheByBarcode(key);
        if (cachedOff) {
            const normalizedCache = productUtils.normalizeOffCacheDoc(cachedOff);
            product = productUtils.normalizeProduct(normalizedCache);
        } else {
            const globalProduct = await productUtils.fetchGlobalProductWithRetries(key);
            if (!globalProduct) {
                return null;
            }
            product = productUtils.normalizeProduct(globalProduct);
            await productUtils.saveOffCacheFromProduct(globalProduct, key);
        }
    } else {
        product = response.documents[0];
        try {
            const [rawPrices, supermarkets] = await Promise.all([
                fetchPricesForProducts([product.$id]),
                fetchSupermarketsCatalog(),
            ]);
            prices = enrichPricesWithSupermarketDocs(rawPrices, supermarkets);
        } catch (priceError) {
            console.error('Price lookup failed:', priceError);
            prices = [];
        }
    }

    return { product, prices };
};

const cacheProductResult = (set, barcode, product, prices) => {
    const key = normalizeBarcodeKey(barcode);
    if (!key) return;

    set((state) => ({
        product,
        prices,
        loading: false,
        error: null,
        cache: {
            ...state.cache,
            products: {
                ...state.cache.products,
                [key]: { product, prices, timestamp: Date.now() }
            }
        }
    }));
};

const cacheOnlyProductResult = (set, barcode, product, prices) => {
    const key = normalizeBarcodeKey(barcode);
    if (!key) return;

    set((state) => ({
        cache: {
            ...state.cache,
            products: {
                ...state.cache.products,
                [key]: { product, prices, timestamp: Date.now() }
            }
        }
    }));
};

const useProductStore = create((set, get) => ({
    // State
    product: null,
    prices: [],
    searchResults: [],
    loading: false,
    error: null,
    cache: {
        products: {},
        search: {},
    },

    fetchProductByBarcode: async (barcode) => {
        const cacheKey = normalizeBarcodeKey(barcode);
        if (!cacheKey) {
            set({ loading: false, error: 'Product not found in local or global database', product: null, prices: [] });
            return null;
        }

        try {
            // Check cache
            const cached = get().cache.products[cacheKey];
            if (cached && (Date.now() - cached.timestamp < CACHE_STALENESS_LIMIT)) {
                set({ 
                    product: cached.product, 
                    prices: cached.prices,
                    loading: false,
                    error: null
                });
                return cached.product;
            }

            set((state) => ({
                loading: true,
                error: null,
                product: state.cache.products[cacheKey]?.product ?? null,
                prices: state.cache.products[cacheKey]?.prices ?? []
            }));

            const result = await withInflightProduct(cacheKey, () => loadProductPayload(cacheKey));
            if (!result || !result.product) {
                set({ loading: false, error: 'Product not found in local or global database', product: null, prices: [] });
                return null;
            }

            cacheProductResult(set, cacheKey, result.product, result.prices);

            return result.product;
        } catch (error) {
            set({ loading: false, error: error.message });
            return null;
        }
    },

    prefetchProductByBarcode: async (barcode) => {
        const cacheKey = normalizeBarcodeKey(barcode);
        if (!cacheKey) return null;

        const cached = get().cache.products[cacheKey];
        if (cached && (Date.now() - cached.timestamp < CACHE_STALENESS_LIMIT)) {
            return cached.product;
        }

        try {
            const result = await withInflightProduct(cacheKey, () => loadProductPayload(cacheKey));
            if (!result || !result.product) return null;
            cacheOnlyProductResult(set, cacheKey, result.product, result.prices);
            return result.product;
        } catch {
            return null;
        }
    },

    search: async (queryStr) => {
        set({ loading: true, error: null });
        const query = queryStr.trim().toLowerCase();

        try {
            // Quick Cache Check
            const cached = get().cache.search[query];
            if (cached && (Date.now() - cached.timestamp < CACHE_STALENESS_LIMIT)) {
                set({ searchResults: cached.results, loading: false });
                return cached.results;
            }

            const products = await productUtils.searchProducts(query);
            const productIds = products.map(p => p.$id);
            const prices = await productUtils.fetchPricesForProducts(productIds);

            const results = products.map(product => 
                productUtils.normalizeProduct(product, prices)
            );

            // Update state & cache
            set((state) => ({
                searchResults: results,
                loading: false,
                cache: {
                    ...state.cache,
                    search: {
                        ...state.cache.search,
                        [query]: { results, timestamp: Date.now() }
                    }
                }
            }));
            
            return results;
        } catch (error) {
            set({ loading: false, error: error.message, searchResults: [] });
            return [];
        }
    },

    clearSearch: () => set({ searchResults: [], error: null }),
}));

export default useProductStore;
