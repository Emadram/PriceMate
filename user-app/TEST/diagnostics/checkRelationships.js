import { Client, Databases, Query } from 'node-appwrite';

// Configuration - same as seed script
const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY, // Must be set in environment
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
} else {
    console.error('❌ Error: APPWRITE_API_KEY environment variable is not set.');
    console.log('Usage: export APPWRITE_API_KEY=your_api_key_here && node scripts/checkRelationships.js');
    process.exit(1);
}

const databases = new Databases(client);

const checkRelationships = async () => {
    console.log('🔍 Checking Database Relationships...\n');
    let hasIssues = false;

    // 1. Check Prices Collection
    try {
        console.log('--- Checking Prices Collection ---');
        const prices = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            [] // No query, just get latest
        );

        if (prices.documents.length === 0) {
            console.log('⚠️ No prices found. Run seed script first.');
            return;
        }

        const samplePrice = prices.documents[0];
        console.log(`Checking Sample Price ID: ${samplePrice.$id} `);
        console.log('Available Keys:', Object.keys(samplePrice));
        console.log('Full Document:', JSON.stringify(samplePrice, null, 2));

        // Check Products Relationship
        const prodRel = samplePrice.products;
        console.log(`\n[Products Relationship]`);
        console.log(`Type: ${Array.isArray(prodRel) ? 'Array' : typeof prodRel} `);
        console.log(`Value: `, JSON.stringify(prodRel, null, 2));

        if (!prodRel || (Array.isArray(prodRel) && prodRel.length === 0)) {
            console.error('❌ Products relationship is empty!');
            hasIssues = true;
        } else if (Array.isArray(prodRel) && typeof prodRel[0] === 'string') {
            console.warn('⚠️ Products relationship contains IDs (Strings), NOT full objects.');
            console.warn('   This means the frontend will see "Unknown Product" unless it fetches the product separately.');
            hasIssues = true;
        } else if (typeof prodRel === 'string') {
            console.warn('⚠️ Products relationship is a single ID string.');
            hasIssues = true;
        } else {
            console.log('✅ Products relationship appears to be expanded (contains objects).');
        }

        // Check Supermarkets Relationship
        const superRel = samplePrice.supermarkets;
        console.log(`\n[Supermarkets Relationship]`);
        console.log(`Type: ${Array.isArray(superRel) ? 'Array' : typeof superRel} `);
        console.log(`Value: `, JSON.stringify(superRel, null, 2));

        if (!superRel || (Array.isArray(superRel) && superRel.length === 0)) {
            console.error('❌ Supermarkets relationship is empty!');
            hasIssues = true;
        } else if (Array.isArray(superRel) && typeof superRel[0] === 'string') {
            console.warn('⚠️ Supermarkets relationship contains IDs (Strings), NOT full objects.');
            console.warn('   This means the frontend will see "Unknown Store" unless it fetches the store separately.');
            hasIssues = true;
        } else {
            console.log('✅ Supermarkets relationship appears to be expanded.');
        }

    } catch (error) {
        console.error('❌ Error checking prices:', error.message);
    }

    // 2. Check With Explicit Select
    try {
        console.log('\n--- Checking With Query.select ---');
        const prices = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            [
                Query.limit(1),
                Query.select(['*', 'products.$id', 'products.name', 'supermarkets.$id', 'supermarkets.name'])
            ]
        );

        if (prices.documents.length > 0) {
            const doc = prices.documents[0];
            console.log('Selected Documents keys:', Object.keys(doc));
            console.log('Products:', JSON.stringify(doc.products, null, 2));
            console.log('Supermarkets:', JSON.stringify(doc.supermarkets, null, 2));

            if (doc.products && doc.supermarkets) {
                console.log('✅ SUCCESS: Relationships found when using Query.select!');
            } else {
                console.error('❌ STILL MISSING: Even with Query.select, relationships are empty.');
            }
        }
    } catch (e) {
        console.error('Error with select:', e.message);
    }

    // Summary
    console.log('\n-----------------------------------');
    if (hasIssues) {
        console.log('❌ ISSUES DETECTED');
        console.log('If you see "contains IDs" warnings:');
        console.log('1. Appwrite usually returns only IDs for relationships by default.');
        console.log('2. The frontend must typically fetch the related document using that ID, OR');
        console.log('3. You (the developer) must rely on client-side expansion if possible (Data inspector showed IDs).');
    } else {
        console.log('✅ Relationships look correct (Expanded Objects).');
    }
};

checkRelationships();
