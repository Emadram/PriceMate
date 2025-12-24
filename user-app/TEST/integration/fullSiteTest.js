import { Client, Databases, Query } from 'node-appwrite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    API_KEY: process.env.APPWRITE_API_KEY,
    COLLECTIONS: {
        CATEGORIES: 'category',
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection'
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_FILE = path.join(__dirname, 'test_report.txt');

// --- Helper Functions ---
const log = (message, isError = false) => {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${message}`;
    console.log(formattedMsg);
    fs.appendFileSync(REPORT_FILE, formattedMsg + '\n');
    if (isError) {
        fs.appendFileSync(REPORT_FILE, '   ❌ ERROR DETECTED\n');
    }
};

const getRelationshipId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) return field.length > 0 ? getRelationshipId(field[0]) : null;
    if (typeof field === 'string') return field;
    return field.$id;
};

// --- Test Suite ---
const runTests = async () => {
    // Reset Report File
    fs.writeFileSync(REPORT_FILE, '--- AUTOMATED SITE FUNCTIONALITY TEST REPORT ---\n\n');
    log('🚀 Starting Comprehensive Test Suite...');

    if (!CONFIG.API_KEY) {
        log('❌ Missing APPWRITE_API_KEY. Tests aborted.', true);
        process.exit(1);
    }

    const client = new Client()
        .setEndpoint(CONFIG.ENDPOINT)
        .setProject(CONFIG.PROJECT_ID)
        .setKey(CONFIG.API_KEY);

    const databases = new Databases(client);
    let errorCount = 0;

    // --- TEST 1: HOME PAGE (Featured Products) ---
    try {
        log('\n--- TEST 1: HOME PAGE (Featured Products) ---');
        log('Testing: fetchProducts() with categoryId expansion');

        // Simulate: fetchProducts(6)
        const products = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            [
                Query.limit(6),
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'categoryId.*'])
            ]
        );

        if (products.documents.length === 0) {
            log('❌ No products found for Home Page.', true);
            errorCount++;
        } else {
            log(`✅ Fetched ${products.documents.length} featured products (expected: up to 6 from 10 total)`);

            // Verify each product has proper data
            products.documents.forEach(p => {
                const catName = Array.isArray(p.categoryId) ? p.categoryId[0]?.categoryName : p.categoryId?.categoryName;
                if (!p.name) { log(`   ❌ Product ID ${p.$id} missing name!`, true); errorCount++; }
                if (!p.barcode) { log(`   ❌ Product "${p.name}" missing barcode!`, true); errorCount++; }
                if (!catName) { log(`   ❌ Product "${p.name}" missing Category Name!`, true); errorCount++; }
                else log(`   ✅ Product: ${p.name} | Barcode: ${p.barcode} | Category: ${catName}`);
            });
        }
    } catch (e) {
        log(`❌ Home Page Test Failed: ${e.message}`, true);
        errorCount++;
    }

    // --- TEST 2: SEARCH PAGE (Search Functionality) ---
    try {
        log('\n--- TEST 2: SEARCH PAGE (Query: "Chocolate") ---');
        // Simulate: searchProducts('Chocolate')
        const allProducts = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            [
                Query.limit(100),
                Query.select(['*', 'categoryId.*'])
            ]
        );

        // Client-side filter (matching the new implementation)
        const searchLower = 'chocolate';
        const filtered = allProducts.documents.filter(p =>
            p.name.toLowerCase().includes(searchLower) ||
            p.barcode.includes('chocolate')
        );

        if (filtered.length === 0) {
            log('⚠️ Search for "Chocolate" returned 0 results.', true);
        } else {
            log(`✅ Search for "Chocolate" returned ${filtered.length} results.`);
            const p = filtered[0];
            const catName = Array.isArray(p.categoryId) ? p.categoryId[0]?.categoryName : p.categoryId?.categoryName;

            if (catName) log(`   ✅ Search Result "${p.name}" has category: ${catName}`);
            else { log(`   ❌ Search Result "${p.name}" MISSING category!`, true); errorCount++; }
        }

    } catch (e) {
        log(`❌ Search Test Failed: ${e.message}`, true);
        errorCount++;
    }

    // --- TEST 3: PRICE COMPARISON (Product Details & Prices) ---
    try {
        log('\n--- TEST 3: PRICE COMPARISON PAGE ---');
        log('Testing: Product detail fetch + Price listings for all supermarkets');

        // 1. Get a valid barcode first
        const allProds = await databases.listDocuments(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.PRODUCTS, [Query.limit(1)]);
        if (allProds.documents.length === 0) throw new Error("No products to test");

        const testBarcode = allProds.documents[0].barcode;
        const testProductName = allProds.documents[0].name;
        log(`Testing with: ${testProductName} (Barcode: ${testBarcode})`);

        // Simulate: fetchProductByBarcode
        const productRes = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRODUCTS,
            [
                Query.equal('barcode', testBarcode),
                Query.limit(1),
                Query.select(['*', 'categoryId.*'])
            ]
        );

        if (productRes.documents.length === 0) {
            throw new Error("Could not fetch product by barcode");
        }
        const product = productRes.documents[0];
        const catName = Array.isArray(product.categoryId) ? product.categoryId[0]?.categoryName : product.categoryId?.categoryName;
        log(`✅ Product Details Retrieved: ${product.name}`);
        if (catName) log(`   ✅ Category: ${catName}`);
        else { log(`   ❌ Missing Category!`, true); errorCount++; }

        // Simulate: fetchAllPrices (filtered for this product)
        log('   Fetching ALL prices with relationships...');
        const pricesRes = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            [
                Query.limit(100), // Get all prices
                Query.select(['*', 'products.*', 'supermarkets.*', 'products.categoryId.*'])
            ]
        );

        // Filter for this product (client-side logic simulation)
        const relevantPrices = pricesRes.documents.filter(pr => {
            const pId = getRelationshipId(pr.products);
            return pId === product.$id;
        });

        if (relevantPrices.length > 0) {
            log(`   ✅ Found ${relevantPrices.length} prices (expected: 5 supermarkets)`);

            // Verify each price has valid data
            const uniqueStores = new Set();
            relevantPrices.forEach(price => {
                const marketName = Array.isArray(price.supermarkets) ? price.supermarkets[0]?.name : price.supermarkets?.name;
                const priceValue = price.price;

                if (!marketName) {
                    log(`   ❌ Price entry missing supermarket name!`, true);
                    errorCount++;
                } else {
                    uniqueStores.add(marketName);
                    log(`   ✅ ${marketName}: ${priceValue} TRY`);
                }
            });

            log(`   📊 Coverage: Prices at ${uniqueStores.size} different supermarkets`);
            if (uniqueStores.size < 5) {
                log(`   ⚠️ Expected prices at all 5 supermarkets, found only ${uniqueStores.size}`, true);
            }
        } else {
            log(`   ❌ No prices found for this product!`, true);
            errorCount++;
        }

    } catch (e) {
        log(`❌ Price Comparison Test Failed: ${e.message}`, true);
        errorCount++;
    }

    // --- TEST 4: SUPERMARKET PROFILE ---
    try {
        log('\n--- TEST 4: SUPERMARKET PROFILE ---');
        // Get a supermarket ID
        const superRes = await databases.listDocuments(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.SUPERMARKETS, [Query.limit(1)]);
        if (superRes.documents.length > 0) {
            const superId = superRes.documents[0].$id;
            log(`Testing Supermarket ID: ${superId} (${superRes.documents[0].name})`);

            // Simulate: fetchPricesBySupermarket
            const pricesRes = await databases.listDocuments(
                CONFIG.DATABASE_ID,
                CONFIG.COLLECTIONS.PRICES,
                [
                    Query.limit(50),
                    Query.orderDesc('$createdAt'),
                    Query.select(['*', 'products.*', 'supermarkets.*', 'products.categoryId.*'])
                ]
            );

            // Filter
            const marketPrices = pricesRes.documents.filter(p => getRelationshipId(p.supermarkets) === superId);

            if (marketPrices.length > 0) {
                log(`   ✅ Found ${marketPrices.length} products in this supermarket.`);
                const firstPrice = marketPrices[0];

                // Check Product Name & Category
                const p = Array.isArray(firstPrice.products) ? firstPrice.products[0] : firstPrice.products;
                if (!p) {
                    log('   ❌ Price entry missing product relationship!', true); errorCount++;
                } else {
                    const catName = Array.isArray(p.categoryId) ? p.categoryId[0]?.categoryName : p.categoryId?.categoryName;
                    log(`   ✅ Listed Product: ${p.name}`);
                    if (catName) log(`   ✅ Product Category: ${catName}`);
                    else { log(`   ❌ Product in Market Profile MISSING category!`, true); errorCount++; }
                }
            } else {
                log('   ⚠️ No prices found for this supermarket.');
            }

        } else {
            log('⚠️ No supermarkets found to test.', true);
        }

    } catch (e) {
        log(`❌ Supermarket Profile Test Failed: ${e.message}`, true);
        errorCount++;
    }

    log('\n-----------------------------------');
    if (errorCount === 0) {
        log('✅ ALL TESTS PASSED! The website data integration is robust.');
    } else {
        log(`❌ ${errorCount} ISSUES DETECTED. Check log above.`, true);
    }
    log(`📄 Full report saved to: ${REPORT_FILE}`);
};

runTests();
