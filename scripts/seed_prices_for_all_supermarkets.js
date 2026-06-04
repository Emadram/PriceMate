import { Client, Databases, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    listAllDocuments,
    resolveRelationId,
    createDocumentsInBatches,
    countDocuments,
} from './lib/appwriteList.js';
import { resolveAnchorPrice } from './lib/groceryPriceAnchors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const COLLECTIONS = {
    CATEGORIES: process.env.VITE_APPWRITE_COLLECTION_CATEGORIES || 'category',
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    SUPERMARKETS: process.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets',
    PRICES: process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
    PRICE_HISTORY: process.env.VITE_APPWRITE_COLLECTION_PRICE_HISTORY || 'price_history',
};

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY,
    seedUserId: process.env.SEED_USER_ID,
};

const parseArgs = (argv) => {
    const flags = {
        dryRun: false,
        supermarketId: null,
        limitPairs: null,
        concurrency: 8,
        checkpoint: true,
        checkpointFile: null,
        currency: 'TL',
        skipMissingCategory: false,
        batchBySupermarket: false,
    };

    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg.startsWith('--supermarket-id=')) flags.supermarketId = arg.split('=')[1];
        else if (arg.startsWith('--limit-pairs=')) flags.limitPairs = Number(arg.split('=')[1]) || null;
        else if (arg.startsWith('--concurrency=')) flags.concurrency = Number(arg.split('=')[1]) || 8;
        else if (arg === '--no-checkpoint') flags.checkpoint = false;
        else if (arg.startsWith('--checkpoint-file=')) flags.checkpointFile = arg.split('=')[1];
        else if (arg.startsWith('--currency=')) flags.currency = arg.split('=')[1] || 'TL';
        else if (arg === '--skip-missing-category') flags.skipMissingCategory = true;
        else if (arg === '--batch-by-supermarket') flags.batchBySupermarket = true;
    }

    return flags;
};

if (!config.projectId || !config.databaseId) {
    console.error('Missing VITE_APPWRITE_PROJECT_ID or VITE_APPWRITE_DATABASE_ID.');
    process.exit(1);
}

if (!config.apiKey) {
    console.error('Missing APPWRITE_API_KEY.');
    process.exit(1);
}

if (!config.seedUserId) {
    console.error('Missing SEED_USER_ID (required to create prices_collection rows).');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

const databases = new Databases(client);

const checkpointsDir = path.join(__dirname, '.checkpoints');
const ensureCheckpointDir = () => {
    if (!fs.existsSync(checkpointsDir)) fs.mkdirSync(checkpointsDir, { recursive: true });
};

const defaultCheckpointPath = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    return path.join(checkpointsDir, `seed_prices_for_all_supermarkets.${stamp}.json`);
};

const loadCheckpoint = (filePath) => {
    try {
        if (!filePath || !fs.existsSync(filePath)) return { createdKeys: {} };
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { createdKeys: {} };
        return { createdKeys: parsed.createdKeys || {} };
    } catch {
        return { createdKeys: {} };
    }
};

const saveCheckpoint = (filePath, checkpoint) => {
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
};

const listSupermarkets = async (supermarketId) => {
    const base = [];
    if (supermarketId) base.push(Query.equal('$id', supermarketId));
    return listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.SUPERMARKETS, queries), base);
};

const listProducts = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries));

const listCategories = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.CATEGORIES, queries));

const listPrices = async (baseQueries = []) =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, queries), baseQueries);

const buildExistingPriceKeySet = (priceDocs) => {
    const set = new Set();
    for (const doc of priceDocs) {
        const productId = resolveRelationId(doc.products) || doc.productId;
        const supermarketId = resolveRelationId(doc.supermarkets) || doc.supermarketId;
        if (!productId || !supermarketId) continue;
        set.add(`${productId}:${supermarketId}`);
    }
    return set;
};

