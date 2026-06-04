import { create } from 'zustand';
import { fetchSupermarketsCatalog } from '../utils/productUtils';

const CACHE_TTL_MS = 30 * 60 * 1000;
const CATALOG_LIMIT = 100;

const useSupermarketsStore = create((set, get) => ({
    supermarkets: [],
    loading: false,
    error: null,
    lastFetchedAt: 0,

    fetchSupermarkets: async ({ force = false } = {}) => {
        const now = Date.now();
        const { lastFetchedAt, supermarkets, loading } = get();
        if (
            !force &&
            Array.isArray(supermarkets) &&
            supermarkets.length > 0 &&
            now - lastFetchedAt < CACHE_TTL_MS
        ) {
            return supermarkets;
        }
        if (loading && !force) return supermarkets;

        set({ loading: true, error: null });
        try {
            const documents = await fetchSupermarketsCatalog(CATALOG_LIMIT);
            set({
                supermarkets: documents,
                loading: false,
                lastFetchedAt: Date.now(),
            });
            return documents;
        } catch (error) {
            set({ error: error.message, loading: false });
            return [];
        }
    },
}));

export default useSupermarketsStore;
