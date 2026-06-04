import { Query } from 'node-appwrite';

export const PAGE_SIZE = 100;
export const DEFAULT_CONCURRENCY = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {(queries: unknown[]) => Promise<{ documents: object[] }>} listFn
 * @param {unknown[]} [baseQueries]
 * @param {number} [pageSize]
 */
export const listAllDocuments = async (listFn, baseQueries = [], pageSize = PAGE_SIZE) => {
    const all = [];
    let cursor = null;

    while (true) {
        const queries = [...baseQueries, Query.limit(pageSize)];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const response = await listFn(queries);
        const docs = response.documents || [];
        all.push(...docs);

        if (docs.length < pageSize) break;
        cursor = docs[docs.length - 1]?.$id;
        if (!cursor) break;
    }

    return all;
};

/**
 * @param {unknown} field
 * @returns {string|null}
 */
export const resolveRelationId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) {
        return field.length > 0 ? resolveRelationId(field[0]) : null;
    }
    if (typeof field === 'string') return field;
    return field.$id || null;
};

const isRateLimitError = (error) => {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return code === 429 || message.includes('rate limit') || message.includes('too many requests');
};

/**
 * @param {object[]} payloads
 * @param {(data: object) => Promise<unknown>} createFn
 * @param {{ concurrency?: number, onProgress?: (stats: object) => void }} [options]
 */
export const createDocumentsInBatches = async (payloads, createFn, options = {}) => {
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    const onProgress = options.onProgress;
    const total = payloads.length;
    let processed = 0;
    let created = 0;
    let failed = 0;
    const errors = [];

    const report = () => {
        onProgress?.({ processed, total, created, failed });
    };

    for (let i = 0; i < payloads.length; i += concurrency) {
        const chunk = payloads.slice(i, i + concurrency);

        const runChunk = async () =>
            Promise.allSettled(chunk.map((payload) => createFn(payload)));

        let results = await runChunk();
        if (results.some((r) => r.status === 'rejected' && isRateLimitError(r.reason))) {
            await sleep(800);
            results = await runChunk();
        }

        for (const result of results) {
            processed += 1;
            if (result.status === 'fulfilled') {
                created += 1;
            } else {
                failed += 1;
                if (errors.length < 8) {
                    errors.push(result.reason?.message || String(result.reason));
                }
            }
        }
        report();
    }

    return { created, failed, errors };
};

/**
 * @param {import('node-appwrite').Databases} databases
 * @param {string} databaseId
 * @param {string} collectionId
 * @param {string} productId
 * @returns {Promise<number>}
 */
export const countHistoryForProduct = async (databases, databaseId, collectionId, productId) => {
    const response = await databases.listDocuments(databaseId, collectionId, [
        Query.equal('productId', productId),
        Query.limit(1),
    ]);
    return response.total ?? 0;
};

/**
 * @param {import('node-appwrite').Databases} databases
 * @param {string} databaseId
 * @param {string} collectionId
 * @param {string} reason
 * @param {string} [productId]
 * @returns {Promise<number>}
 */
export const deleteSyntheticHistory = async (
    databases,
    databaseId,
    collectionId,
    reason,
    productId = null
) => {
    const baseQueries = [Query.equal('priceChangeReason', reason), Query.limit(PAGE_SIZE)];
    if (productId) baseQueries.unshift(Query.equal('productId', productId));

    let deleted = 0;
    while (true) {
        const response = await databases.listDocuments(databaseId, collectionId, baseQueries);
        const docs = response.documents || [];
        if (docs.length === 0) break;

        for (const doc of docs) {
            await databases.deleteDocument(databaseId, collectionId, doc.$id);
            deleted += 1;
        }
        if (docs.length < PAGE_SIZE) break;
    }
    return deleted;
};

/**
 * Fast count of documents in a collection (uses Appwrite `total`).
 * @param {import('node-appwrite').Databases} databases
 * @param {string} databaseId
 * @param {string} collectionId
 * @param {unknown[]} [queries]
 * @returns {Promise<number>}
 */
export const countDocuments = async (databases, databaseId, collectionId, queries = []) => {
    const response = await databases.listDocuments(databaseId, collectionId, [
        ...queries,
        Query.limit(1),
    ]);
    return response.total ?? 0;
};
