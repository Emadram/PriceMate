/**
 * seed_price_history_spread.js
 *
 * Populates price_history for every product that has a current price.
 * Generates 2-3 data-points per timeline bucket:
 *
 *   1 week ago  ·  1 month ago  ·  3 months ago  ·  1 year ago  ·  3 years ago  ·  5 years ago
 *
 * Each price entry is randomly assigned to one of the available supermarkets
 * so that the history looks organic and spread across stores.
 *
 * Historical prices are deflated using Turkey's approximate grocery CPI curve
 * so older entries are realistically cheaper than today's price.
 *
 * Usage:
 *   node seed_price_history_spread.js [--dry-run] [--force] [--clear-synthetic]
 */

import { Client, Databases, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import {
    listAllDocuments,
    resolveRelationId,
    createDocumentsInBatches,
    countHistoryForProduct,
    deleteSyntheticHistory,
} from './lib/appwriteList.js';
import { SYNTHETIC_REASON } from './lib/syntheticPriceHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// ── Config ───────────────────────────────────────────────────────────────────

const COLLECTIONS = {
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    PRICES: process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
    PRICE_HISTORY: process.env.VITE_APPWRITE_COLLECTION_PRICE_HISTORY || 'price_history',
    SUPERMARKETS: process.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets',
};

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY,
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

// ── CLI args ─────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
    const flags = {
        dryRun: false,
        force: false,
        clearSynthetic: false,
        concurrency: 8,
    };
    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg === '--force') flags.force = true;
        else if (arg === '--clear-synthetic') flags.clearSynthetic = true;
        else if (arg.startsWith('--concurrency=')) flags.concurrency = Number(arg.split('=')[1]) || 8;
    }
    return flags;
};

// ── Inflation model ──────────────────────────────────────────────────────────
//
// Turkey grocery CPI approximate multipliers relative to TODAY (June 2026 = 1.00).
// Going backwards: prices were considerably cheaper years ago.
//
// Sources: TUIK CPI food indices, ~72 % avg annual food inflation 2021-2022,
// ~65 % in 2023, tapering to ~40 % in 2024 and ~25 % in 2025.
//
// These are *cumulative* multipliers: a multiplier of 0.18 means that 5 years
// ago the same item cost ~18 % of today's price.

const INFLATION_CURVE = [
    { yearsAgo: 0,   mult: 1.00 },
    { yearsAgo: 0.02, mult: 0.995 },  // ~1 week
    { yearsAgo: 0.08, mult: 0.98 },   // ~1 month
    { yearsAgo: 0.25, mult: 0.94 },   // ~3 months
    { yearsAgo: 1,   mult: 0.78 },    // 1 year
    { yearsAgo: 3,   mult: 0.38 },    // 3 years
    { yearsAgo: 5,   mult: 0.18 },    // 5 years
];

/**
 * Interpolate the inflation multiplier for a given number of years in the past.
 * @param {number} yearsAgo
 * @returns {number} multiplier ∈ (0, 1]
 */
const inflationMultiplier = (yearsAgo) => {
    const curve = INFLATION_CURVE;
    if (yearsAgo <= curve[0].yearsAgo) return curve[0].mult;
    if (yearsAgo >= curve[curve.length - 1].yearsAgo) return curve[curve.length - 1].mult;

    for (let i = 0; i < curve.length - 1; i++) {
        const a = curve[i];
        const b = curve[i + 1];
        if (yearsAgo >= a.yearsAgo && yearsAgo <= b.yearsAgo) {
            const t = (yearsAgo - a.yearsAgo) / (b.yearsAgo - a.yearsAgo);
            return a.mult + t * (b.mult - a.mult);
        }
    }
    return 1;
};

// ── Timeline buckets ─────────────────────────────────────────────────────────

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Each bucket defines a label, a centre offset from today, and a spread.
 * We place 2-3 random data-points inside each bucket.
 */
const TIMELINE_BUCKETS = [
    { label: '1 week ago',   centreMs: 7 * MS_DAY,           spreadMs: 3 * MS_DAY,    pointCount: 2 },
    { label: '1 month ago',  centreMs: 30 * MS_DAY,          spreadMs: 10 * MS_DAY,   pointCount: 3 },
    { label: '3 months ago', centreMs: 90 * MS_DAY,          spreadMs: 20 * MS_DAY,   pointCount: 3 },
    { label: '1 year ago',   centreMs: 365 * MS_DAY,         spreadMs: 60 * MS_DAY,   pointCount: 3 },
    { label: '3 years ago',  centreMs: 3 * 365 * MS_DAY,     spreadMs: 120 * MS_DAY,  pointCount: 2 },
    { label: '5 years ago',  centreMs: 5 * 365 * MS_DAY,     spreadMs: 180 * MS_DAY,  pointCount: 2 },
];

