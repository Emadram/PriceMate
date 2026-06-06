import { create } from 'zustand';
import { fetchSupermarketsCatalog } from '../utils/productUtils';

const CACHE_TTL_MS = 30 * 60 * 1000;
const CATALOG_LIMIT = 100;

const useSupermarketsStore = create((set, get) => ({
    supermarkets: [],
    loading: false,
    error: null,
    lastFetchedAt: 0,
    hasFetched: false,

    fetchSupermarkets: async ({ force = false } = {}) => {
        const now = Date.now();
        const { lastFetchedAt, supermarkets, loading, hasFetched } = get();
        if (
            !force &&
            hasFetched &&
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
                hasFetched: true,
            });
            return documents;
        } catch (error) {
            set({ error: error.message, loading: false });
            return [];
        }
    },
}));

export default useSupermarketsStore;
