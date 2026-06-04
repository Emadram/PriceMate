import { Query } from 'appwrite';

/**
 * Appwrite indexes recommended on `price_history` (create in Appwrite Console):
 * - productId (key) — user-app charts query by product
 * - priceId (key, optional) — idempotent backfill dedupe
 * - timestamp (key) — admin list ordering
 */

export const PRICE_BACKFILL_SELECT = [
    '$id',
    '$createdAt',
    '$updatedAt',
    'price',
    'products.$id',
    'supermarkets.$id',
];

export const BACKFILL_CONCURRENCY = 8;
export const PAGE_SIZE = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const resolveRelationId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) {
        return field.length > 0 ? resolveRelationId(field[0]) : null;
    }
    if (typeof field === 'string') return field;
    return field.$id || null;
};

/**
 * @param {(queries: unknown[]) => Promise<{ documents: object[] }>} listFn
 * @param {unknown[]} baseQueries
 * @param {number} pageSize
 */
export const listAllDocuments = async (listFn, baseQueries = [], pageSize = PAGE_SIZE) => {
    const all = [];
    let cursor = null;

    while (true) {
        const queries = [...baseQueries, Query.limit(pageSize)];
        if (cursor) {
            queries.push(Query.cursorAfter(cursor));
        }

        const response = await listFn(queries);
        const docs = response.documents || [];
        all.push(...docs);

        if (docs.length < pageSize) break;
        cursor = docs[docs.length - 1].$id;
        if (!cursor) break;
    }

    return all;
};

/**
 * @param {object[]} prices
 * @param {Set<string>} existingPriceIds
 * @returns {{ payloads: object[], skippedExisting: number, skippedInvalid: number }}
 */
export const buildBackfillPayloads = (prices, existingPriceIds) => {
    const payloads = [];
    let skippedExisting = 0;
    let skippedInvalid = 0;

    for (const price of prices) {
        if (price.$id && existingPriceIds.has(price.$id)) {
            skippedExisting += 1;
            continue;
        }

        const productId =
            resolveRelationId(price.products) || price.productId || null;
        const supermarketId =
            resolveRelationId(price.supermarkets) || price.supermarketId || null;

        if (!productId || !supermarketId || price.price == null || Number.isNaN(Number(price.price))) {
            skippedInvalid += 1;
            continue;
        }

        payloads.push({
            priceId: price.$id || null,
            price: parseFloat(price.price),
            productId,
            supermarketId,
            timestamp:
                price.$updatedAt ||
                price.updatedAt ||
                price.$createdAt ||
                new Date().toISOString(),
            isPromotional: false,
            priceChangeReason: null,
        });
    }

    return { payloads, skippedExisting, skippedInvalid };
};

const isRateLimitError = (error) => {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return code === 429 || message.includes('rate limit') || message.includes('too many requests');
};

/**
 * @param {object[]} payloads
 * @param {(data: object) => Promise<unknown>} createFn
 * @param {{ concurrency?: number, onProgress?: (stats: object) => void }} options
 */
export const createHistoryInBatches = async (payloads, createFn, options = {}) => {
    const concurrency = options.concurrency ?? BACKFILL_CONCURRENCY;
    const onProgress = options.onProgress;
    const total = payloads.length;
    let processed = 0;
    let created = 0;
    let failed = 0;
    const errors = [];

    const report = (phase) => {
        onProgress?.({
            phase,
            processed,
            total,
            created,
            skipped: 0,
            failed,
        });
    };

    for (let i = 0; i < payloads.length; i += concurrency) {
        const chunk = payloads.slice(i, i + concurrency);

        const runChunk = async () => {
            return Promise.allSettled(
                chunk.map((payload) => createFn(payload))
            );
        };

        let results = await runChunk();

        const needsRetry = results.some(
            (r) => r.status === 'rejected' && isRateLimitError(r.reason)
        );
        if (needsRetry) {
            await sleep(800);
            results = await runChunk();
        }

        for (const result of results) {
            processed += 1;
            if (result.status === 'fulfilled') {
                created += 1;
            } else {
                failed += 1;
                if (errors.length < 5) {
                    errors.push(result.reason?.message || String(result.reason));
                }
            }
        }

        report('creating');
    }

    return { created, failed, errors };
};
