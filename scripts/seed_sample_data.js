import { Client, Databases, ID, Query } from 'node-appwrite';
import { DEFAULT_OPENING_HOURS_JSON } from './lib/storeHoursDefaults.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY,
    seedUserId: process.env.SEED_USER_ID
};

if (!config.projectId || !config.databaseId) {
    console.error('Missing VITE_APPWRITE_PROJECT_ID or VITE_APPWRITE_DATABASE_ID.');
    process.exit(1);
}

if (!config.apiKey) {
    console.error('Missing APPWRITE_API_KEY. Seed requires admin key.');
    process.exit(1);
}

if (!config.seedUserId) {
    console.error('Missing SEED_USER_ID. Provide a valid user id for price records.');
    process.exit(1);
}

const COLLECTIONS = {
    CATEGORIES: process.env.VITE_APPWRITE_COLLECTION_CATEGORIES || 'category',
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    SUPERMARKETS: process.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets',
    PRICES: process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection'
};

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

const databases = new Databases(client);

const categories = [
    { categoryName: 'Dairy' },
    { categoryName: 'Bakery' },
    { categoryName: 'Snacks' },
    { categoryName: 'Beverages' }
];

const supermarkets = [
    {
        name: 'FreshMart',
        branchName: 'Main',
        latitude: 41.0082,
        longitude: 28.9784,
        address: 'Istiklal Cad. 1, Istanbul',
        icon: 'store',
        googleMapsUrl: 'https://maps.google.com/?q=41.0082,28.9784',
        rating: 4.5,
        reviewsCount: 128,
        openingHours: DEFAULT_OPENING_HOURS_JSON,
    },
    {
        name: 'GreenGrocer',
        branchName: 'Central',
        latitude: 39.9334,
        longitude: 32.8597,
        address: 'Ataturk Bulv. 10, Ankara',
        icon: 'store',
        googleMapsUrl: 'https://maps.google.com/?q=39.9334,32.8597',
        rating: 3.5,
        reviewsCount: 42,
        openingHours: DEFAULT_OPENING_HOURS_JSON,
    }
];

const products = [
    {
        name: 'Whole Milk 1L',
        barcode: '8690000000001',
        imageUrl: 'https://via.placeholder.com/256?text=Milk',
        stockQuantity: 25,
        category: 'Dairy',
        brand: 'FarmCo',
        unit: '1L'
    },
    {
        name: 'Sourdough Bread',
        barcode: '8690000000002',
        imageUrl: 'https://via.placeholder.com/256?text=Bread',
        stockQuantity: 18,
        category: 'Bakery',
        brand: 'Bakers',
        unit: '500g'
    },
    {
        name: 'Salted Chips',
        barcode: '8690000000003',
        imageUrl: 'https://via.placeholder.com/256?text=Chips',
        stockQuantity: 40,
        category: 'Snacks',
        brand: 'Crunch',
        unit: '150g'
    },
    {
        name: 'Sparkling Water',
        barcode: '8690000000004',
        imageUrl: 'https://via.placeholder.com/256?text=Water',
        stockQuantity: 30,
        category: 'Beverages',
        brand: 'AquaPure',
        unit: '750ml'
    }
];

const prices = [
    { product: 'Whole Milk 1L', supermarket: 'FreshMart', price: 34.5 },
    { product: 'Whole Milk 1L', supermarket: 'GreenGrocer', price: 33.9 },
    { product: 'Sourdough Bread', supermarket: 'FreshMart', price: 28.0 },
    { product: 'Salted Chips', supermarket: 'GreenGrocer', price: 19.5 },
    { product: 'Sparkling Water', supermarket: 'FreshMart', price: 15.0 }
];

const ensureCategory = async (category) => {
    const existing = await databases.listDocuments(config.databaseId, COLLECTIONS.CATEGORIES, [
        Query.equal('categoryName', category.categoryName),
        Query.limit(1)
    ]);
    if (existing.documents.length > 0) return existing.documents[0];
    return databases.createDocument(config.databaseId, COLLECTIONS.CATEGORIES, ID.unique(), category);
};

const ensureSupermarket = async (market) => {
    const existing = await databases.listDocuments(config.databaseId, COLLECTIONS.SUPERMARKETS, [
        Query.equal('name', market.name),
        Query.equal('branchName', market.branchName),
        Query.limit(1)
    ]);
    if (existing.documents.length > 0) return existing.documents[0];
    return databases.createDocument(config.databaseId, COLLECTIONS.SUPERMARKETS, ID.unique(), market);
};

const ensureProduct = async (product, categoryId) => {
    const existing = await databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, [
        Query.equal('barcode', product.barcode),
        Query.limit(1)
    ]);
    if (existing.documents.length > 0) return existing.documents[0];

    const payload = {
        name: product.name,
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        stockQuantity: product.stockQuantity,
        categoryId: categoryId || null,
        brand: product.brand,
        unit: product.unit
    };

    return databases.createDocument(config.databaseId, COLLECTIONS.PRODUCTS, ID.unique(), payload);
};

const ensurePrice = async (productId, supermarketId, value) => {
    const existing = await databases.listDocuments(config.databaseId, COLLECTIONS.PRICES, [
        Query.equal('products', productId),
        Query.equal('supermarkets', supermarketId),
        Query.limit(1)
    ]);
    if (existing.documents.length > 0) return existing.documents[0];

    const payload = {
        price: value,
        userId: config.seedUserId,
        products: productId,
        supermarkets: supermarketId,
        currency: 'TL',
        stockStatus: 'in_stock'
    };

    return databases.createDocument(config.databaseId, COLLECTIONS.PRICES, ID.unique(), payload);
};

const run = async () => {
    console.log('Seeding sample data...');

    const categoryDocs = {};
    for (const category of categories) {
        const doc = await ensureCategory(category);
        categoryDocs[category.categoryName] = doc;
    }

    const supermarketDocs = {};
    for (const market of supermarkets) {
        const doc = await ensureSupermarket(market);
        supermarketDocs[market.name] = doc;
    }

    const productDocs = {};
    for (const product of products) {
        const categoryDoc = categoryDocs[product.category];
        const doc = await ensureProduct(product, categoryDoc?.$id);
        productDocs[product.name] = doc;
    }

    for (const entry of prices) {
        const productDoc = productDocs[entry.product];
        const supermarketDoc = supermarketDocs[entry.supermarket];
        if (!productDoc || !supermarketDoc) continue;
        await ensurePrice(productDoc.$id, supermarketDoc.$id, entry.price);
    }

    console.log('Sample data seed complete.');
};

run().catch((error) => {
    console.error('Seed failed:', error.message || error);
    process.exit(1);
});
