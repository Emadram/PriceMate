import { create } from 'zustand';
import { db } from '../lib/appwrite';
import { Query } from 'appwrite';

const usePricesStore = create((set, get) => ({
    prices: [],
    loading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 10,

    setPage: (page) => set({ page }),

    fetchPrices: async (page = 1) => {
        set({ loading: true, error: null });
        try {
            const limit = get().limit;
            const offset = (page - 1) * limit;

            const response = await db.prices.list([
                Query.limit(limit),
                Query.offset(offset),
                Query.orderDesc('$updatedAt'),
                Query.select(['*', 'products.name', 'products.$id', 'supermarkets.name', 'supermarkets.$id'])
            ]);
            set({ 
                prices: response.documents, 
                total: response.total,
                page: page,
                loading: false 
            });
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
                userId: data.userId,
                stockStatus: data.stockStatus || 'in_stock'
            };

            // Add optional fields
            if (data.currency) {
                payload.currency = data.currency;
            }

            // Relationship references (ensure they are strings)
            if (data.products) {
                payload.products = typeof data.products === 'object' ? data.products.$id : data.products;
            }

            if (data.supermarkets) {
                payload.supermarkets = typeof data.supermarkets === 'object' ? data.supermarkets.$id : data.supermarkets;
            }

            console.log('Price payload:', payload);

            const result = await db.prices.create(payload);

            // LOG TO PRICE HISTORY
            try {
                await db.priceHistory.create({
                    price: parseFloat(data.price),
                    productId: payload.products,
                    supermarketId: payload.supermarkets,
                    timestamp: new Date().toISOString()
                });
            } catch (historyErr) {
                console.warn('Could not log history (collection might not exist):', historyErr);
            }

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

    updatePrice: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const payload = {
                price: parseFloat(data.price),
                userId: data.userId,
                stockStatus: data.stockStatus || 'in_stock'
            };

            if (data.currency) {
                payload.currency = data.currency;
            }
            if (data.products) {
                payload.products = typeof data.products === 'object' ? data.products.$id : data.products;
            }
            if (data.supermarkets) {
                payload.supermarkets = typeof data.supermarkets === 'object' ? data.supermarkets.$id : data.supermarkets;
            }

            await db.prices.update(id, payload);

            // LOG TO PRICE HISTORY
            try {
                await db.priceHistory.create({
                    price: parseFloat(data.price),
                    productId: payload.products,
                    supermarketId: payload.supermarkets,
                    timestamp: new Date().toISOString()
                });
            } catch (historyErr) {
                console.warn('Could not log history:', historyErr);
            }

            await usePricesStore.getState().fetchPrices();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Update price error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deletePrice: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.prices.delete(id);
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
