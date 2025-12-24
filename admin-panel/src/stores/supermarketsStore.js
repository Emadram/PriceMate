import { create } from 'zustand';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { ID } from 'appwrite';

const useSupermarketsStore = create((set) => ({
    supermarkets: [],
    loading: false,
    error: null,

    fetchSupermarkets: async () => {
        set({ loading: true, error: null });
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.SUPERMARKETS
            );
            set({ supermarkets: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    addSupermarket: async (data) => {
        set({ loading: true, error: null });
        try {
            await databases.createDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.SUPERMARKETS,
                ID.unique(),
                {
                    name: data.name,
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    address: data.address || null,
                    phoneNumber: data.phoneNumber || null,
                    email: data.email || null,
                    icon: data.icon || null
                }
            );
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add supermarket error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateSupermarket: async (id, data) => {
        set({ loading: true, error: null });
        try {
            await databases.updateDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.SUPERMARKETS,
                id,
                {
                    name: data.name,
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    address: data.address || null,
                    phoneNumber: data.phoneNumber || null,
                    email: data.email || null,
                    icon: data.icon || null
                }
            );
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Update supermarket error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteSupermarket: async (id) => {
        set({ loading: true, error: null });
        try {
            await databases.deleteDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.SUPERMARKETS,
                id
            );
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useSupermarketsStore;
