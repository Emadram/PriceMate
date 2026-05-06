import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';

const useAnnouncementStore = create((set) => ({
    announcements: [],
    loading: false,
    error: null,

    fetchActiveAnnouncements: async (limit = 5) => {
        set({ loading: true, error: null });
        try {
            const response = await db.announcements.list(
                [
                    Query.equal('active', true),
                    Query.limit(limit),
                    Query.orderDesc('$createdAt')
                ]
            );
            set({ announcements: response.documents, loading: false });
            return response.documents;
        } catch (error) {
            console.error('Failed to fetch announcements:', error);
            set({ error: error.message, loading: false, announcements: [] });
            return [];
        }
    }
}));

export default useAnnouncementStore;