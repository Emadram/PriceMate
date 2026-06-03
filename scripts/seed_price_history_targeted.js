import { Client, Databases, ID } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    listAllDocuments,
    resolveRelationId,
    createDocumentsInBatches,
    countHistoryForProduct,
    deleteSyntheticHistory,
} from './lib/appwriteList.js';
import {
    generateSyntheticHistory,
    SYNTHETIC_REASON,
} from './lib/syntheticPriceHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const REQUIRED_PRODUCT_COUNT = 4;

const COLLECTIONS = {
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    PRICES: process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
    PRICE_HISTORY: process.env.VITE_APPWRITE_COLLECTION_PRICE_HISTORY || 'price_history',
};

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY,
};

const parseArgs = (argv) => {
    const flags = {
        dryRun: false,
        force: false,
        clearSynthetic: false,
        perProductPoints: 20,
        start: '2023-01-01',
        end: null,
        productIds: null,
        timeline: 'scattered',
        concurrency: 8,
    };

    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg === '--force') flags.force = true;
        else if (arg === '--clear-synthetic') flags.clearSynthetic = true;
        else if (arg.startsWith('--per-product-points=')) {
            flags.perProductPoints = Number(arg.split('=')[1]) || 20;
        } else if (arg.startsWith('--start=')) flags.start = arg.split('=')[1];
        else if (arg.startsWith('--end=')) flags.end = arg.split('=')[1];
        else if (arg.startsWith('--product-ids=')) {
            flags.productIds = arg
                .split('=')
                .slice(1)
                .join('=')
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean);
        } else if (arg.startsWith('--timeline=')) {
            const mode = arg.split('=')[1]?.trim().toLowerCase();
            if (mode === 'even' || mode === 'scattered') flags.timeline = mode;
            else console.warn(`Unknown timeline mode "${mode}", using scattered.`);
        } else if (arg.startsWith('--concurrency=')) {
            flags.concurrency = Number(arg.split('=')[1]) || 8;
        }
    }

    if (!flags.end) {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 7);
        flags.end = yesterday.toISOString().slice(0, 10);
    }

    return flags;
};

const parseDateUtc = (isoDate) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
};

const summarizePayloads = (payloads) => {
    if (!payloads.length) {
        return { minTs: '-', maxTs: '-', minPrice: '-', maxPrice: '-' };
    }
    const times = payloads.map((p) => new Date(p.timestamp).getTime());
    const prices = payloads.map((p) => p.price);
    return {
        minTs: new Date(Math.min(...times)).toISOString().slice(0, 10),
        maxTs: new Date(Math.max(...times)).toISOString().slice(0, 10),
        minPrice: Math.min(...prices).toFixed(2),
        maxPrice: Math.max(...prices).toFixed(2),
    };
};

if (!config.projectId || !config.databaseId) {
    console.error('Missing VITE_APPWRITE_PROJECT_ID or VITE_APPWRITE_DATABASE_ID.');
    process.exit(1);
}

if (!config.apiKey) {
    console.error('Missing APPWRITE_API_KEY.');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

const databases = new Databases(client);

const loadPrices = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, queries)
    );

const loadProductsMap = async (productIds) => {
    const map = new Map();
    const allProducts = await listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries)
    );
    for (const p of allProducts) {
        if (!productIds.has(p.$id)) continue;
        map.set(p.$id, {
            name: p.name || p.product_name || '',
            unit: p.unit || '',
            brand: p.brand || p.brands || '',
        });
    }
    return map;
};

