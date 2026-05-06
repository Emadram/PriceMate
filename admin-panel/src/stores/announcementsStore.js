import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';

const useAnnouncementsStore = create((set) => ({
    announcements: [],
    loading: false,
    error: null,

    fetchAnnouncements: async () => {
        set({ loading: true, error: null });
        try {
            const response = await db.announcements.list([
                Query.orderDesc('$createdAt')
            ]);
            set({ announcements: response.documents, loading: false });
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
                createdAt: new Date().toISOString()
            });
            
            // Success optimization: Add to state instantly before re-fetching
            set(state => ({
                announcements: [newDoc, ...state.announcements],
                loading: false 
            }));

            // Sync with backend to ensure data integrity
            await useAnnouncementsStore.getState().fetchAnnouncements();
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateAnnouncement: async (id, data) => {
        set({ loading: true, error: null });
        try {
            await db.announcements.update(id, {
                text: data.text,
                category: data.category,
                active: data.active
            });
            await useAnnouncementsStore.getState().fetchAnnouncements();
            set({ loading: false });
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
            await useAnnouncementsStore.getState().fetchAnnouncements();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useAnnouncementsStore;
