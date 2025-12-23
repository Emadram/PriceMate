import { Client, Databases, ID } from 'node-appwrite';

// Configuration (Replace with your keys if not using existing config)
const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    // API Key is required for admin actions (creating documents without being logged in)
    // The user must provide this when running the script
    API_KEY: process.env.APPWRITE_API_KEY
};

const COLLECTIONS = {
    CATEGORIES: 'category',
    PRODUCTS: 'products',
    SUPERMARKETS: 'supermarkets',
    PRICES: 'prices_collection',
    // FEEDBACK: 'feedback', // Not seeding feedback
    // USER_PROFILES: 'user_profiles' // Not seeding user profiles
};

if (!CONFIG.API_KEY) {
    console.error('❌ Error: APPWRITE_API_KEY environment variable is required.');
    console.error('Usage: APPWRITE_API_KEY=your_api_key node scripts/seedDatabase.js');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(CONFIG.ENDPOINT)
    .setProject(CONFIG.PROJECT_ID)
    .setKey(CONFIG.API_KEY);

const databases = new Databases(client);

// --- SAMPLE DATA ---

const CATEGORIES = [
    { name: 'Beverages', Icon: '🥤' },
    { name: 'Snacks', Icon: '🍟' },
    { name: 'Dairy', Icon: '🥛' },
    { name: 'Pantry', Icon: '🥫' },
    { name: 'Breakfast', Icon: '🥞' },
    { name: 'Personal Care', Icon: '🧴' }
];

const SUPERMARKETS = [
    {
        name: 'Carrefour',
        address: 'Istinye Park, Istanbul',
        phoneNumber: '+902121234567',
        email: 'contact@carrefour.com.tr',
        latitude: 41.1112,
        longitude: 29.0321,
        icon: '🛒'
    },
    {
        name: 'Migros',
        address: 'Kanyon Mall, Istanbul',
        phoneNumber: '+902129876543',
        email: 'info@migros.com.tr',
        latitude: 41.0783,
        longitude: 29.0118,
        icon: '🟠'
    },
    {
        name: 'BIM',
        address: 'Fatih, Istanbul',
        phoneNumber: '+902125551234',
        email: 'support@bim.com.tr',
        latitude: 41.0122,
        longitude: 28.9760,
        icon: '🅱️'
    },
    {
        name: 'A101',
        address: 'Kadikoy, Istanbul',
        phoneNumber: '+902164445566',
        email: 'iletisim@a101.com.tr',
        latitude: 40.9901,
        longitude: 29.0292,
        icon: '🅰️'
    },
    {
        name: 'Sok Market',
        address: 'Besiktas, Istanbul',
        phoneNumber: '+902122223344',
        email: 'musteri@sokmarket.com.tr',
        latitude: 41.0422,
        longitude: 29.0060,
        icon: '⚡'
    }
];

const PRODUCTS = [
    {
        name: 'Coca-Cola 330ml',
        barcode: '5449000000996',
        imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Refreshing carbonated soft drink',
        stockQuantity: 150,
        categoryName: 'Beverages'
    },
    {
        name: 'Ulker Chocolate Bar',
        barcode: '8690555111222',
        imageUrl: 'https://images.unsplash.com/photo-1511381971704-554472d42d31?w=500&auto=format&fit=crop&q=60',
        description: 'Milk chocolate with pistachios',
        stockQuantity: 300,
        categoryName: 'Snacks'
    },
    {
        name: 'Sutas Full Cream Milk 1L',
        barcode: '6281007000000',
        imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Fresh full cream milk',
        stockQuantity: 80,
        categoryName: 'Dairy'
    },
    {
        name: 'Nescafe Gold 200g',
        barcode: '7613035220065',
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Premium freeze-dried instant coffee',
        stockQuantity: 30,
        categoryName: 'Beverages'
    },
    {
        name: 'Nutella Hazelnut Spread',
        barcode: '8000500179864',
        imageUrl: 'https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Creamy hazelnut spread with cocoa',
        stockQuantity: 60,
        categoryName: 'Breakfast'
    },
    {
        name: 'Barilla Spaghetti No.5',
        barcode: '8076809513753',
        imageUrl: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Authentic Italian spaghetti',
        stockQuantity: 120,
        categoryName: 'Pantry'
    },
    {
        name: 'Pantene Shampoo 500ml',
        barcode: '5410076012345',
        imageUrl: 'https://images.unsplash.com/photo-1631729371254-42c2a89ddf0d?w=500&auto=format&fit=crop&q=60',
        description: 'Volume and body shampoo',
        stockQuantity: 70,
        categoryName: 'Personal Care'
    },
    {
        name: 'Red Apples 1kg',
        barcode: '2905556667778',
        imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=60',
        description: 'Fresh sweet red apples',
        stockQuantity: 200,
        categoryName: 'Snacks'
    },
    {
        name: 'Organic Eggs 15pcs',
        barcode: '8691234567890',
        imageUrl: 'https://images.unsplash.com/photo-1519241047957-be31d7379a5d?w=500&auto=format&fit=crop&q=60',
        description: 'Free-range organic eggs',
        stockQuantity: 60,
        categoryName: 'Dairy'
    },
    {
        name: 'Fairy Dish Soap 750ml',
        barcode: '5413149023456',
        imageUrl: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=500&auto=format&fit=crop&q=60',
        description: 'Lemon scented dishwashing liquid',
        stockQuantity: 95,
        categoryName: 'Pantry'
    }
];

// Helper to generate a random price based on a base price + variation
const generatePrices = (supermarkets, products, userId = 'seed-script-user') => {
    const prices = [];

    // Base prices for products
    const basePrices = {
        'Coca-Cola 330ml': 25.00,
        'Ulker Chocolate Bar': 15.00,
        'Sutas Full Cream Milk 1L': 45.00,
        'Nescafe Gold 200g': 250.00,
        'Nutella Hazelnut Spread': 180.00,
        'Barilla Spaghetti No.5': 40.00,
        'Pantene Shampoo 500ml': 85.00,
        'Red Apples 1kg': 25.00,
        'Organic Eggs 15pcs': 65.00,
        'Fairy Dish Soap 750ml': 45.00
    };

    products.forEach(product => {
        const basePrice = basePrices[product.name] || 50.00;

        // UPDATED: Add price for EVERY supermarket to ensure complete coverage
        supermarkets.forEach(supermarket => {
            const variation = (Math.random() * 10) - 5; // +/- 5 TL variation
            const finalPrice = parseFloat((basePrice + variation).toFixed(2));

            prices.push({
                price: finalPrice,
                currency: 'TRY',
                userId: userId,
                // Appwrite Many-to-One expects a single string ID, not an array
                products: product.$id,
                supermarkets: supermarket.$id
            });
        });
    });

    return prices;
};

// --- SEEDING LOGIC ---

async function seed() {
    console.log('🚀 Starting database seeding...');

    const categoryMap = {}; // Name -> ID
    const supermarketIds = [];
    const productIds = [];

    // 1. Seed Categories
    console.log('\n📦 Seeding Categories...');
    for (const cat of CATEGORIES) {
        try {
            // Check if exists (not strictly necessary for seed script but good practice)
            // For simplicity, we just create. Unique constraint should handle duplicates if set,
            // or we just accumulate.
            const doc = await databases.createDocument(
                CONFIG.DATABASE_ID,
                COLLECTIONS.CATEGORIES,
                ID.unique(),
                {
                    categoryName: cat.name,
                    Icon: cat.Icon
                }
            );
            categoryMap[cat.name] = doc.$id;
            console.log(`✅ Created Category: ${cat.name}`);
        } catch (error) {
            console.error(`⚠️ Failed to create category ${cat.name}:`, error.message);
        }
    }

    // 2. Seed Supermarkets
    console.log('\n🏪 Seeding Supermarkets...');
    const createdSupermarkets = [];
    for (const sup of SUPERMARKETS) {
        try {
            const doc = await databases.createDocument(
                CONFIG.DATABASE_ID,
                COLLECTIONS.SUPERMARKETS,
                ID.unique(),
                sup
            );
            createdSupermarkets.push(doc);
            console.log(`✅ Created Supermarket: ${sup.name}`);
        } catch (error) {
            console.error(`⚠️ Failed to create supermarket ${sup.name}:`, error.message);
        }
    }

    // 3. Seed Products
    console.log('\n🍎 Seeding Products...');
    const createdProducts = [];
    for (const prod of PRODUCTS) {
        try {
            const categoryId = categoryMap[prod.categoryName];
            if (!categoryId) {
                console.warn(`⚠️ Category not found for product ${prod.name}, skipping.`);
                continue;
            }

            const doc = await databases.createDocument(
                CONFIG.DATABASE_ID,
                COLLECTIONS.PRODUCTS,
                ID.unique(),
                {
                    name: prod.name,
                    barcode: prod.barcode,
                    imageUrl: prod.imageUrl,
                    description: prod.description,
                    stockQuantity: prod.stockQuantity,
                    categoryId: categoryId
                }
            );
            createdProducts.push(doc);
            console.log(`✅ Created Product: ${prod.name}`);
        } catch (error) {
            console.error(`⚠️ Failed to create product ${prod.name}:`, error.message);
        }
    }

    // 4. Seed Prices
    console.log('\n💰 Seeding Prices...');

    // Validate we have products and supermarkets before generating prices
    if (createdProducts.length === 0) {
        console.error('❌ No products created. Cannot generate prices.');
        return;
    }
    if (createdSupermarkets.length === 0) {
        console.error('❌ No supermarkets created. Cannot generate prices.');
        return;
    }

    console.log(`📊 Generating prices for ${createdProducts.length} products across ${createdSupermarkets.length} supermarkets...`);
    const prices = generatePrices(createdSupermarkets, createdProducts);

    console.log(`🔍 Validation: All prices use existing products and supermarkets:`);
    console.log(`   - Products with prices: ${createdProducts.length}`);
    console.log(`   - Supermarkets with prices: ${createdSupermarkets.length}`);
    console.log(`   - Total price combinations: ${prices.length} (${createdProducts.length} × ${createdSupermarkets.length})`);

    let successCount = 0;
    let errorCount = 0;

    for (const price of prices) {
        try {
            // Validate IDs before sending
            const productId = price.products[0];
            const supermarketId = price.supermarkets[0];

            if (!productId || !supermarketId) {
                console.error(`❌ Invalid IDs - Product: ${productId}, Supermarket: ${supermarketId}`);
                errorCount++;
                continue;
            }

            const created = await databases.createDocument(
                CONFIG.DATABASE_ID,
                COLLECTIONS.PRICES,
                ID.unique(),
                price
            );

            successCount++;
            if (successCount === 1 || successCount % 10 === 0) {
                console.log(`   Created ${successCount} prices...`);
            }
        } catch (error) {
            errorCount++;
            console.error(`❌ Failed to create price: ${error.message}`);
            console.error(`   Data:`, JSON.stringify(price, null, 2));
            if (errorCount > 5) {
                console.error(`Too many errors, stopping seed...`);
                break;
            }
        }
    }
    console.log(`✅ Successfully created ${successCount} price entries.`);
    if (errorCount > 0) {
        console.log(`⚠️  Failed to create ${errorCount} price entries.`);
    }

    console.log('\n🎉 Database seeding completed!');
}

seed().catch(console.error);
