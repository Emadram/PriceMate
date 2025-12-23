import { Client, Databases, Query } from 'node-appwrite';

const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY,
    COLLECTIONS: {
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection'
    }
};

const client = new Client()
    .setEndpoint(CONFIG.ENDPOINT)
    .setProject(CONFIG.PROJECT_ID)
    .setKey(CONFIG.API_KEY);

const databases = new Databases(client);

async function inspectDatabase() {
    console.log('🔍 Database Inspection Report\n');

    // Count products
    const products = await databases.listDocuments(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.PRODUCTS, [Query.limit(1)]);
    console.log(`📦 Products: ${products.total} total`);

    // Count supermarkets
    const supermarkets = await databases.listDocuments(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.SUPERMARKETS, [Query.limit(1)]);
    console.log(`🏪 Supermarkets: ${supermarkets.total} total`);

    // Count prices WITH relationship expansion
    const prices = await databases.listDocuments(
        CONFIG.DATABASE_ID,
        CONFIG.COLLECTIONS.PRICES,
        [
            Query.limit(5),
            Query.select(['*', 'products.*', 'supermarkets.*'])
        ]
    );
    console.log(`💰 Prices: ${prices.total} total\n`);

    // Inspect first price entry
    if (prices.documents.length > 0) {
        console.log('🔎 Inspecting first price entry:');
        const firstPrice = prices.documents[0];
        console.log('Raw data:', JSON.stringify(firstPrice, null, 2));
        console.log('\n📋 Analysis:');
        console.log(`   Price value: ${firstPrice.price}`);
        console.log(`   Products field type: ${Array.isArray(firstPrice.products) ? 'array' : typeof firstPrice.products}`);
        console.log(`   Products field content:`, firstPrice.products);
        console.log(`   Supermarkets field type: ${Array.isArray(firstPrice.supermarkets) ? 'array' : typeof firstPrice.supermarkets}`);
        console.log(`   Supermarkets field content:`, firstPrice.supermarkets);
    }

    console.log('\n⚠️  Recommended actions:');
    if (prices.total > 50) {
        console.log('   - You have old data. Run: node TEST/clearDatabase.js');
    }
    console.log('   - Then run: node TEST/seedDatabase.js');
}

inspectDatabase().catch(console.error);
