import { create } from 'zustand';
import { db } from '../lib/appwrite';
import { Query } from 'appwrite';

const usePriceHistoryStore = create((set) => ({
    history: [],
    loading: false,
    error: null,

    fetchHistory: async () => {
        set({ loading: true, error: null });
        try {
            const response = await db.priceHistory.list([
                Query.orderDesc('timestamp'),
                Query.limit(200)
            ]);
            set({ history: response.documents, loading: false });
        } catch (error) {
            console.error('Fetch price history error:', error);
            set({ error: error.message, loading: false });
        }
    },

    addHistory: async (data) => {
        set({ loading: true, error: null });
        try {
            await db.priceHistory.create({
                priceId: data.priceId || null,
                price: parseFloat(data.price),
                productId: data.productId,
                supermarketId: data.supermarketId,
                timestamp: data.timestamp,
                isPromotional: data.isPromotional || false,
                priceChangeReason: data.priceChangeReason || null
            });
            await usePriceHistoryStore.getState().fetchHistory();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add price history error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateHistory: async (id, data) => {
        set({ loading: true, error: null });
        try {
            await db.priceHistory.update(id, {
                priceId: data.priceId || null,
                price: parseFloat(data.price),
                productId: data.productId,
                supermarketId: data.supermarketId,
                timestamp: data.timestamp,
                isPromotional: data.isPromotional || false,
                priceChangeReason: data.priceChangeReason || null
            });
            await usePriceHistoryStore.getState().fetchHistory();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Update price history error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteHistory: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.priceHistory.delete(id);
            await usePriceHistoryStore.getState().fetchHistory();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Delete price history error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    syncFromPrices: async (limit = 200) => {
        set({ loading: true, error: null });
        try {
            const historyResponse = await db.priceHistory.list([
                Query.limit(limit),
                Query.select(['$id', 'priceId'])
            ]);

            const existingPriceIds = new Set(
                historyResponse.documents
                    .map((doc) => doc.priceId)
                    .filter((value) => value)
            );

            const pricesResponse = await db.prices.list([
                Query.limit(limit),
                Query.orderDesc('$updatedAt'),
                Query.select(['*', 'products.$id', 'supermarkets.$id'])
            ]);

            let createdCount = 0;

            for (const price of pricesResponse.documents) {
                if (price.$id && existingPriceIds.has(price.$id)) {
                    continue;
                }

                const productId = typeof price.products === 'object' ? price.products.$id : price.products || price.productId;
                const supermarketId = typeof price.supermarkets === 'object' ? price.supermarkets.$id : price.supermarkets || price.supermarketId;

                if (!productId || !supermarketId) {
                    continue;
                }

                const timestamp = price.$updatedAt || price.updatedAt || price.$createdAt || new Date().toISOString();

                await db.priceHistory.create({
                    priceId: price.$id || null,
                    price: parseFloat(price.price),
                    productId,
                    supermarketId,
                    timestamp,
                    isPromotional: false,
                    priceChangeReason: null
                });

                createdCount += 1;
            }

            await usePriceHistoryStore.getState().fetchHistory();
            set({ loading: false });
            return { success: true, createdCount };
        } catch (error) {
            console.error('Sync price history from prices error:', error);
            set({ error: error.message, loading: false });
            return { success: false, createdCount: 0 };
        }
    }
}));

export default usePriceHistoryStore;