const normalizeCategoryName = (value) => String(value || '').trim().toLowerCase();

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));
    const checkpointPath = flags.checkpointFile
        ? path.isAbsolute(flags.checkpointFile)
            ? flags.checkpointFile
            : path.join(__dirname, flags.checkpointFile)
        : defaultCheckpointPath();

    if (flags.checkpoint && !flags.dryRun) ensureCheckpointDir();
    const checkpoint = flags.checkpoint && !flags.dryRun ? loadCheckpoint(checkpointPath) : { createdKeys: {} };

    const [categories, products, supermarkets, pricesCount, historyCount] = await Promise.all([
        listCategories(),
        listProducts(),
        listSupermarkets(flags.supermarketId),
        countDocuments(databases, config.databaseId, COLLECTIONS.PRICES),
        countDocuments(databases, config.databaseId, COLLECTIONS.PRICE_HISTORY),
    ]);

    const categoryMap = new Map(categories.map((c) => [normalizeCategoryName(c.categoryName), c.$id]));

    const canonicalCategories = [
        'beverage',
        'snacks',
        'dairy',
        'bakery',
        'seafood',
        'fruit',
        'frozen',
        'canned',
    ];
    const missingCanonical = canonicalCategories.filter((name) => !categoryMap.has(name));

    console.log('Seed prices for all supermarkets');
    console.log(`  Supermarkets: ${supermarkets.length}${flags.supermarketId ? ` (filtered: ${flags.supermarketId})` : ''}`);
    console.log(`  Products: ${products.length}`);
    console.log(`  Categories: ${categories.length}`);
    if (missingCanonical.length) {
        console.warn(`  Missing canonical categories by name: ${missingCanonical.join(', ')}`);
    }
    console.log(`  Existing prices_collection: ${pricesCount}`);
    console.log(`  Existing price_history: ${historyCount}`);
    console.log('  Recommended Appwrite indexes:');
    console.log('    - price_history.productId (key)');
    console.log('    - price_history.timestamp (key)');
    console.log('    - price_history.priceId (key, optional but recommended)');

    const targetPairs = products.length * supermarkets.length;
    console.log(`  Target product×supermarket pairs: ${targetPairs}`);

    const payloads = [];
    let productsMissingCategory = 0;
    const buildPayloadForPair = (product, smId) => {
        const productId = product.$id;
        const productMeta = {
            name: product.name || product.product_name || '',
            unit: product.unit || '',
            brand: product.brand || product.brands || '',
        };
        const categoryName =
            (typeof product.categoryId === 'object' && product.categoryId?.categoryName) ||
            (Array.isArray(product.categoryId) ? product.categoryId[0]?.categoryName : null) ||
            '';

        const key = `${productId}:${smId}`;
        if (checkpoint.createdKeys?.[key]) return null;

        const { anchor } = resolveAnchorPrice(null, productMeta);
        const biasSeed = [...smId].reduce((a, c) => a + c.charCodeAt(0), 0);
        const bias = 1 + (((biasSeed % 9) - 4) / 100); // ~ -4% .. +4%
        const price = Math.round(anchor * bias * 100) / 100;

        return {
            key,
            productId,
            supermarketId: smId,
            currency: flags.currency,
            stockStatus: 'in_stock',
            userId: config.seedUserId,
            price,
            meta: {
                productName: productMeta.name,
                categoryName,
            },
        };
    };

    if (flags.batchBySupermarket) {
        for (const sm of supermarkets) {
            const smId = sm.$id;
            const docs = await listPrices([Query.equal('supermarkets', smId)]);
            const productIdsPresent = new Set(
                docs
                    .map((d) => resolveRelationId(d.products) || d.productId || null)
                    .filter(Boolean)
            );

            for (const product of products) {
                const hasCategoryId = Boolean(resolveRelationId(product.categoryId) || product.categoryId);
                if (!hasCategoryId) productsMissingCategory += 1;
                if (!hasCategoryId && flags.skipMissingCategory) continue;

                if (productIdsPresent.has(product.$id)) continue;
                const row = buildPayloadForPair(product, smId);
                if (!row) continue;
                payloads.push(row);
                if (flags.limitPairs && payloads.length >= flags.limitPairs) break;
            }
            if (flags.limitPairs && payloads.length >= flags.limitPairs) break;
        }
    } else {
        const priceDocs = await listPrices();
        const existingKeys = buildExistingPriceKeySet(priceDocs);
        console.log(`  Existing unique product×supermarket price pairs: ${existingKeys.size}`);

        for (const product of products) {
            const hasCategoryId = Boolean(resolveRelationId(product.categoryId) || product.categoryId);
            if (!hasCategoryId) productsMissingCategory += 1;
            if (!hasCategoryId && flags.skipMissingCategory) continue;

            for (const sm of supermarkets) {
                const smId = sm.$id;
                const key = `${product.$id}:${smId}`;
                if (existingKeys.has(key)) continue;
                const row = buildPayloadForPair(product, smId);
                if (!row) continue;
                payloads.push(row);
                if (flags.limitPairs && payloads.length >= flags.limitPairs) break;
            }
            if (flags.limitPairs && payloads.length >= flags.limitPairs) break;
        }
    }

    if (productsMissingCategory > 0) {
        console.warn(
            `  Products missing categoryId: ${productsMissingCategory}/${products.length}` +
                (flags.skipMissingCategory ? ' (skipping them)' : ' (included; consider fixing categoryId)')
        );
    }

    console.log(`  Missing price pairs to create: ${payloads.length}`);

    if (flags.dryRun) {
        console.log('Dry run: no writes.');
        console.log('Sample payload:', JSON.stringify(payloads.slice(0, 2), null, 2));
        return;
    }

    if (payloads.length === 0) {
        console.log('Nothing to insert.');
        return;
    }

    const createFn = (row) =>
        databases.createDocument(config.databaseId, COLLECTIONS.PRICES, ID.unique(), {
            price: row.price,
            userId: row.userId,
            products: row.productId,
            supermarkets: row.supermarketId,
            currency: row.currency,
            stockStatus: row.stockStatus,
        });

    const startedAt = Date.now();
    const { created, failed, errors } = await createDocumentsInBatches(payloads, async (row) => {
        const doc = await createFn(row);
        if (flags.checkpoint) {
            checkpoint.createdKeys[row.key] = doc.$id || true;
        }
        return doc;
    }, {
        concurrency: flags.concurrency,
        onProgress: (s) => {
            if (s.processed % 250 === 0 || s.processed === s.total) {
                const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                const rate = (s.created / elapsed).toFixed(1);
                console.log(`  Progress: ${s.processed}/${s.total} (created ${s.created}, failed ${s.failed}, ${rate}/s)`);
                if (flags.checkpoint) saveCheckpoint(checkpointPath, checkpoint);
            }
        },
    });

    if (flags.checkpoint) {
        saveCheckpoint(checkpointPath, checkpoint);
        console.log(`  Checkpoint saved: ${checkpointPath}`);
    }

    console.log(`Done. Created: ${created}, Failed: ${failed}`);
    if (errors.length) console.error('Errors:', errors);
    if (failed > 0) process.exit(1);
};

run().catch((err) => {
    console.error('Seed prices failed:', err.message || err);
    process.exit(1);
});

