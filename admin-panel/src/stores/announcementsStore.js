import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';

const ANNOUNCEMENTS_TTL_MS = 3 * 60 * 1000;

const useAnnouncementsStore = create((set, get) => ({
    announcements: [],
    loading: false,
    error: null,
    lastFetchedAt: null,

    fetchAnnouncements: async ({ force = false } = {}) => {
        const { lastFetchedAt, announcements, loading } = get();
        if (
            !force &&
            lastFetchedAt &&
            Date.now() - lastFetchedAt < ANNOUNCEMENTS_TTL_MS &&
            announcements.length > 0
        ) {
            return;
        }
        if (loading && !force) return;

        set({ loading: true, error: null });
        try {
            const response = await db.announcements.list([
                Query.orderDesc('$createdAt'),
            ]);
            set({
                announcements: response.documents,
                loading: false,
                lastFetchedAt: Date.now(),
            });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    addAnnouncement: async (data) => {
        set({ loading: true, error: null });
        try {
            const newDoc = await db.announcements.create({
                text: data.text,
                category: data.category || 'general',
                active: data.active ?? true,
                createdAt: new Date().toISOString(),
            });

            set((state) => ({
                announcements: [newDoc, ...state.announcements],
                loading: false,
                lastFetchedAt: Date.now(),
            }));
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateAnnouncement: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const updated = await db.announcements.update(id, {
                text: data.text,
                category: data.category,
                active: data.active,
            });
            set((state) => ({
                announcements: state.announcements.map((row) =>
                    row.$id === id ? { ...row, ...updated } : row
                ),
                loading: false,
                lastFetchedAt: Date.now(),
            }));
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteAnnouncement: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.announcements.delete(id);
            set((state) => ({
                announcements: state.announcements.filter((row) => row.$id !== id),
                loading: false,
                lastFetchedAt: Date.now(),
            }));
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },
}));

export default useAnnouncementsStore;
