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
        SUPERMARKETS: 'supermarkets',
        PRODUCTS: 'products',
        PRICES: 'prices_collection'
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_FILE = path.join(__dirname, '../test_report_favorites.txt');

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

// --- Test Suite ---
const runFavoritesTest = async () => {
    // Reset Report File
    fs.writeFileSync(REPORT_FILE, '--- FAVORITES FEATURE DATA INTEGRATION TEST ---\n\n');
    log('🚀 Starting Favorites Feature Test...');

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

    try {
        // --- STEP 1: Simulate "Favoriting" Supermarkets ---
        log('\n--- STEP 1: Simulate User Favorites ---');
        // Fetch 3 random supermarkets to be our "favorites"
        const allSupermarkets = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.SUPERMARKETS,
            [Query.limit(3)]
        );

        if (allSupermarkets.documents.length === 0) {
            throw new Error("No supermarkets found in DB to test with.");
        }

        const favoriteIds = allSupermarkets.documents.map(s => s.$id);
        log(`✅ Simulating user favorites with IDs: ${favoriteIds.join(', ')}`);


        // --- STEP 2: Verify Favorites Fetch Logic (Favorites Page) ---
        log('\n--- STEP 2: Verify Favorites Page Data Fetch ---');
        log('Testing: Query.equal("$id", [array_of_ids]) for Supermarkets');

        // This effectively tests the query used in Favorites.jsx
        // databases.listDocuments(..., [Query.equal('$id', favoriteSupermarkets)])

        const fetchedFavorites = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.SUPERMARKETS,
            [
                Query.equal('$id', favoriteIds)
            ]
        );

        log(`Fetched ${fetchedFavorites.documents.length} supermarkets from "Favorites" list.`);

        if (fetchedFavorites.documents.length !== favoriteIds.length) {
            log(`❌ Mismatch! Expected ${favoriteIds.length}, got ${fetchedFavorites.documents.length}`, true);
            errorCount++;
        } else {
            fetchedFavorites.documents.forEach(s => {
                log(`   ✅ Successfully retrieved Favorite: ${s.name} (${s.address})`);
                if (!s.logoUrl && !s.name) errorCount++; // Basic data check
            });
        }

        // --- STEP 3: Verify Context-Aware Data Availability (Supermarket Profile) ---
        log('\n--- STEP 3: Verify Supermarket Profile Data ---');
        // Pick one favorite to visit
        const targetSupermarket = fetchedFavorites.documents[0];
        log(`Simulating click on Favorite: ${targetSupermarket.name} (ID: ${targetSupermarket.$id})`);

        // Fetch products for this supermarket (mimicking SupermarketProfile.jsx)
        // Note: Prices collection links to Supermarket.
        const supermarketPrices = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.PRICES,
            [
                Query.equal('supermarkets', targetSupermarket.$id),
                Query.limit(5),
                Query.select(['*', 'products.*'])
            ]
        );

        if (supermarketPrices.documents.length > 0) {
            log(`   ✅ Found ${supermarketPrices.documents.length} price entries for this supermarket.`);

            // Check if we can form the "context link"
            const examplePrice = supermarketPrices.documents[0];
            const product = Array.isArray(examplePrice.products) ? examplePrice.products[0] : examplePrice.products;

            if (product && product.barcode) {
                const contextLink = `/price-comparison/${product.barcode}?supermarketId=${targetSupermarket.$id}`;
                log(`   ✅ Generated Context Link: ${contextLink}`);
                log(`   ℹ️ This link is used to prioritize ${targetSupermarket.name} in price comparison.`);
            } else {
                log(`   ⚠️ Could not verify product barcode for context link generation.`, true);
                errorCount++;
            }

        } else {
            log(`   ⚠️ No products found for this supermarket. Cannot verify context link logic.`, true);
            // Not necessarily an error if DB is empty for this specific one, but limits test coverage
        }

    } catch (e) {
        log(`❌ Test execution failed: ${e.message}`, true);
        errorCount++;
    }

    log('\n-----------------------------------');
    if (errorCount === 0) {
        log('✅ FAVORITES INTEGRATION TEST PASSED!');
    } else {
        log(`❌ ${errorCount} ISSUES DETECTED.`, true);
    }
    log(`📄 Full report saved to: ${REPORT_FILE}`);
};

runFavoritesTest();