/**
 * Seeded PRNG (mulberry32) for reproducible runs.
 */
const createRng = (seed) => {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const hashString = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const roundPrice = (v) => Math.round(v * 100) / 100;

/**
 * Generate timestamps for one product inside all timeline buckets.
 * @param {string} productId – used as PRNG seed for reproducibility
 * @returns {{ timestamp: Date, yearsAgo: number, label: string }[]}
 */
const generateTimestamps = (productId) => {
    const rng = createRng(hashString(productId));
    const now = Date.now();
    const points = [];

    for (const bucket of TIMELINE_BUCKETS) {
        for (let i = 0; i < bucket.pointCount; i++) {
            const jitter = (rng() - 0.5) * 2 * bucket.spreadMs;
            const offsetMs = Math.max(MS_DAY, bucket.centreMs + jitter); // never in the future
            const ts = new Date(now - offsetMs);
            const yearsAgo = offsetMs / (365.25 * MS_DAY);
            points.push({ timestamp: ts, yearsAgo, label: bucket.label });
        }
    }

    // Sort chronologically (oldest first)
    points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return points;
};

/**
 * Compute a historical price based on the current price and time offset.
 * Adds a small random walk (±3 %) on top of the inflation adjustment.
 */
const computeHistoricalPrice = (currentPrice, yearsAgo, rng) => {
    const infl = inflationMultiplier(yearsAgo);
    const noise = 1 + (rng() - 0.5) * 0.06; // ±3 %
    return roundPrice(Math.max(0.01, currentPrice * infl * noise));
};

// ── Interactive prompt ───────────────────────────────────────────────────────

const ask = (question) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

// ── Data loaders ─────────────────────────────────────────────────────────────

const loadSupermarkets = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.SUPERMARKETS, queries)
    );

const loadPrices = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, queries)
    );

