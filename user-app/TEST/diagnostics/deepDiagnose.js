import { Client, Databases, ID } from 'node-appwrite';

// Use the key provided by the user
const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY, // Will use key from env
    COLLECTIONS: {
        PRICES: 'prices_collection',
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets'
    }
};

const client = new Client()
    .setEndpoint(CONFIG.ENDPOINT)
    .setProject(CONFIG.PROJECT_ID)
    .setKey(CONFIG.API_KEY);

const databases = new Databases(client);

async function diagnose() {
    console.log('🕵️‍♂️ Starting Deep Diagnostics for Appwrite Relationships...\n');

    try {
        // 1. Inspect Collections
        console.log('1️⃣  Inspecting Schema Configuration...');
        const priceCollection = await databases.getCollection(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.PRICES);

        const productsAttr = priceCollection.attributes.find(a => a.key === 'products');
        const supermarketsAttr = priceCollection.attributes.find(a => a.key === 'supermarkets');

        console.log('\n[Attribute: products]');
        if (!productsAttr) console.error('❌ Attribute missing!');
        else {
            console.log(`   Type: ${productsAttr.type}`);
            console.log(`   Relation: ${productsAttr.relationType}`);
            console.log(`   TwoWay: ${productsAttr.twoWay}`);
            console.log(`   Related: ${productsAttr.relatedCollection}`);
            console.log(`   Side: ${productsAttr.side}`); // Parent or Child
        }

        console.log('\n[Attribute: supermarkets]');
        if (!supermarketsAttr) console.error('❌ Attribute missing!');
        else {
            console.log(`   Type: ${supermarketsAttr.type}`);
            console.log(`   Relation: ${supermarketsAttr.relationType}`);
            console.log(`   TwoWay: ${supermarketsAttr.twoWay}`);
            console.log(`   Related: ${supermarketsAttr.relatedCollection}`);
        }

        // 2. Permission Check Hint
        console.log('\n2️⃣  Analyzing Potential Permission Issues...');
        if (productsAttr && productsAttr.twoWay) {
            console.log('⚠️  "products" is a TWO-WAY relationship.');
            console.log('   This means creating a Price ALSO updates the Product document.');
            console.log('   Action Required: Ensure your API Key has "update" permission on the PRODUCTS collection.');
        }

        if (supermarketsAttr && supermarketsAttr.twoWay) {
            console.log('⚠️  "supermarkets" is a TWO-WAY relationship.');
            console.log('   Action Required: Ensure your API Key has "update" permission on the SUPERMARKETS collection.');
        }

        // 3. Live Test
        console.log('\n3️⃣  Running Live Relationship Test...');
        const timestamp = Date.now();

        // 1. Create a dummy category first (needed for product)
        const category = await databases.createDocument(
            CONFIG.DATABASE_ID,
            'category', // Correct ID from seed script
            ID.unique(),
            { categoryName: `TestCat_${timestamp}`, Icon: 'T' }
        );
        console.log(`   ✅ Created Temp Category: ${category.$id}`);

        // 2. Create dummy product
        const product = await databases.createDocument(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            ID.unique(),
            {
                name: `DiagProd_${timestamp}`,
                barcode: `${timestamp}`,
                // categoryName field doesn't exist, it's a relationship 'categoryId'
                categoryId: category.$id, // Should be string for Many-to-One
                imageUrl: 'http://example.com/img.jpg',
                description: 'Test Desc',
                stockQuantity: 10
            }
        );
        console.log(`   ✅ Created Temp Product: ${product.$id}`);

        // Create dummy supermarket
        const supermarket = await databases.createDocument(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.SUPERMARKETS,
            ID.unique(),
            {
                name: `DiagMarket_${timestamp}`,
                address: 'Test Address',
                phoneNumber: `${timestamp}`,
                email: `test_${timestamp}@test.com`,
                latitude: 0.0,
                longitude: 0.0,
                icon: 'T'
            }
        );
        console.log(`   ✅ Created Temp Supermarket: ${supermarket.$id}`);

        // Create Price
        const price = await databases.createDocument(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            ID.unique(),
            {
                price: 10.0,
                currency: 'TRY',
                userId: 'diagnose-script',
                products: [product.$id],
                supermarkets: [supermarket.$id]
            }
        );
        console.log(`   ✅ Created Price: ${price.$id}`);

        // Read Back
        const fetchedPrice = await databases.getDocument(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            price.$id
        );

        console.log('\n4️⃣  Result Verification:');
        console.log('   Full Fetched Price Object:', JSON.stringify(fetchedPrice, null, 2));

        const productsVal = fetchedPrice.products;
        const supermarketsVal = fetchedPrice.supermarkets;

        console.log(`   Saved Products Value: ${JSON.stringify(productsVal)}`);
        console.log(`   Saved Supermarkets Value: ${JSON.stringify(supermarketsVal)}`);

        // Check if it's an array and has length, or if it's an object (for single relation)
        const productsOk = Array.isArray(productsVal) ? productsVal.length > 0 : !!productsVal;
        const supermarketsOk = Array.isArray(supermarketsVal) ? supermarketsVal.length > 0 : !!supermarketsVal;

        if (productsOk && supermarketsOk) {
            console.log('\n🎉 SUCCESS! The relationship works correctly with this script.');
            console.log('   If your app is failing, check if the seed script uses different logic.');
        } else {
            console.log('\n❌ FAILURE! Appwrite ignored the relationship.');
            console.log('\n🚨 DIAGNOSIS & FIX:');
            console.log('1. The Relationship is likely Two-Way.');
            console.log('2. Your API Key might lack permission to update the Related collections (Products/Supermarkets).');
            console.log('3. OR the Relationship Attribute "onDelete" setting is set to something restrictive.');

            console.log('\n👉 SPECIFIC FIX TO TRY IN APPWRITE CONSOLE:');
            console.log('1. Go to Database -> prices_collection -> Attributes');
            console.log('2. Click "products"');
            console.log('3. Toggle "Two-Way" to OFF (One-way). This is usually safer for this use case.');
            console.log('   (Creating a price shouldn\'t necessarily modify the product document directly unless you want a list of prices ON the product document)');
            console.log('4. If you NEED Two-Way, ensure your API Key has "documents.write" (Update) access to ALL collections.');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await databases.deleteDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.PRICES, price.$id);
        await databases.deleteDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.PRODUCTS, product.$id);
        await databases.deleteDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.SUPERMARKETS, supermarket.$id);
        console.log('   Done.');

    } catch (error) {
        console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
        if (error.code === 401) console.log('   👉 Your API Key is invalid or has insufficient scopes.');
    }
}

diagnose();
