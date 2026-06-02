import { Client, Databases, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    listAllDocuments,
    createDocumentsInBatches,
    resolveRelationId,
    countDocuments,
} from './lib/appwriteList.js';

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
};

const CANONICAL_CATEGORIES = [
    { name: 'Beverage', key: 'beverage', digit: '1' },
    { name: 'Snacks', key: 'snacks', digit: '2' },
    { name: 'Dairy', key: 'dairy', digit: '3' },
    { name: 'Bakery', key: 'bakery', digit: '4' },
    { name: 'Seafood', key: 'seafood', digit: '5' },
    { name: 'Fruit', key: 'fruit', digit: '6' },
    { name: 'Frozen', key: 'frozen', digit: '7' },
    { name: 'Canned', key: 'canned', digit: '8' },
];

const normalizeCategoryName = (value) => String(value || '').trim().toLowerCase();

const parseArgs = (argv) => {
    const flags = {
        dryRun: false,
        category: null,
        perCategory: 25,
        maxTotal: null,
        concurrency: 8,
    };

    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg.startsWith('--category=')) flags.category = arg.split('=')[1] || null;
        else if (arg.startsWith('--per-category=')) flags.perCategory = Number(arg.split('=')[1]) || 25;
        else if (arg.startsWith('--max-total=')) flags.maxTotal = Number(arg.split('=')[1]) || null;
        else if (arg.startsWith('--concurrency=')) flags.concurrency = Number(arg.split('=')[1]) || 8;
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

const listCategories = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.CATEGORIES, queries));

const listProducts = async () =>
    listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries));

const categoryTemplatePool = {
    beverage: {
        brands: ['Coca-Cola', 'Pepsi', 'Uludağ', 'Sütaş', 'Dimes', 'FuzeTea', 'Lipton', 'Pınar'],
        items: [
            { base: 'Cola', units: ['330ml', '1L', '2L'] },
            { base: 'Sparkling Water', units: ['200ml', '750ml', '1L'] },
            { base: 'Orange Juice', units: ['200ml', '1L'] },
            { base: 'Iced Tea', units: ['330ml', '1L'] },
            { base: 'Ayran', units: ['250ml', '1L'] },
        ],
    },
    snacks: {
        brands: ['Doritos', 'Lays', 'Ülker', 'Eti', 'Tadım', 'Ruffles', 'Pringles', 'Çerezza'],
        items: [
            { base: 'Potato Chips', units: ['70g', '150g'] },
            { base: 'Corn Chips', units: ['75g', '150g'] },
            { base: 'Chocolate Bar', units: ['35g', '60g', '80g'] },
            { base: 'Biscuit', units: ['100g', '200g'] },
            { base: 'Roasted Nuts Mix', units: ['150g', '300g'] },
        ],
    },
    dairy: {
        brands: ['Sütaş', 'Pınar', 'İçim', 'Sek', 'Torku', 'Yörsan'],
        items: [
            { base: 'Milk', units: ['1L'] },
            { base: 'Protein Milk', units: ['500ml', '1L'] },
            { base: 'Yogurt', units: ['500g', '1kg'] },
            { base: 'Cheese', units: ['200g', '400g'] },
            { base: 'Butter', units: ['250g'] },
        ],
    },
    bakery: {
        brands: ['Uno', 'Bimbo', 'Simit Sarayı', 'Local Bakery', 'Bakers'],
        items: [
            { base: 'Sliced Bread', units: ['500g'] },
            { base: 'Sourdough Bread', units: ['500g'] },
            { base: 'Bagel', units: ['4 pack'] },
            { base: 'Croissant', units: ['2 pack', '4 pack'] },
            { base: 'Simit', units: ['1 pc', '3 pack'] },
        ],
    },
    seafood: {
        brands: ['Dardanel', 'Sagra', 'Local Seafood'],
        items: [
            { base: 'Tuna', units: ['160g', '2x160g'] },
            { base: 'Salmon', units: ['200g', '400g'] },
            { base: 'Shrimp', units: ['250g'] },
            { base: 'Sardines', units: ['105g', '160g'] },
            { base: 'Anchovy', units: ['250g'] },
        ],
    },
    fruit: {
        brands: ['Fresh', 'Organic', 'Local Farm'],
        items: [
            { base: 'Banana', units: ['1kg'] },
            { base: 'Apple', units: ['1kg'] },
            { base: 'Orange', units: ['1kg'] },
            { base: 'Strawberry', units: ['500g'] },
            { base: 'Grapes', units: ['1kg'] },
        ],
    },
    frozen: {
        brands: ['SuperFresh', 'Iceland', 'Local Frozen'],
        items: [
            { base: 'Frozen Pizza', units: ['400g', '500g'] },
            { base: 'Frozen Fries', units: ['1kg'] },
            { base: 'Frozen Peas', units: ['450g', '1kg'] },
            { base: 'Ice Cream', units: ['500ml', '1L'] },
            { base: 'Frozen Chicken Nuggets', units: ['700g', '1kg'] },
        ],
    },
    canned: {
        brands: ['Tamek', 'Tat', 'Dardanel', 'Pınar', 'Supermarket Brand'],
        items: [
            { base: 'Canned Tomatoes', units: ['400g', '800g'] },
            { base: 'Canned Beans', units: ['400g'] },
            { base: 'Canned Corn', units: ['300g'] },
            { base: 'Canned Chickpeas', units: ['400g'] },
            { base: 'Canned Soup', units: ['400g'] },
        ],
    },
};

