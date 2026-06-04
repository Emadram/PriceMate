import { Client, Databases, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    listAllDocuments,
    countDocuments,
} from './lib/appwriteList.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const COLLECTIONS = {
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    PRICES: process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
};

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY,
};

const parseArgs = (argv) => {
    const flags = {
        apply: false,
        limit: null,
        concurrency: 4,
        checkpointFile: null,
        includePlaceholders: true,
    };

    for (const arg of argv) {
        if (arg === '--apply') flags.apply = true;
        else if (arg === '--dry-run') flags.apply = false;
        else if (arg.startsWith('--limit=')) flags.limit = Number(arg.split('=')[1]) || null;
        else if (arg.startsWith('--concurrency=')) flags.concurrency = Number(arg.split('=')[1]) || 4;
        else if (arg.startsWith('--checkpoint-file=')) flags.checkpointFile = arg.split('=')[1] || null;
        else if (arg === '--no-placeholders') flags.includePlaceholders = false;
    }

    return flags;
};

const resolveCheckpointPath = (flags) => {
    if (flags.checkpointFile) {
        return path.isAbsolute(flags.checkpointFile)
            ? flags.checkpointFile
            : path.join(__dirname, flags.checkpointFile);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return path.join(__dirname, '.checkpoints', `remove_invalid_images.${stamp}.json`);
};

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const loadCheckpoint = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return { processed: {} };
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { processed: parsed?.processed || {} };
    } catch {
        return { processed: {} };
    }
};

const saveCheckpoint = (filePath, checkpoint) => {
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
};

const looksLikePlaceholderUrl = (value) => {
    const url = String(value || '').trim().toLowerCase();
    if (!url) return false;
    if (url.includes('via.placeholder.com')) return true;
    if (url.includes('placehold.co')) return true;
    if (url.includes('dummyimage.com')) return true;
    return false;
};

const isInvalidImage = (product, { includePlaceholders }) => {
    const fields = [
        product.imageUrl,
        product.image,
        product.image_url,
        product.image_front_url,
    ];
    const trimmed = fields.map((v) => String(v || '').trim()).filter(Boolean);
    if (trimmed.length === 0) return true;
    if (includePlaceholders && trimmed.some((v) => looksLikePlaceholderUrl(v))) return true;
    // Your earlier broken uploads used the wrong bucket (SupermarketsLogo) which returns 403.
    if (trimmed.some((v) => v.includes('/storage/buckets/SupermarketsLogo/'))) return true;
    return false;
};

const deleteDocumentsInBatches = async (docs, deleteFn, { concurrency, onProgress }) => {
    const total = docs.length;
    let processed = 0;
    let deleted = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < docs.length; i += concurrency) {
        const chunk = docs.slice(i, i + concurrency);
        const results = await Promise.allSettled(chunk.map((doc) => deleteFn(doc)));
        processed += chunk.length;
        for (const r of results) {
            if (r.status === 'fulfilled') deleted += 1;
            else {
                failed += 1;
                if (errors.length < 8) errors.push(r.reason?.message || String(r.reason));
            }
        }
        onProgress?.({ processed, total, deleted, failed });
    }

    return { deleted, failed, errors };
};

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));
    const checkpointPath = resolveCheckpointPath(flags);
    ensureDir(path.dirname(checkpointPath));
    const checkpoint = loadCheckpoint(checkpointPath);

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

    const products = await listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries)
    );

    const invalid = products.filter((p) =>
        flags.apply ? isInvalidImage(p, { includePlaceholders: flags.includePlaceholders }) : isInvalidImage(p, { includePlaceholders: flags.includePlaceholders })
    );

    const pending = invalid.filter((p) => !checkpoint.processed[p.$id]);
    const target = flags.limit ? pending.slice(0, flags.limit) : pending;

    console.log('Remove products/prices with invalid (missing/placeholder) images');
    console.log(`  Total products: ${products.length}`);
    console.log(`  Invalid image products: ${invalid.length}`);
    console.log(`  Pending (not checkpointed): ${pending.length}`);
    console.log(`  Will process: ${target.length}`);
    console.log(`  Apply mode: ${flags.apply}`);
    console.log(`  Include placeholder URLs: ${flags.includePlaceholders}`);

    if (!target.length) {
        console.log('Nothing to do.');
        return;
    }

    // Dry-run estimate of price rows
    if (!flags.apply) {
        let totalPrices = 0;
        for (const p of target) {
            totalPrices += await countDocuments(databases, config.databaseId, COLLECTIONS.PRICES, [
                Query.equal('products', p.$id),
            ]);
        }
        console.log(`  Estimated price rows to delete (for target): ${totalPrices}`);
        return;
    }

    const startedAt = Date.now();

    for (let idx = 0; idx < target.length; idx++) {
        const product = target[idx];
        console.log(`  (${idx + 1}/${target.length}) Product ${product.$id}`);

        const priceDocs = await listAllDocuments(
            (queries) => databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, queries),
            [Query.equal('products', product.$id)]
        );

        if (priceDocs.length > 0) {
            await deleteDocumentsInBatches(
                priceDocs,
                (doc) => databases.deleteDocument(config.databaseId, COLLECTIONS.PRICES, doc.$id),
                {
                    concurrency: flags.concurrency,
                    onProgress: ({ processed, total, failed }) => {
                        if (processed % 50 === 0 || processed === total) {
                            const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                            console.log(`    prices: ${processed}/${total} (failed ${failed}, elapsed ${elapsed}s)`);
                        }
                    },
                }
            );
        }

        await databases.deleteDocument(config.databaseId, COLLECTIONS.PRODUCTS, product.$id);

        checkpoint.processed[product.$id] = { at: new Date().toISOString(), deleted: true };
        if (idx % 5 === 0 || idx === target.length - 1) {
            saveCheckpoint(checkpointPath, checkpoint);
        }
    }

    saveCheckpoint(checkpointPath, checkpoint);
    console.log('Done.');
};

run().catch((err) => {
    console.error('Cleanup failed:', err?.message || err);
    process.exit(1);
});

