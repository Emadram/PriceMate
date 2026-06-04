import { create } from 'zustand';
import { db } from '../lib/appwrite';
import { Query } from 'appwrite';
import {
    PRICE_BACKFILL_SELECT,
    listAllDocuments,
    buildBackfillPayloads,
    createHistoryInBatches,
} from '../utils/priceHistoryBackfill';
import { buildOpeImportPayloads } from '../utils/openPriceEngineImport';

const DEFAULT_PAGE_SIZE = 50;

const usePriceHistoryStore = create((set, get) => ({
    history: [],
    loading: false,
    error: null,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,

    setPage: (page) => set({ page: Math.max(1, page) }),

    fetchHistoryPage: async (page = get().page, pageSize = get().pageSize) => {
        set({ loading: true, error: null });
        try {
            const offset = (page - 1) * pageSize;
            const response = await db.priceHistory.list([
                Query.orderDesc('timestamp'),
                Query.limit(pageSize),
                Query.offset(offset),
            ]);
            set({
                history: response.documents,
                total: response.total ?? response.documents.length,
                page,
                pageSize,
                loading: false,
            });
        } catch (error) {
            console.error('Fetch price history error:', error);
            set({ error: error.message, loading: false });
        }
    },

    /** Loads current page only (replaces full-collection fetch). */
    fetchHistory: async () => {
        const { page, pageSize } = get();
        return get().fetchHistoryPage(page, pageSize);
    },

    addHistory: async (data) => {
        set({ loading: true, error: null });
        try {
            const created = await db.priceHistory.create({
                priceId: data.priceId || null,
                price: parseFloat(data.price),
                productId: data.productId,
                supermarketId: data.supermarketId,
                timestamp: data.timestamp,
                isPromotional: data.isPromotional || false,
                priceChangeReason: data.priceChangeReason || null,
            });
            const { page, pageSize } = get();
            if (page === 1) {
                set((state) => ({
                    history: [created, ...state.history].slice(0, pageSize),
                    total: (state.total || 0) + 1,
                    loading: false,
                }));
            } else {
                await get().fetchHistoryPage(page, pageSize);
            }
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
            const updated = await db.priceHistory.update(id, {
                priceId: data.priceId || null,
                price: parseFloat(data.price),
                productId: data.productId,
                supermarketId: data.supermarketId,
                timestamp: data.timestamp,
                isPromotional: data.isPromotional || false,
                priceChangeReason: data.priceChangeReason || null,
            });
            set((state) => ({
                history: state.history.map((row) =>
                    row.$id === id ? { ...row, ...updated } : row
                ),
                loading: false,
            }));
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
            set((state) => ({
                history: state.history.filter((row) => row.$id !== id),
                total: Math.max(0, (state.total || 0) - 1),
                loading: false,
            }));
            return true;
        } catch (error) {
            console.error('Delete price history error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    /** @deprecated Use backfillFromPrices */
    syncFromPrices: async () => get().backfillFromPrices(),

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

            await get().fetchHistoryPage(1, get().pageSize);
            set({ loading: false, page: 1 });

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

    importHistoryBatch: async (rows, options, onProgress) => {
        set({ loading: true, error: null });

        const report = (patch) => onProgress?.(patch);

        try {
            const { payloads, skipped: skippedDupes } = buildOpeImportPayloads(rows, options);

            if (payloads.length === 0) {
                set({ loading: false });
                return {
                    success: true,
                    createdCount: 0,
                    skipped: skippedDupes,
                    failed: 0,
                    total: 0,
                    errors: [],
                };
            }

            report({
                phase: 'creating',
                processed: 0,
                total: payloads.length,
                created: 0,
                skipped: skippedDupes,
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
                            skipped: skippedDupes,
                            failed: stats.failed,
                        });
                    },
                }
            );

            await get().fetchHistoryPage(1, get().pageSize);
            set({ loading: false, page: 1 });

            return {
                success: true,
                createdCount: created,
                skipped: skippedDupes,
                failed,
                total: payloads.length,
                errors,
            };
        } catch (error) {
            console.error('OPE import batch error:', error);
            set({ error: error.message, loading: false });
            return {
                success: false,
                createdCount: 0,
                skipped: 0,
                failed: 0,
                total: 0,
                errors: [error.message],
            };
        }
    },
}));

export default usePriceHistoryStore;
