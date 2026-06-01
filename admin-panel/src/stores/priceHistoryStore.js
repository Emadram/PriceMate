import { create } from 'zustand';
import { db } from '../lib/appwrite';
import { Query } from 'appwrite';
import {
    PRICE_BACKFILL_SELECT,
    listAllDocuments,
    buildBackfillPayloads,
    createHistoryInBatches,
} from '../utils/priceHistoryBackfill';

const usePriceHistoryStore = create((set) => ({
    history: [],
    loading: false,
    error: null,

    fetchHistory: async () => {
        set({ loading: true, error: null });
        try {
            const documents = await listAllDocuments(
                (queries) => db.priceHistory.list(queries),
                [Query.orderDesc('timestamp')]
            );
            set({ history: documents, loading: false });
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

    /** @deprecated Use backfillFromPrices */
    syncFromPrices: async () => {
        return usePriceHistoryStore.getState().backfillFromPrices();
    },

  /**
   * One-time backfill: paginate all prices, skip rows that already have history (by priceId), parallel create.
   * @param {(progress: object) => void} [onProgress]
   */
    backfillFromPrices: async (onProgress) => {
        set({ loading: true, error: null });

        const report = (patch) => {
            onProgress?.(patch);
        };

        try {
            report({ phase: 'loading_existing', processed: 0, total: 0, created: 0, skipped: 0, failed: 0 });

            const historyDocs = await listAllDocuments(
                (queries) => db.priceHistory.list(queries),
                [Query.select(['$id', 'priceId'])]
            );

            const existingPriceIds = new Set(
                historyDocs.map((doc) => doc.priceId).filter(Boolean)
            );

            report({ phase: 'loading_prices', processed: 0, total: 0, created: 0, skipped: 0, failed: 0 });

            const prices = await listAllDocuments(
                (queries) => db.prices.list(queries),
                [Query.orderDesc('$updatedAt'), Query.select(PRICE_BACKFILL_SELECT)]
            );

            const { payloads, skippedExisting, skippedInvalid } = buildBackfillPayloads(
                prices,
                existingPriceIds
            );

            const skipped = skippedExisting + skippedInvalid;

            report({
                phase: 'creating',
                processed: 0,
                total: payloads.length,
                created: 0,
                skipped,
                failed: 0,
            });

            const { created, failed, errors } = await createHistoryInBatches(
                payloads,
                (payload) => db.priceHistory.create(payload),
                {
                    onProgress: (stats) => {
                        report({
                            phase: 'creating',
                            processed: stats.processed,
                            total: payloads.length,
                            created: stats.created,
                            skipped,
                            failed: stats.failed,
                        });
                    },
                }
            );

            await usePriceHistoryStore.getState().fetchHistory();
            set({ loading: false });

            return {
                success: true,
                createdCount: created,
                skipped,
                skippedExisting,
                skippedInvalid,
                failed,
                totalPrices: prices.length,
                errors,
            };
        } catch (error) {
            console.error('Backfill price history from prices error:', error);
            set({ error: error.message, loading: false });
            return {
                success: false,
                createdCount: 0,
                skipped: 0,
                skippedExisting: 0,
                skippedInvalid: 0,
                failed: 0,
                totalPrices: 0,
                errors: [error.message],
            };
        }
    },
}));

export default usePriceHistoryStore;
