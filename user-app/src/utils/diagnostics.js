import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { Query } from 'appwrite';

/**
 * Comprehensive diagnostic test for PriceMate data flow
 */
export const runDiagnostics = async () => {
    const results = {
        success: true,
        tests: [],
        summary: {}
    };

    console.log('🔍 Starting PriceMate Diagnostics...\n');

    // Test 1: Database Connection
    try {
        console.log('Test 1: Database Connection');
        await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            [Query.limit(1)]
        );
        results.tests.push({ name: 'Database Connection', status: 'PASS', message: 'Connected successfully' });
        console.log('✅ Database connection successful\n');
    } catch (error) {
        results.success = false;
        results.tests.push({ name: 'Database Connection', status: 'FAIL', message: error.message });
        console.error('❌ Database connection failed:', error.message, '\n');
        return results;
    }

    // Test 2: Products Collection
    try {
        console.log('Test 2: Products Collection');
        const productsResponse = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            [Query.limit(100)]
        );

        const productsCount = productsResponse.documents.length;
        results.summary.productsCount = productsCount;

        if (productsCount === 0) {
            results.tests.push({ name: 'Products Collection', status: 'WARN', message: 'No products found in database' });
            console.warn('⚠️  No products found in database\n');
        } else {
            results.tests.push({ name: 'Products Collection', status: 'PASS', message: `Found ${productsCount} products` });
            console.log(`✅ Found ${productsCount} products`);
            console.log('Sample product:', productsResponse.documents[0].name);
            console.log('Product structure:', Object.keys(productsResponse.documents[0]), '\n');
        }
    } catch (error) {
        results.success = false;
        results.tests.push({ name: 'Products Collection', status: 'FAIL', message: error.message });
        console.error('❌ Failed to fetch products:', error.message, '\n');
    }

    // Test 3: Prices Collection
    try {
        console.log('Test 3: Prices Collection');
        const pricesResponse = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRICES,
            [Query.limit(100)]
        );

        const pricesCount = pricesResponse.documents.length;
        results.summary.pricesCount = pricesCount;

        if (pricesCount === 0) {
            results.success = false;
            results.tests.push({ name: 'Prices Collection', status: 'FAIL', message: '⚠️  NO PRICES FOUND - This is the problem!' });
            console.error('❌ NO PRICES FOUND IN DATABASE - This is why prices don\'t show!');
            console.log('📝 ACTION REQUIRED: Add prices via Admin Panel\n');
        } else {
            results.tests.push({ name: 'Prices Collection', status: 'PASS', message: `Found ${pricesCount} prices` });
            console.log(`✅ Found ${pricesCount} prices`);
            console.log('Sample price:', pricesResponse.documents[0]);
            console.log('Price structure:', Object.keys(pricesResponse.documents[0]), '\n');
        }
    } catch (error) {
        results.success = false;
        results.tests.push({ name: 'Prices Collection', status: 'FAIL', message: error.message });
        console.error('❌ Failed to fetch prices:', error.message, '\n');
    }

    // Test 4: Prices with Relationships
    try {
        console.log('Test 4: Prices with Relationships');
        const pricesWithRelations = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRICES,
            [
                Query.limit(10),
                Query.select(['*', 'products.$id', 'products.name', 'supermarkets.$id', 'supermarkets.name'])
            ]
        );

        if (pricesWithRelations.documents.length > 0) {
            const samplePrice = pricesWithRelations.documents[0];
            const hasProductRelation = samplePrice.products && samplePrice.products.$id;
            const hasSupermarketRelation = samplePrice.supermarkets && samplePrice.supermarkets.$id;

            if (hasProductRelation && hasSupermarketRelation) {
                results.tests.push({ name: 'Price Relationships', status: 'PASS', message: 'Relationships working correctly' });
                console.log('✅ Price relationships working');
                console.log('Sample price with relations:', {
                    price: samplePrice.price,
                    product: samplePrice.products?.name,
                    supermarket: samplePrice.supermarkets?.name
                }, '\n');
            } else {
                results.success = false;
                results.tests.push({ name: 'Price Relationships', status: 'FAIL', message: 'Relationships not properly configured' });
                console.error('❌ Price relationships not working properly');
                console.log('Sample price:', samplePrice, '\n');
            }
        } else {
            results.tests.push({ name: 'Price Relationships', status: 'SKIP', message: 'No prices to test' });
            console.log('⏭️  Skipped - no prices to test\n');
        }
    } catch (error) {
        results.success = false;
        results.tests.push({ name: 'Price Relationships', status: 'FAIL', message: error.message });
        console.error('❌ Failed to fetch prices with relationships:', error.message, '\n');
    }

    // Test 5: Products with Categories
    try {
        console.log('Test 5: Products with Categories');
        const productsWithCategories = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            [
                Query.limit(10),
                Query.select(['*', 'categoryId.$id', 'categoryId.categoryName'])
            ]
        );

        if (productsWithCategories.documents.length > 0) {
            const sampleProduct = productsWithCategories.documents[0];
            const hasCategoryRelation = sampleProduct.categoryId && sampleProduct.categoryId.$id;

            if (hasCategoryRelation) {
                results.tests.push({ name: 'Product-Category Relationship', status: 'PASS', message: 'Category relationships working' });
                console.log('✅ Category relationships working');
                console.log('Sample product:', {
                    name: sampleProduct.name,
                    category: sampleProduct.categoryId?.categoryName || 'None'
                }, '\n');
            } else {
                results.tests.push({ name: 'Product-Category Relationship', status: 'WARN', message: 'Some products missing category' });
                console.warn('⚠️  Product missing category relationship');
                console.log('Sample product:', sampleProduct, '\n');
            }
        }
    } catch (error) {
        results.success = false;
        results.tests.push({ name: 'Product-Category Relationship', status: 'FAIL', message: error.message });
        console.error('❌ Failed to test category relationships:', error.message, '\n');
    }

    // Test 6: Data Flow Test
    try {
        console.log('Test 6: Data Flow Test (Products → Prices)');

        const allProducts = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            [Query.limit(10)]
        );

        const allPrices = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRICES,
            [
                Query.limit(100),
                Query.select(['*', 'products.$id', 'supermarkets.name'])
            ]
        );

        if (allProducts.documents.length > 0 && allPrices.documents.length > 0) {
            const testProduct = allProducts.documents[0];
            const productPrices = allPrices.documents.filter(
                price => price.products?.$id === testProduct.$id
            );

            if (productPrices.length > 0) {
                results.tests.push({ name: 'Data Flow Test', status: 'PASS', message: `Found ${productPrices.length} prices for product` });
                console.log(`✅ Data flow working: Found ${productPrices.length} prices for "${testProduct.name}"`);
                console.log('Prices:', productPrices.map(p => `${p.price} at ${p.supermarkets?.name || 'Unknown'}`), '\n');
            } else {
                results.tests.push({ name: 'Data Flow Test', status: 'WARN', message: 'Product exists but has no prices' });
                console.warn(`⚠️  Product "${testProduct.name}" has no prices assigned\n`);
            }
        } else {
            results.tests.push({ name: 'Data Flow Test', status: 'SKIP', message: 'Insufficient data to test' });
            console.log('⏭️  Skipped - need both products and prices\n');
        }
    } catch (error) {
        results.success = false;
        results.tests.push({ name: 'Data Flow Test', status: 'FAIL', message: error.message });
        console.error('❌ Data flow test failed:', error.message, '\n');
    }

    // Summary
    console.log('═══════════════════════════════════');
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('═══════════════════════════════════');
    console.log(`Products in database: ${results.summary.productsCount || 0}`);
    console.log(`Prices in database: ${results.summary.pricesCount || 0}`);
    console.log('\nTest Results:');
    results.tests.forEach(test => {
        const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : test.status === 'WARN' ? '⚠️' : '⏭️';
        console.log(`${icon} ${test.name}: ${test.message}`);
    });
    console.log('═══════════════════════════════════\n');

    // Recommendations
    console.log('💡 RECOMMENDATIONS:');
    if (results.summary.pricesCount === 0) {
        console.log('1. 🔴 CRITICAL: Add prices to the database via Admin Panel');
        console.log('   - Go to: http://localhost:5176/prices');
        console.log('   - Click "Add Price"');
        console.log('   - Select a product and supermarket');
        console.log('   - Enter a price');
    }
    if (results.summary.productsCount === 0) {
        console.log('2. 🔴 CRITICAL: Add products to the database via Admin Panel');
    }
    if (results.summary.productsCount > 0 && results.summary.pricesCount > 0) {
        console.log('✅ Database has data. If prices still don\'t show, check browser console.');
    }
    console.log('\n');

    return results;
};

// Export for use in debug page
export default runDiagnostics;
