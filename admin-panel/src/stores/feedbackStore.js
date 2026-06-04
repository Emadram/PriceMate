import { create } from 'zustand';
import { db } from '../lib/appwrite';

const FEEDBACK_TTL_MS = 3 * 60 * 1000;

const useFeedbackStore = create((set, get) => ({
    feedback: [],
    loading: false,
    error: null,
    lastFetchedAt: null,

    fetchFeedback: async ({ force = false } = {}) => {
        const { lastFetchedAt, feedback, loading } = get();
        if (
            !force &&
            lastFetchedAt &&
            Date.now() - lastFetchedAt < FEEDBACK_TTL_MS &&
            feedback.length > 0
        ) {
            return;
        }
        if (loading && !force) return;

        set({ loading: true, error: null });
        try {
            const response = await db.feedback.list();
            set({
                feedback: response.documents,
                loading: false,
                lastFetchedAt: Date.now(),
            });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    deleteFeedback: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.feedback.delete(id);
            set((state) => ({
                feedback: state.feedback.filter((row) => row.$id !== id),
                loading: false,
                lastFetchedAt: Date.now(),
            }));
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateFeedbackStatus: async (id, status) => {
        set({ loading: true, error: null });
        try {
            const updated = await db.feedback.update(id, { status });
            set((state) => ({
                feedback: state.feedback.map((row) =>
                    row.$id === id ? { ...row, ...updated, status } : row
                ),
                loading: false,
                lastFetchedAt: Date.now(),
            }));
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useFeedbackStore;
