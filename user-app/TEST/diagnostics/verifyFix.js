
import { Client, Databases, Query } from 'node-appwrite';

const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY,
    COLLECTIONS: {
        CATEGORIES: 'category',
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection'
    }
};

const client = new Client()
    .setEndpoint(CONFIG.ENDPOINT)
    .setProject(CONFIG.PROJECT_ID);

if (CONFIG.API_KEY) {
    client.setKey(CONFIG.API_KEY);
}

const databases = new Databases(client);

const verifyFix = async () => {
    console.log('✅ Verifying Fix: Testing Explicit Query.select...\n');

    // 1. Test Fetching Price with Product & Supermarket Details
    try {
        console.log('--- 1. Testing Price Query (Mocking fetchAllPrices) ---');
        const prices = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            [
                Query.limit(1),
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'products.*', 'supermarkets.*']) // The FIX
            ]
        );

        if (prices.documents.length > 0) {
            const doc = prices.documents[0];
            const productName = doc.products ? (Array.isArray(doc.products) ? doc.products[0]?.name : doc.products.name) : 'MISSING';
            const superName = doc.supermarkets ? (Array.isArray(doc.supermarkets) ? doc.supermarkets[0]?.name : doc.supermarkets.name) : 'MISSING';

            console.log(`Retrieved Price: ${doc.price} ${doc.currency}`);
            console.log(`Product Name: ${productName} ${productName !== 'MISSING' && productName !== undefined ? '✅' : '❌'}`);
            console.log(`Supermarket: ${superName} ${superName !== 'MISSING' && superName !== undefined ? '✅' : '❌'}`);
        } else {
            console.warn('⚠️ No prices found to verify.');
        }
    } catch (e) {
        console.error('❌ Price Query Failed:', e.message);
    }

    // 2. Test Fetching Product with Category Details
    try {
        console.log('\n--- 2. Testing Product Query (Mocking fetchProducts) ---');
        const products = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            [
                Query.limit(1),
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'categoryId.*']) // The FIX
            ]
        );

        if (products.documents.length > 0) {
            const doc = products.documents[0];
            const catRel = doc.categoryId;
            const catName = catRel ? (Array.isArray(catRel) ? catRel[0]?.categoryName : catRel.categoryName) : 'MISSING';

            console.log(`Retrieved Product: ${doc.name}`);
            console.log(`Category Name: ${catName} ${catName !== 'MISSING' && catName !== undefined ? '✅' : '❌'}`);
        } else {
            console.warn('⚠️ No products found to verify.');
        }
    } catch (e) {
        console.error('❌ Product Query Failed:', e.message);
    }
};

verifyFix();
