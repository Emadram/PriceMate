
import { Client, Databases, Query } from 'node-appwrite';

const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY,
    COLLECTIONS: {
        PRODUCTS: 'products',
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

const fixDatabase = async () => {
    console.log('🔧 Starting Database Repair...\n');

    // 1. Create Full-Text Index for Search
    try {
        console.log('--- 1. Checking Search Index ---');
        // We cannot easily "check" if index exists without listing attributes/indexes, 
        // using createIndex directly usually throws if it exists, which is fine.
        console.log('Attempting to create Full-Text Index on "name"...');

        await databases.createIndex(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            'name_search_index', // Key
            'fulltext',          // Type
            ['name'],            // Attributes
            []                   // Orders (empty for fulltext)
        );
        console.log('✅ Index "name_search_index" created successfully!');
    } catch (error) {
        if (error.type === 'index_already_exists' || error.message.includes('already exists')) {
            console.log('✅ Index already exists (Skipping).');
        } else {
            console.error('❌ Failed to create index:', error.message);
            console.log('   (You might need to create it manually in Appwrite Console: Products > Indexes > Create Index > Key: name_search, Type: FullText, Attribute: name)');
        }
    }

    // 2. Clean up Orphan Prices (Prices with no Product)
    try {
        console.log('\n--- 2. Cleaning Orphan Prices ---');
        const prices = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            [
                Query.limit(500),
                Query.select(['$id', 'products.$id']) // Only need to check valid relationship
            ]
        );

        let deletedCount = 0;
        for (const price of prices.documents) {
            // Check if products relationship is empty
            // Appwrite returns empty array [] for empty relationships
            const productRel = price.products;

            // It is orphan if productRel is null, undefined, or an empty array
            const isOrphan = !productRel || (Array.isArray(productRel) && productRel.length === 0);

            if (isOrphan) {
                console.log(`🗑️ Deleting Orphan Price ID: ${price.$id}`);
                await databases.deleteDocument(
                    CONFIG.DATABASE_ID,
                    CONFIG.COLLECTIONS.PRICES,
                    price.$id
                );
                deletedCount++;
            }
        }

        if (deletedCount === 0) {
            console.log('✅ No orphan prices found.');
        } else {
            console.log(`✅ Cleaned up ${deletedCount} orphan prices.`);
        }

    } catch (error) {
        console.error('❌ Error cleaning prices:', error.message);
    }
};

fixDatabase();
