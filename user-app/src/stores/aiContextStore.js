import { create } from 'zustand';
import {
    enrichProductPricesWithSupermarkets,
    fetchPricesForProducts,
    fetchProducts,
    normalizeProduct,
} from '../utils/productUtils';
import { AI_CONTEXT_TTL_MS } from '../utils/cacheTtls';
import useSupermarketsStore from './supermarketsStore';

let inflightPromise = null;

const useAiContextStore = create((set, get) => ({
    products: [],
    supermarkets: [],
    loadedAt: 0,
    loading: false,

    loadContext: async ({ force = false } = {}) => {
        const { products, loadedAt, loading } = get();
        const now = Date.now();

        if (
            !force &&
            Array.isArray(products) &&
            products.length > 0 &&
            loadedAt &&
            now - loadedAt < AI_CONTEXT_TTL_MS
        ) {
            return { products, supermarkets: get().supermarkets };
        }

        if (loading && inflightPromise && !force) {
            return inflightPromise;
        }

        set({ loading: true });

        const run = (async () => {
            try {
                const rawProducts = await fetchProducts(50);
                const productIds = rawProducts.map((p) => p.$id).filter(Boolean);
                const [prices, supermarkets] = await Promise.all([
                    fetchPricesForProducts(productIds),
                    useSupermarketsStore.getState().fetchSupermarkets(),
                ]);

                const productsWithData = rawProducts.map((p) => normalizeProduct(p, prices));
                const enrichedProducts = enrichProductPricesWithSupermarkets(
                    productsWithData,
                    Array.isArray(supermarkets) ? supermarkets : []
                );

                const supermarketList = Array.isArray(supermarkets) ? supermarkets : [];
                set({
                    products: enrichedProducts,
                    supermarkets: supermarketList,
                    loadedAt: Date.now(),
                    loading: false,
                });

                return { products: enrichedProducts, supermarkets: supermarketList };
            } catch (error) {
                set({ loading: false });
                throw error;
            } finally {
                inflightPromise = null;
            }
        })();

        inflightPromise = run;
        return run;
    },

    clearContext: () => set({ products: [], supermarkets: [], loadedAt: 0, loading: false }),
}));

export default useAiContextStore;
