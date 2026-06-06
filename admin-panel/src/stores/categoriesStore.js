import { create } from 'zustand';
import { db } from '../lib/appwrite';
import { invalidateCacheKey, getCacheEntry, setCacheEntry, isFresh } from '../utils/readCache';

const REFERENCE_TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = 'admin:categories:v1';

const useCategoriesStore = create((set, get) => ({
    categories: [],
    loading: false,
    error: null,
    lastFetchedAt: null,
    hasFetched: false,

    fetchCategories: async ({ force = false } = {}) => {
        const { lastFetchedAt, hasFetched, loading } = get();
        if (
            !force &&
            hasFetched &&
            lastFetchedAt &&
            Date.now() - lastFetchedAt < REFERENCE_TTL_MS
        ) {
            return;
        }

        const cached = !force ? getCacheEntry(CACHE_KEY) : null;
        if (cached && isFresh(cached, REFERENCE_TTL_MS)) {
            set({
                categories: cached.data,
                loading: false,
                lastFetchedAt: cached.updatedAt,
                hasFetched: true,
            });
            return;
        }

        if (loading && !force) return;

        set({ loading: true, error: null });
        try {
            const response = await db.categories.list();
            setCacheEntry(CACHE_KEY, response.documents);
            set({
                categories: response.documents,
                loading: false,
                lastFetchedAt: Date.now(),
                hasFetched: true,
            });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    fetchIfStale: async (force = false) => get().fetchCategories({ force }),

    invalidate: () => {
        invalidateCacheKey(CACHE_KEY);
        set({ lastFetchedAt: null, hasFetched: false });
    },

    addCategory: async (data) => {
        set({ loading: true, error: null });
        console.log('Adding category to Appwrite:', data);
        try {
            const payload = {
                categoryName: data.categoryName
            };

            // Only add icon if it exists in the schema
            if (data.icon) {
                payload.icon = data.icon;
            }

            console.log('Payload being sent:', payload);

            const result = await db.categories.create(payload);
            console.log('Category created successfully:', result);
            useCategoriesStore.getState().invalidate();
            await useCategoriesStore.getState().fetchCategories({ force: true });
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add category error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                type: error.type
            });
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateCategory: async (id, data) => {
        set({ loading: true, error: null });
        try {
            await db.categories.update(id, {
                categoryName: data.categoryName,
                icon: data.icon || null
            });
            useCategoriesStore.getState().invalidate();
            await useCategoriesStore.getState().fetchCategories({ force: true });
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteCategory: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.categories.delete(id);
            useCategoriesStore.getState().invalidate();
            await useCategoriesStore.getState().fetchCategories({ force: true });
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useCategoriesStore;
