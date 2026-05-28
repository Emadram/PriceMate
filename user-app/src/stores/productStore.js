import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';
import * as productUtils from '../utils/productUtils';

const CACHE_STALENESS_LIMIT = 5 * 60 * 1000; // 5 minutes

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
        set({ loading: true, error: null, product: null, prices: [] });
        
        try {
            // Check cache
            const cached = get().cache.products[barcode];
            if (cached && (Date.now() - cached.timestamp < CACHE_STALENESS_LIMIT)) {
                set({ 
                    product: cached.product, 
                    prices: cached.prices,
                    loading: false 
                });
                return cached.product;
            }

            const fetchByBarcode = async (value) => db.products.list(
                [
                    Query.equal('barcode', value),
                    Query.limit(1),
                    Query.select(['*', 'categoryId.*'])
                ]
            );

            let response = await fetchByBarcode(barcode);

            if (response.documents.length === 0) {
                const numericBarcode = Number(barcode);
                if (!Number.isNaN(numericBarcode) && String(numericBarcode) === String(barcode)) {
                    response = await fetchByBarcode(numericBarcode);
                }
            }

            if (response.documents.length === 0) {
                response = await db.products.list(
                    [
                        Query.equal('$id', barcode),
                        Query.limit(1),
                        Query.select(['*', 'categoryId.*'])
                    ]
                );
            }

            let product = null;
            let prices = [];

            if (response.documents.length === 0) {
                const cachedOff = await productUtils.fetchOffCacheByBarcode(barcode);
                if (cachedOff) {
                    const normalizedCache = productUtils.normalizeOffCacheDoc(cachedOff);
                    product = productUtils.normalizeProduct(normalizedCache);
                } else {
                    // Fallback to Global OpenFoodFacts API
                    const globalProduct = await productUtils.fetchGlobalProductWithRetries(barcode);
                    if (!globalProduct) {
                        set({ loading: false, error: 'Product not found in local or global database' });
                        return null;
                    }
                    product = productUtils.normalizeProduct(globalProduct);
                    await productUtils.saveOffCacheFromProduct(globalProduct, barcode);
                }
            } else {
                product = response.documents[0];
                const fetchPrices = async (attribute) => db.prices.list(
                    [
                        Query.equal(attribute, product.$id),
                        Query.orderAsc('price'),
                        Query.select(['*', 'supermarkets.*', 'products.*'])
                    ]
                );

                try {
                    const pricesRes = await fetchPrices('products');
                    prices = pricesRes.documents;
                } catch (priceError) {
                    const message = priceError?.message || '';
                    const isNetworkError = message.includes('NetworkError') || message.includes('Failed to fetch');
                    if (isNetworkError) {
                        console.warn('Prices temporarily unavailable due to network error.');
                    } else {
                        console.error('Price lookup failed:', priceError);
                    }
                    prices = [];
                }
            }

            // Cache it
            set((state) => ({
                product,
                prices,
                loading: false,
                cache: {
                    ...state.cache,
                    products: {
                        ...state.cache.products,
                        [barcode]: { product, prices, timestamp: Date.now() }
                    }
                }
            }));

            return product;
        } catch (error) {
            set({ loading: false, error: error.message });
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
