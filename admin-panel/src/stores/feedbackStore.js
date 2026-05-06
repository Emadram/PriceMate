import { create } from 'zustand';
import { db } from '../lib/appwrite';

const useFeedbackStore = create((set) => ({
    feedback: [],
    loading: false,
    error: null,

    fetchFeedback: async () => {
        set({ loading: true, error: null });
        try {
            const response = await db.feedback.list();
            set({ feedback: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    deleteFeedback: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.feedback.delete(id);
            await useFeedbackStore.getState().fetchFeedback();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateFeedbackStatus: async (id, status) => {
        set({ loading: true, error: null });
        try {
            await db.feedback.update(id, { status });
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