const groupPricesByProduct = (priceDocs) => {
    /** @type {Map<string, { supermarketId: string, priceId: string, currentPrice: number|null }[]>} */
    const byProduct = new Map();

    for (const doc of priceDocs) {
        const productId = resolveRelationId(doc.products) || doc.productId;
        const supermarketId = resolveRelationId(doc.supermarkets) || doc.supermarketId;
        const priceId = doc.$id || doc.priceId || null;
        if (!productId || !supermarketId || !priceId) continue;

        const priceVal = doc.price != null ? Number(doc.price) : null;
        if (!byProduct.has(productId)) byProduct.set(productId, []);

        const list = byProduct.get(productId);
        const existing = list.find((e) => e.supermarketId === supermarketId);
        if (existing) {
            existing.priceId = priceId;
            if (priceVal != null && !Number.isNaN(priceVal)) existing.currentPrice = priceVal;
        } else {
            list.push({
                supermarketId,
                priceId,
                currentPrice: priceVal != null && !Number.isNaN(priceVal) ? priceVal : null,
            });
        }
    }

    return byProduct;
};

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));
    const startDate = parseDateUtc(flags.start);
    const endDate = parseDateUtc(flags.end);

    if (!flags.productIds?.length) {
        console.error(
            `Missing --product-ids. Provide exactly ${REQUIRED_PRODUCT_COUNT} comma-separated product IDs.`
        );
        console.error(
            'Example: npm run seed:price-history-targeted -- --product-ids=id1,id2,id3,id4 --dry-run'
        );
        process.exit(1);
    }

    const uniqueIds = [...new Set(flags.productIds)];
    if (uniqueIds.length !== REQUIRED_PRODUCT_COUNT) {
        console.error(
            `Expected exactly ${REQUIRED_PRODUCT_COUNT} unique product IDs, got ${uniqueIds.length}.`
        );
        console.error(`  Received: ${uniqueIds.join(', ')}`);
        process.exit(1);
    }

    if (endDate <= startDate) {
        console.error('End date must be after start date.');
        process.exit(1);
    }

    console.log('Seed targeted price history (4 products)');
    console.log(`  Product IDs: ${uniqueIds.join(', ')}`);
    console.log(`  Range: ${flags.start} → ${flags.end}`);
    console.log(`  Points per product: ${flags.perProductPoints}`);
    console.log(`  Timeline: ${flags.timeline}`);
    console.log(`  Dry run: ${flags.dryRun}`);
    console.log(`  Force: ${flags.force}`);
    console.log(`  Clear synthetic: ${flags.clearSynthetic}`);

    const priceDocs = await loadPrices();
    const byProduct = groupPricesByProduct(priceDocs);
    const productIdSet = new Set(uniqueIds);

    const missing = uniqueIds.filter((id) => !(byProduct.get(id) || []).some((s) => s.priceId));
    if (missing.length > 0) {
        console.error('These product IDs have no rows in prices_collection (or missing priceId):');
        for (const id of missing) console.error(`  - ${id}`);
        process.exit(1);
    }

    const productMetaMap = await loadProductsMap(productIdSet);

    if (flags.clearSynthetic && !flags.dryRun) {
        console.log('Deleting existing synthetic_seed rows for target products...');
        let deletedTotal = 0;
        for (const productId of uniqueIds) {
            const deleted = await deleteSyntheticHistory(
                databases,
                config.databaseId,
                COLLECTIONS.PRICE_HISTORY,
                SYNTHETIC_REASON,
                productId
            );
            deletedTotal += deleted;
            console.log(`  ${productId}: deleted ${deleted}`);
        }
        console.log(`  Total deleted: ${deletedTotal}`);
    }

    const allPayloads = [];
    let skipped = 0;

    for (const productId of uniqueIds) {
        const stores = (byProduct.get(productId) || []).filter((s) => s.priceId);
        const productMeta = productMetaMap.get(productId) || {};

        if (!flags.force) {
            const existingCount = await countHistoryForProduct(
                databases,
                config.databaseId,
                COLLECTIONS.PRICE_HISTORY,
                productId
            );
            if (existingCount >= flags.perProductPoints) {
                console.log(
                    `  Skip ${productId} (${productMeta.name || 'unknown'}): already has ${existingCount} history rows`
                );
                skipped += 1;
                continue;
            }
        }

        const payloads = generateSyntheticHistory({
            productId,
            stores,
            productMeta,
            startDate,
            endDate,
            totalPoints: flags.perProductPoints,
            timelineMode: flags.timeline,
        });

        const stats = summarizePayloads(payloads);
        console.log(
            `  ${productId} (${productMeta.name || 'unknown'}): ${payloads.length} rows, ` +
                `${stores.length} store(s), dates ${stats.minTs} → ${stats.maxTs}, ` +
                `price ${stats.minPrice}–${stats.maxPrice} TRY`
        );

        if (payloads.length < flags.perProductPoints) {
            console.warn(`    Warning: expected ${flags.perProductPoints}, generated ${payloads.length}`);
        }

        allPayloads.push(...payloads);
    }

    console.log(`Total history rows to create: ${allPayloads.length} (skipped ${skipped} products)`);

    if (flags.dryRun) {
        const byId = new Map();
        for (const row of allPayloads) {
            if (!byId.has(row.productId)) byId.set(row.productId, []);
            byId.get(row.productId).push(row);
        }
        for (const [id, rows] of byId) {
            console.log(`  Sample for ${id}:`, JSON.stringify(rows.slice(0, 2), null, 2));
        }
        return;
    }

    if (allPayloads.length === 0) {
        console.log('Nothing to insert.');
        return;
    }

    const createFn = (data) =>
        databases.createDocument(
            config.databaseId,
            COLLECTIONS.PRICE_HISTORY,
            ID.unique(),
            {
                priceId: data.priceId,
                price: data.price,
                productId: data.productId,
                supermarketId: data.supermarketId,
                timestamp: data.timestamp,
                isPromotional: data.isPromotional ?? false,
                priceChangeReason: data.priceChangeReason ?? SYNTHETIC_REASON,
            }
        );

    const startedAt = Date.now();
    const { created, failed, errors } = await createDocumentsInBatches(allPayloads, createFn, {
        concurrency: flags.concurrency,
        onProgress: (s) => {
            if (s.processed % 40 === 0 || s.processed === s.total) {
                const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                const rate = (s.created / elapsed).toFixed(1);
                console.log(
                    `  Progress: ${s.processed}/${s.total} (created ${s.created}, failed ${s.failed}, ${rate}/s)`
                );
            }
        },
    });

    console.log(`Done. Created: ${created}, Failed: ${failed}`);
    if (errors.length) console.error('Errors:', errors.slice(0, 8));
    if (failed > 0) process.exit(1);
};

run().catch((err) => {
    console.error('Seed targeted price history failed:', err.message || err);
    process.exit(1);
});
