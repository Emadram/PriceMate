import { create } from 'zustand';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';

const useFeedbackStore = create((set) => ({
    feedback: [],
    loading: false,
    error: null,

    fetchFeedback: async () => {
        set({ loading: true, error: null });
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.FEEDBACK
            );
            set({ feedback: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    deleteFeedback: async (id) => {
        set({ loading: true, error: null });
        try {
            await databases.deleteDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.FEEDBACK,
                id
            );
            await useFeedbackStore.getState().fetchFeedback();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useFeedbackStore;
