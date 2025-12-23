import { Client, Databases, ID, Query } from 'node-appwrite';

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

async function testRelationshipCreation() {
    console.log('🧪 Testing Relationship Creation\n');

    try {
        // 1. Get an existing product
        const productsRes = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            [Query.limit(1)]
        );

        if (productsRes.documents.length === 0) {
            console.log('❌ No products found. Run seedDatabase.js first');
            return;
        }

        const product = productsRes.documents[0];
        console.log(`📦 Using Product: ${product.name}`);
        console.log(`   ID: ${product.$id}`);
        console.log(`   Type: ${typeof product.$id}`);

        // 2. Get an existing supermarket
        const supermarketsRes = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.SUPERMARKETS,
            [Query.limit(1)]
        );

        const supermarket = supermarketsRes.documents[0];
        console.log(`\n🏪 Using Supermarket: ${supermarket.name}`);
        console.log(`   ID: ${supermarket.$id}`);
        console.log(`   Type: ${typeof supermarket.$id}`);

        // 3. Try creating a price with different relationship formats
        console.log('\n🔬 Attempting to create price with relationships...\n');

        const testCases = [
            {
                name: 'String ID',
                data: {
                    price: 99.99,
                    currency: 'TRY',
                    userId: 'test',
                    products: product.$id,
                    supermarkets: supermarket.$id
                }
            },
            {
                name: 'Array with String ID',
                data: {
                    price: 99.99,
                    currency: 'TRY',
                    userId: 'test',
                    products: [product.$id],
                    supermarkets: [supermarket.$id]
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`Testing: ${testCase.name}`);
            console.log(`  Data:`, JSON.stringify(testCase.data, null, 2));

            try {
                const created = await databases.createDocument(
                    CONFIG.DATABASE_ID,
                    CONFIG.COLLECTIONS.PRICES,
                    ID.unique(),
                    testCase.data
                );

                console.log(`  ✅ Created successfully!`);

                // Fetch it back WITH expansion to see what was saved
                const fetched = await databases.getDocument(
                    CONFIG.DATABASE_ID,
                    CONFIG.COLLECTIONS.PRICES,
                    created.$id,
                    [Query.select(['*', 'products.*', 'supermarkets.*'])]
                );

                console.log(`  📋 Fetched back:`);
                console.log(`     Products field:`, fetched.products);
                console.log(`     Supermarkets field:`, fetched.supermarkets);

                // Cleanup
                await databases.deleteDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.PRICES, created.$id);
                console.log(`  🗑️  Cleaned up test document\n`);

                // If this worked, we found the solution!
                if (fetched.products && fetched.products.length > 0) {
                    console.log(`\n✅ SUCCESS! "${testCase.name}" format works!`);
                    console.log(`   Use this format in seedDatabase.js`);
                    break;
                }

            } catch (error) {
                console.log(`  ❌ Failed: ${error.message}\n`);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testRelationshipCreation().catch(console.error);
