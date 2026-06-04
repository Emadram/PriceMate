import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { listAllDocuments } from './lib/appwriteList.js';

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
    const flags = { dryRun: false, deletePrices: false, limit: null };
    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg === '--delete-prices') flags.deletePrices = true;
        else if (arg.startsWith('--limit=')) flags.limit = Number(arg.split('=')[1]) || null;
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

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

const databases = new Databases(client);

// Our deterministic barcodes follow: 869 + [1-8] + 7 digits + 0  (length 12)
const SEEDED_BARCODE_RE = /^869[1-8]\d{7}0$/;

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));
    const products = await listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries)
    );

    const seeded = products.filter((p) => SEEDED_BARCODE_RE.test(String(p.barcode || '').trim()));
    const toDelete = flags.limit ? seeded.slice(0, flags.limit) : seeded;

    console.log('Cleanup seeded products');
    console.log(`  Seeded products found: ${seeded.length}`);
    console.log(`  Will delete: ${toDelete.length}`);
    console.log(`  Also delete prices_collection rows: ${flags.deletePrices}`);

    if (flags.dryRun) {
        console.log('Dry run: no deletes.');
        console.log('Sample:', JSON.stringify(toDelete.slice(0, 3).map((p) => ({ id: p.$id, barcode: p.barcode, name: p.name })), null, 2));
        return;
    }

    for (const p of toDelete) {
        if (flags.deletePrices) {
            const priceDocs = await listAllDocuments((queries) =>
                databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, queries),
                [Query.equal('products', p.$id)]
            );
            for (const pr of priceDocs) {
                await databases.deleteDocument(config.databaseId, COLLECTIONS.PRICES, pr.$id);
            }
        }
        await databases.deleteDocument(config.databaseId, COLLECTIONS.PRODUCTS, p.$id);
    }

    console.log('Done.');
};

run().catch((err) => {
    console.error('Cleanup failed:', err.message || err);
    process.exit(1);
});

