import { Client, Databases, ID, Query } from 'node-appwrite';
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
        perProductPoints: 50,
        minPoints: null,
        start: '2023-01-01',
        end: null,
        productId: null,
        maxProducts: null,
        concurrency: 8,
    };

    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg === '--force') flags.force = true;
        else if (arg === '--clear-synthetic') flags.clearSynthetic = true;
        else if (arg.startsWith('--per-product-points=')) flags.perProductPoints = Number(arg.split('=')[1]) || 50;
        else if (arg.startsWith('--min-points=')) flags.minPoints = Number(arg.split('=')[1]) || null; // legacy alias
        else if (arg.startsWith('--start=')) flags.start = arg.split('=')[1];
        else if (arg.startsWith('--end=')) flags.end = arg.split('=')[1];
        else if (arg.startsWith('--product-id=')) flags.productId = arg.split('=')[1];
        else if (arg.startsWith('--max-products=')) flags.maxProducts = Number(arg.split('=')[1]) || null;
        else if (arg.startsWith('--concurrency=')) flags.concurrency = Number(arg.split('=')[1]) || 8;
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

const loadPrices = async () => {
    return listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, queries)
    );
};

const loadProductsMap = async (productIds) => {
    const map = new Map();
    const allProducts = await listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries)
    );
    for (const p of allProducts) {
        if (productIds.size > 0 && !productIds.has(p.$id)) continue;
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

    if (endDate <= startDate) {
        console.error('End date must be after start date.');
        process.exit(1);
    }

    console.log('Seed price history');
    console.log(`  Range: ${flags.start} → ${flags.end}`);
    const perProductPoints = flags.minPoints ?? flags.perProductPoints;
    console.log(`  Points per product (distributed across supermarkets): ${perProductPoints}`);
    console.log(`  Dry run: ${flags.dryRun}`);
    console.log(`  Force: ${flags.force}`);
    console.log(`  Clear synthetic: ${flags.clearSynthetic}`);
    console.log('  Recommended Appwrite indexes on price_history: productId (key), timestamp (key), priceId (key optional)');

    const priceDocs = await loadPrices();
    const byProduct = groupPricesByProduct(priceDocs);

    let productIds = [...byProduct.keys()];
    if (flags.productId) {
        productIds = productIds.filter((id) => id === flags.productId);
        if (productIds.length === 0) {
            console.error(`Product ${flags.productId} has no prices in ${COLLECTIONS.PRICES}.`);
            process.exit(1);
        }
    }
    if (flags.maxProducts && productIds.length > flags.maxProducts) {
        productIds = productIds.slice(0, flags.maxProducts);
    }

    const productMetaMap = await loadProductsMap(new Set(productIds));

    if (flags.clearSynthetic && !flags.dryRun) {
        console.log('Deleting existing synthetic_seed rows...');
        const deleted = await deleteSyntheticHistory(
            databases,
            config.databaseId,
            COLLECTIONS.PRICE_HISTORY,
            SYNTHETIC_REASON,
            flags.productId
        );
        console.log(`  Deleted ${deleted} documents.`);
    }

    const allPayloads = [];
    let skipped = 0;
    let generated = 0;

    for (const productId of productIds) {
        const stores = (byProduct.get(productId) || []).filter((s) => s.priceId);
        if (stores.length === 0) continue;

        if (!flags.force) {
            const existingCount = await countHistoryForProduct(
                databases,
                config.databaseId,
                COLLECTIONS.PRICE_HISTORY,
                productId
            );
            if (existingCount >= perProductPoints) {
                skipped += 1;
                continue;
            }
        }

        const productMeta = productMetaMap.get(productId) || {};
        const payloads = generateSyntheticHistory({
            productId,
            stores,
            productMeta,
            startDate,
            endDate,
            totalPoints: perProductPoints,
        });

        if (payloads.length < perProductPoints) {
            console.warn(
                `  Product ${productId} (${productMeta.name || 'unknown'}): only ${payloads.length} points`
            );
        }

        generated += 1;
        allPayloads.push(...payloads);
    }

    console.log(`Products with prices: ${productIds.length}`);
    console.log(`Products to seed: ${generated} (skipped ${skipped} with enough history)`);
    console.log(`Total history rows to create: ${allPayloads.length}`);

    if (flags.dryRun) {
        const sample = allPayloads.slice(0, 3);
        console.log('Sample payloads:', JSON.stringify(sample, null, 2));
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
    const { created, failed, errors } = await createDocumentsInBatches(
        allPayloads,
        createFn,
        {
            concurrency: flags.concurrency,
            onProgress: (s) => {
                if (s.processed % 200 === 0 || s.processed === s.total) {
                    const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                    const rate = (s.created / elapsed).toFixed(1);
                    console.log(
                        `  Progress: ${s.processed}/${s.total} (created ${s.created}, failed ${s.failed}, ${rate}/s)`
                    );
                }
            },
        }
    );

    console.log(`Done. Created: ${created}, Failed: ${failed}`);
    if (errors.length) console.error('Errors:', errors);
    if (failed > 0) process.exit(1);
};

run().catch((err) => {
    console.error('Seed price history failed:', err.message || err);
    process.exit(1);
});