const variantAdjectives = ['Classic', 'Zero', 'Light', 'Original', 'Premium', 'Family', 'Mini', 'Max'];

const buildTemplate = (catKey, index) => {
    const pool = categoryTemplatePool[catKey] || categoryTemplatePool.beverage;
    const item = pool.items[index % pool.items.length];
    const unit = item.units[Math.floor(index / pool.items.length) % item.units.length];
    const brand = pool.brands[index % pool.brands.length];
    const adj = variantAdjectives[index % variantAdjectives.length];
    const name = `${brand} ${adj} ${item.base} ${unit}`.replace(/\s+/g, ' ').trim();
    const stockQuantity = 10 + (index % 41);
    const imageUrl = `https://via.placeholder.com/256?text=${encodeURIComponent(item.base)}`;
    return { name, unit, brand, stockQuantity, imageUrl };
};

// Deterministic fake barcode. Not a valid EAN-13 checksum, but stable and unique by construction.
const buildBarcode = (categoryDigit, idx) => {
    const seq = String(idx + 1).padStart(7, '0'); // 1..9999999
    return `869${categoryDigit}${seq}0`; // 13-ish chars (can be 12/13 depending on schema constraints)
};

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));
    const perCategory = Math.max(0, Math.floor(flags.perCategory));

    const [categories, products, supermarketsCount, pricesCount, historyCount] = await Promise.all([
        listCategories(),
        listProducts(),
        countDocuments(databases, config.databaseId, COLLECTIONS.SUPERMARKETS),
        countDocuments(databases, config.databaseId, COLLECTIONS.PRICES),
        countDocuments(databases, config.databaseId, COLLECTIONS.PRICE_HISTORY),
    ]);

    const categoryIdByKey = new Map();
    for (const cat of categories) {
        const key = normalizeCategoryName(cat.categoryName);
        categoryIdByKey.set(key, cat.$id);
    }

    const selectedCategories = flags.category
        ? CANONICAL_CATEGORIES.filter((c) => normalizeCategoryName(c.name) === normalizeCategoryName(flags.category))
        : CANONICAL_CATEGORIES;

    const missing = selectedCategories.filter((c) => !categoryIdByKey.has(normalizeCategoryName(c.name)));

    console.log('Seed products by category');
    console.log(`  Categories in DB: ${categories.length}`);
    console.log(`  Products in DB: ${products.length}`);
    console.log(`  Supermarkets in DB: ${supermarketsCount}`);
    console.log(`  prices_collection in DB: ${pricesCount}`);
    console.log(`  price_history in DB: ${historyCount}`);
    console.log(`  Requested: ${selectedCategories.length} categories × ${perCategory} products`);
    console.log(`  Planned new products: ${selectedCategories.length * perCategory}`);
    if (missing.length) {
        console.error(`Missing categories (by name): ${missing.map((m) => m.name).join(', ')}`);
        process.exit(1);
    }

    // Existing barcode set to avoid collisions without per-row DB lookups.
    const existingBarcodes = new Set(products.map((p) => String(p.barcode || '').trim()).filter(Boolean));

    const payloads = [];
    let generated = 0;
    for (const cat of selectedCategories) {
        const catId = categoryIdByKey.get(normalizeCategoryName(cat.name));
        for (let i = 0; i < perCategory; i++) {
            const barcode = buildBarcode(cat.digit, i);
            if (existingBarcodes.has(barcode)) continue;

            const t = buildTemplate(cat.key, i);
            payloads.push({
                name: t.name,
                barcode,
                imageUrl: t.imageUrl,
                stockQuantity: t.stockQuantity,
                categoryId: catId,
                brand: t.brand,
                unit: t.unit,
                __meta: { category: cat.name },
            });
            generated += 1;
            if (flags.maxTotal && generated >= flags.maxTotal) break;
        }
        if (flags.maxTotal && generated >= flags.maxTotal) break;
    }

    console.log(`  New products to create (after dedupe): ${payloads.length}`);
    if (flags.dryRun) {
        console.log('Dry run: no writes.');
        console.log('Sample:', JSON.stringify(payloads.slice(0, 3), null, 2));
        return;
    }

    if (payloads.length === 0) {
        console.log('Nothing to insert.');
        return;
    }

    const createFn = (row) =>
        databases.createDocument(config.databaseId, COLLECTIONS.PRODUCTS, ID.unique(), {
            name: row.name,
            barcode: row.barcode,
            imageUrl: row.imageUrl,
            stockQuantity: row.stockQuantity,
            categoryId: row.categoryId,
            brand: row.brand,
            unit: row.unit,
        });

    const startedAt = Date.now();
    const { created, failed, errors } = await createDocumentsInBatches(payloads, createFn, {
        concurrency: flags.concurrency,
        onProgress: (s) => {
            if (s.processed % 100 === 0 || s.processed === s.total) {
                const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                const rate = (s.created / elapsed).toFixed(1);
                console.log(`  Progress: ${s.processed}/${s.total} (created ${s.created}, failed ${s.failed}, ${rate}/s)`);
            }
        },
    });

    console.log(`Done. Created: ${created}, Failed: ${failed}`);
    if (errors.length) console.error('Errors:', errors);
    if (failed > 0) process.exit(1);
};

run().catch((err) => {
    console.error('Seed products failed:', err.message || err);
    process.exit(1);
});

