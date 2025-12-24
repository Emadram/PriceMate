import { Client, Databases, Query } from 'node-appwrite';

const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY || 'standard_a3546595e2c860047d6ecfd174373f2c26f3ef3109e896e838c16f93f17e06509b01ef9cc9427f12bfdf1dddbe4cea5def70bfb269ce62695fb26e09b53367e1262607d3c273e209cc2f2fa7515f80d95e12af54dcc061d906d889680da729731faaaab8df28940c17d0154eca8e4bb36380c5d89a2fe2741c5817636aaba1df',
    COLLECTIONS: {
        CATEGORIES: 'category',
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection'
    }
};

if (!CONFIG.API_KEY) {
    console.error('❌ Error: APPWRITE_API_KEY environment variable is required.');
    console.error('Usage: APPWRITE_API_KEY=your_api_key node TEST/clearDatabase.js');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(CONFIG.ENDPOINT)
    .setProject(CONFIG.PROJECT_ID)
    .setKey(CONFIG.API_KEY);

const databases = new Databases(client);

/**
 * Delete all documents from a collection
 */
async function clearCollection(collectionId, collectionName) {
    console.log(`\n🗑️  Clearing ${collectionName}...`);
    let totalDeleted = 0;

    try {
        while (true) {
            // Fetch documents (max 100 at a time due to Appwrite limits)
            const response = await databases.listDocuments(
                CONFIG.DATABASE_ID,
                collectionId,
                [Query.limit(100)]
            );

            if (response.documents.length === 0) {
                break; // No more documents
            }

            // Delete each document
            for (const doc of response.documents) {
                try {
                    await databases.deleteDocument(
                        CONFIG.DATABASE_ID,
                        collectionId,
                        doc.$id
                    );
                    totalDeleted++;
                } catch (error) {
                    console.error(`   ⚠️  Failed to delete document ${doc.$id}:`, error.message);
                }
            }

            console.log(`   Deleted ${response.documents.length} documents...`);
        }

        console.log(`✅ Cleared ${totalDeleted} documents from ${collectionName}`);
    } catch (error) {
        console.error(`❌ Error clearing ${collectionName}:`, error.message);
    }
}

async function clearDatabase() {
    console.log('🚨 WARNING: This will delete ALL data from the database!');
    console.log('Starting database cleanup in 3 seconds...');

    // Give user time to cancel if run by mistake
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🚀 Starting database cleanup...');

    // Delete in correct order (relationships first, then parent records)
    // 1. Delete Prices (has relationships to Products & Supermarkets)
    await clearCollection(CONFIG.COLLECTIONS.PRICES, 'Prices');

    // 2. Delete Products (has relationship to Categories)
    await clearCollection(CONFIG.COLLECTIONS.PRODUCTS, 'Products');

    // 3. Delete Supermarkets (no dependencies)
    await clearCollection(CONFIG.COLLECTIONS.SUPERMARKETS, 'Supermarkets');

    // 4. Delete Categories (no dependencies)
    await clearCollection(CONFIG.COLLECTIONS.CATEGORIES, 'Categories');

    console.log('\n✅ Database cleanup complete!');
    console.log('You can now run seedDatabase.js to repopulate with fresh data.');
}

clearDatabase().catch(console.error);