const loadProducts = async (productIds) => {
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

/**
 * Format a supermarket name for display.
 */
const formatSupermarketName = (sm) => {
    if (!sm) return 'Unknown';
    return sm.branchName ? `${sm.name} — ${sm.branchName}` : sm.name || 'Unnamed';
};

// ── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));

    // 1. Load all supermarkets
    console.log('\n📦 Loading supermarkets...');
    const supermarkets = await loadSupermarkets();

    if (supermarkets.length === 0) {
        console.error('No supermarkets found in the database.');
        process.exit(1);
    }

    const supermarketIds = supermarkets.map((sm) => sm.$id);
    const supermarketNameMap = new Map(supermarkets.map((sm) => [sm.$id, formatSupermarketName(sm)]));

    console.log(`  Loaded ${supermarkets.length} supermarkets:`);
    supermarkets.forEach((sm) => {
        console.log(`    • ${formatSupermarketName(sm)}  (${sm.$id})`);
    });

    // 2. Load ALL prices (across all supermarkets)
    console.log('\n📊 Loading all prices...');
    const allPrices = await loadPrices();
    console.log(`  Loaded ${allPrices.length} total price documents.`);

    // 3. Deduplicate by product — pick highest current price across all stores as the anchor
    const productPriceMap = new Map(); // productId -> { priceId, currentPrice }
    for (const doc of allPrices) {
        const productId = resolveRelationId(doc.products) || doc.productId;
        const priceId = doc.$id;
        const priceVal = doc.price != null ? Number(doc.price) : null;
        if (!productId || !priceId || priceVal == null || isNaN(priceVal) || priceVal <= 0) continue;

        const existing = productPriceMap.get(productId);
        if (!existing || priceVal > existing.currentPrice) {
            productPriceMap.set(productId, { priceId, currentPrice: priceVal });
        }
    }

    const productIds = [...productPriceMap.keys()];
    console.log(`  Unique products with valid prices: ${productIds.length}`);

    if (productIds.length === 0) {
        console.error('No products with valid prices found. Nothing to seed.');
        process.exit(0);
    }

    // 4. Load product metadata for logging
    const productMetaMap = await loadProducts(new Set(productIds));

    // 5. Optionally clear old synthetic data
    if (flags.clearSynthetic && !flags.dryRun) {
        console.log('\n🗑️  Deleting existing synthetic_seed rows for these products...');
        let totalDeleted = 0;
        for (const productId of productIds) {
            const deleted = await deleteSyntheticHistory(
                databases, config.databaseId, COLLECTIONS.PRICE_HISTORY,
                SYNTHETIC_REASON, productId
            );
            totalDeleted += deleted;
        }
        console.log(`  Deleted ${totalDeleted} documents.`);
    }

    // 6. Generate history payloads — each entry gets a random supermarket
    console.log('\n🔧 Generating price history (random supermarket per entry)...\n');

    const allPayloads = [];
    let skipped = 0;
    const supermarketUsage = new Map(); // track how many times each store is used

    const totalExpectedPoints = TIMELINE_BUCKETS.reduce((sum, b) => sum + b.pointCount, 0);

    for (const productId of productIds) {
        const { priceId, currentPrice } = productPriceMap.get(productId);
        const meta = productMetaMap.get(productId) || {};

        // Skip products that already have enough history (unless --force)
        if (!flags.force) {
            const existingCount = await countHistoryForProduct(
                databases, config.databaseId, COLLECTIONS.PRICE_HISTORY, productId
            );
            if (existingCount >= totalExpectedPoints) {
                skipped++;
                continue;
            }
        }

        const rng = createRng(hashString(productId));
        const timePoints = generateTimestamps(productId);
        const payloads = [];

        for (const tp of timePoints) {
            // Randomly pick a supermarket for this data point
            const smIdx = Math.floor(rng() * supermarketIds.length);
            const assignedSupermarketId = supermarketIds[smIdx];

            const price = computeHistoricalPrice(currentPrice, tp.yearsAgo, rng);

            payloads.push({
                priceId,
                price,
                productId,
                supermarketId: assignedSupermarketId,
                timestamp: tp.timestamp.toISOString(),
                isPromotional: false,
                priceChangeReason: SYNTHETIC_REASON,
            });

            // Track usage
            supermarketUsage.set(assignedSupermarketId, (supermarketUsage.get(assignedSupermarketId) || 0) + 1);
        }

        const oldest = payloads[0];
        const newest = payloads[payloads.length - 1];
        const storesUsed = new Set(payloads.map((p) => p.supermarketId)).size;
        console.log(
            `  ${meta.name || productId}: ${payloads.length} pts across ${storesUsed} stores, ` +
            `${oldest.price} TRY (${oldest.timestamp.slice(0, 10)}) → ` +
            `${newest.price} TRY (${newest.timestamp.slice(0, 10)}), ` +
            `current: ${currentPrice} TRY`
        );

        allPayloads.push(...payloads);
    }

    // Print supermarket distribution
    console.log('\n🏪 Supermarket distribution:');
    for (const [smId, count] of supermarketUsage.entries()) {
        const name = supermarketNameMap.get(smId) || smId;
        const pct = ((count / allPayloads.length) * 100).toFixed(1);
        console.log(`    ${name}: ${count} entries (${pct}%)`);
    }

    console.log(`\n📋 Summary:`);
    console.log(`  Supermarkets:     ${supermarkets.length} (randomized per entry)`);
    console.log(`  Products to seed: ${productIds.length - skipped}`);
    console.log(`  Skipped:          ${skipped} (already have enough history)`);
    console.log(`  Total rows:       ${allPayloads.length}`);
    console.log(`  Dry run:          ${flags.dryRun}`);

    if (flags.dryRun) {
        console.log('\n🔍 Sample payloads (first 5):');
        console.log(JSON.stringify(allPayloads.slice(0, 5), null, 2));
        console.log('\n✅ Dry run complete. No data was written.');
        return;
    }

    if (allPayloads.length === 0) {
        console.log('\n✅ Nothing to insert.');
        return;
    }

    // 7. Confirm before writing
    const confirm = await ask(`\n⚠️  About to insert ${allPayloads.length} price history rows. Continue? (y/N): `);
    if (confirm.toLowerCase() !== 'y') {
        console.log('Aborted.');
        return;
    }

    // 8. Insert into Appwrite
    console.log('\n📤 Inserting rows...');

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
            if (s.processed % 50 === 0 || s.processed === s.total) {
                const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                const rate = (s.created / elapsed).toFixed(1);
                process.stdout.write(
                    `\r  Progress: ${s.processed}/${s.total} (created ${s.created}, failed ${s.failed}, ${rate}/s)`
                );
            }
        },
    });

    console.log(`\n\n✅ Done. Created: ${created}, Failed: ${failed}`);
    if (errors.length) console.error('Errors:', errors.slice(0, 8));
    if (failed > 0) process.exit(1);
};

run().catch((err) => {
    console.error('Seed price history (spread) failed:', err.message || err);
    process.exit(1);
});
