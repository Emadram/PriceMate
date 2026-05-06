import { create } from 'zustand';
import { db } from '../lib/appwrite';

const useSupermarketsStore = create((set) => ({
    supermarkets: [],
    loading: false,
    error: null,

    fetchSupermarkets: async () => {
        set({ loading: true, error: null });
        try {
            const response = await db.supermarkets.list();
            set({ supermarkets: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    }
}));

export default useSupermarketsStore;