import { create } from 'zustand';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { ID, Query } from 'appwrite';

const usePricesStore = create((set) => ({
    prices: [],
    loading: false,
    error: null,

    fetchPrices: async () => {
        set({ loading: true, error: null });
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRICES,
                [
                    Query.limit(100),
                    Query.select(['*', 'products.name', 'products.$id', 'supermarkets.name', 'supermarkets.$id'])
                ]
            );
            set({ prices: response.documents, loading: false });
        } catch (error) {
            console.error('Fetch prices error:', error);
            set({ error: error.message, loading: false });
        }
    },

    addPrice: async (data) => {
        set({ loading: true, error: null });
        console.log('Adding price:', data);
        try {
            const payload = {
                price: parseFloat(data.price),
                userId: data.userId
            };

            // Add optional fields
            if (data.currency) {
                payload.currency = data.currency;
            }

            // Add relationships
            if (data.products) {
                payload.products = data.products;
            }

            if (data.supermarkets) {
                payload.supermarkets = data.supermarkets;
            }

            console.log('Price payload:', payload);

            const result = await databases.createDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRICES,
                ID.unique(),
                payload
            );
            console.log('Price created:', result);
            await usePricesStore.getState().fetchPrices();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add price error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                type: error.type
            });
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deletePrice: async (id) => {
        set({ loading: true, error: null });
        try {
            await databases.deleteDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRICES,
                id
            );
            await usePricesStore.getState().fetchPrices();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default usePricesStore;
