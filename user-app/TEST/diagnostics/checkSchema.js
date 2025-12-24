import { Client, Databases } from 'node-appwrite';

const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY
};

const client = new Client()
    .setEndpoint(CONFIG.ENDPOINT)
    .setProject(CONFIG.PROJECT_ID)
    .setKey(CONFIG.API_KEY);

const databases = new Databases(client);

async function checkSchema() {
    console.log('🔍 Checking Prices Collection Schema\n');

    try {
        // Get collection metadata
        const collection = await databases.getCollection(
            CONFIG.DATABASE_ID,
            'prices_collection'
        );

        console.log('📋 Collection Attributes:');
        collection.attributes.forEach(attr => {
            console.log(`\n   Name: ${attr.key}`);
            console.log(`   Type: ${attr.type}`);
            if (attr.type === 'relationship') {
                console.log(`   Related Collection: ${attr.relatedCollection}`);
                console.log(`   Relationship Type: ${attr.relationType}`);
                console.log(`   Two Way: ${attr.twoWay}`);
            }
        });

        console.log('\n\n⚠️  EXPECTED relationship attributes:');
        console.log('   - "products" (relationship to products collection)');
        console.log('   - "supermarkets" (relationship to supermarkets collection)');

        const hasProducts = collection.attributes.some(a => a.key === 'products');
        const hasSupermarkets = collection.attributes.some(a => a.key === 'supermarkets');

        console.log('\n📊 Status:');
        console.log(`   ${hasProducts ? '✅' : '❌'} "products" relationship exists`);
        console.log(`   ${hasSupermarkets ? '✅' : '❌'} "supermarkets" relationship exists`);

        if (!hasProducts || !hasSupermarkets) {
            console.log('\n🚨 SCHEMA ISSUE DETECTED!');
            console.log('   Your Appwrite Prices collection is missing relationship attributes.');
            console.log('   You need to add them in the Appwrite Console:');
            console.log('   1. Go to Appwrite Console → Database → prices_collection');
            console.log('   2. Add attribute: "products" (Relationship to products, Many-to-One)');
            console.log('   3. Add attribute: "supermarkets" (Relationship to supermarkets, Many-to-One)');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSchema().catch(console.error);
