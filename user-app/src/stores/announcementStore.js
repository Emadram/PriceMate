import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (announcements change often)

const useAnnouncementStore = create((set, get) => ({
    announcements: [],
    loading: false,
    error: null,
    lastFetchedAt: 0,

    fetchActiveAnnouncements: async (limit = 5, { force = false } = {}) => {
        const now = Date.now();
        const { lastFetchedAt, announcements } = get();
        if (
            !force &&
            Array.isArray(announcements) &&
            announcements.length > 0 &&
            now - lastFetchedAt < CACHE_TTL_MS
        ) {
            return announcements.slice(0, limit);
        }
        set({ loading: true, error: null });
        try {
            const response = await db.announcements.list(
                [
                    Query.equal('active', true),
                    Query.limit(limit),
                    Query.orderDesc('$createdAt')
                ]
            );
            set({ announcements: response.documents, loading: false, lastFetchedAt: now });
            return response.documents;
        } catch (error) {
            console.error('Failed to fetch announcements:', error);
            set({ error: error.message, loading: false, announcements: [] });
            return [];
        }
    }
}));

export default useAnnouncementStore;