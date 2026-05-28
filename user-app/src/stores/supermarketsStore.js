import { create } from 'zustand';
import { db } from '../lib/appwrite';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const useSupermarketsStore = create((set, get) => ({
    supermarkets: [],
    loading: false,
    error: null,
    lastFetchedAt: 0,

    fetchSupermarkets: async () => {
        const now = Date.now();
        const { lastFetchedAt, supermarkets } = get();
        if (Array.isArray(supermarkets) && supermarkets.length > 0 && now - lastFetchedAt < CACHE_TTL_MS) {
            return supermarkets;
        }
        set({ loading: true, error: null });
        try {
            const response = await db.supermarkets.list();
            set({ supermarkets: response.documents, loading: false, lastFetchedAt: now });
            return response.documents;
        } catch (error) {
            set({ error: error.message, loading: false });
            return [];
        }
    }
}));

export default useSupermarketsStore;