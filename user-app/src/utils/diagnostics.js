import { db, Query } from '../lib/appwrite';

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
        await db.products.list([Query.limit(1)]);
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
        const productsResponse = await db.products.list([Query.limit(100)]);

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
        const pricesResponse = await db.prices.list([Query.limit(100)]);

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
        const pricesWithRelations = await db.prices.list(
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
        const productsWithCategories = await db.products.list(
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

        const allProducts = await db.products.list([Query.limit(10)]);

        const allPrices = await db.prices.list(
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

    // Test 7: Data Integrity & Future readiness
    let allPricesResult = null;
    let allProductsResult = null;
    try {
        console.log('Test 7: Data Integrity & Business Logic');
        const integrityResults = { supermarkets: [], prices: [], products: [], history: null, orphans: [] };

        // 1. Supermarket Coordinates (Turkey Range)
        const allSupermarkets = await db.supermarkets.list([Query.limit(100)]);
        allSupermarkets.documents.forEach(s => {
            // Updated range for Turkey: Lat 36-42, Lon 26-45
            const validLat = s.latitude >= 36 && s.latitude <= 42;
            const validLon = s.longitude >= 26 && s.longitude <= 45;
            if (!validLat || !validLon) {
                integrityResults.supermarkets.push(`${s.name}: invalid coords (${s.latitude}, ${s.longitude})`);
            }
        });

        // 2. Prices & Currency & Supermarket Relation
        allPricesResult = await db.prices.list(
            [Query.limit(500), Query.select(['$id', 'price', 'currency', 'products.$id', 'supermarkets.$id'])]
        );
        const allowedCurrencies = new Set(['TL', 'TRY', 'USD', 'EUR', 'GBP']);
        allPricesResult.documents.forEach(p => {
            if (p.price <= 0) integrityResults.prices.push(`Price ${p.$id}: non-positive value (${p.price})`);
            if (!p.currency) integrityResults.prices.push(`Price ${p.$id}: missing currency`);
            if (p.currency && !allowedCurrencies.has(String(p.currency).trim().toUpperCase())) {
                integrityResults.prices.push(`Price ${p.$id}: unexpected currency (${p.currency})`);
            }
            if (!p.supermarkets || !p.supermarkets.$id) integrityResults.prices.push(`Price ${p.$id}: missing supermarket relation`);
        });

        // 3. Products & Orphaned Prices & Category Relation
        allProductsResult = await db.products.list(
            [Query.limit(500), Query.select(['$id', 'categoryId.$id'])]
        );
        const productIds = new Set(allProductsResult.documents.map(p => p.$id));
        allProductsResult.documents.forEach(p => {
            if (!p.categoryId || !p.categoryId.$id) {
                integrityResults.products.push(`Product ${p.$id}: missing category relation`);
            }
        });
        allPricesResult.documents.forEach(p => {
            if (p.products?.$id && !productIds.has(p.products.$id)) {
                integrityResults.orphans.push(p.$id);
            } else if (!p.products || !p.products.$id) {
                integrityResults.orphans.push(`Price ${p.$id}: absolutely no product relation`);
            }
        });

        // 4. Price History Collection
        try {
            await db.priceHistory.list([Query.limit(1)]);
            integrityResults.history = 'READY';
        } catch {
            integrityResults.history = 'READY_BUT_EMPTY';
        }

        // Reporting
        if (integrityResults.supermarkets.length > 0) {
            console.warn('⚠️  Invalid Supermarket Coords:', integrityResults.supermarkets);
        }
        if (integrityResults.orphans.length > 0) {
            console.warn(`⚠️  Found ${integrityResults.orphans.length} orphaned/invalid prices`, integrityResults.orphans);
        }
        if (integrityResults.products.length > 0) {
            console.warn(`⚠️  Found ${integrityResults.products.length} products without categories`, integrityResults.products);
        }

        const status = (integrityResults.supermarkets.length === 0 && integrityResults.prices.length === 0 && integrityResults.orphans.length === 0 && integrityResults.products.length === 0) ? 'PASS' : 'WARN';
        results.tests.push({ 
            name: 'Data Integrity', 
            status: status, 
            message: `Checked ${allSupermarkets.documents.length} supermarkets, ${allProductsResult.documents.length} products, and ${allPricesResult.documents.length} prices. History: ${integrityResults.history}` 
        });
        console.log(`✅ Data integrity check completed (${status})\n`);

    } catch (error) {
        results.tests.push({ name: 'Data Integrity', status: 'FAIL', message: error.message });
        console.error('❌ Data integrity test failed:', error.message, '\n');
    }

    // Test 8: Big Plan Schema Validation (Phase 9 Readiness)
    try {
        console.log('Test 8: Schema Attribute Validation');
        const schemaIssues = [];

        // 1. Check Prices for Expansion attributes
        const samplePrice = allPricesResult?.documents[0];
        if (samplePrice) {
            ['isOnSale', 'stockStatus', 'currency'].forEach(attr => {
                if (!(attr in samplePrice)) schemaIssues.push(`PRICES missing: ${attr}`);
            });
        }

        // 2. Check Products for Expansion attributes
        const sampleProduct = allProductsResult?.documents[0];
        if (sampleProduct) {
            ['brand', 'unit', 'barcode'].forEach(attr => {
                if (!(attr in sampleProduct)) schemaIssues.push(`PRODUCTS missing: ${attr}`);
            });
        }

        const schemaStatus = schemaIssues.length === 0 ? 'PASS' : 'WARN';
        results.tests.push({
            name: 'Schema Expansion',
            status: schemaStatus,
            message: schemaStatus === 'PASS' 
                ? 'All Business Logic attributes (Sale, Stock, Brand, Unit) detected.' 
                : schemaIssues.join(', ')
        });
        console.log(`${schemaStatus === 'PASS' ? '✅' : '⚠️'} Schema validation finished\n`);

    } catch (error) {
        results.tests.push({ name: 'Schema Expansion', status: 'FAIL', message: error.message });
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
