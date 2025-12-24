// Debug script to test Appwrite connection and product fetching
// Open browser console and paste this to debug

import { databases, APPWRITE_CONFIG } from './lib/appwrite.js';
import { Query } from 'appwrite';

console.log('=== APPWRITE DEBUG SCRIPT ===');
console.log('Project ID:', APPWRITE_CONFIG.PROJECT_ID);
console.log('Database ID:', APPWRITE_CONFIG.DATABASE_ID);
console.log('Collections:', APPWRITE_CONFIG.COLLECTIONS);

// Test 1: Fetch all products
async function testFetchProducts() {
    console.log('\n--- TEST 1: Fetch All Products ---');
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS
        );
        console.log('✅ Success! Found', response.documents.length, 'products');
        console.log('Products:', response.documents);
        return response.documents;
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
        return [];
    }
}

// Test 2: Search by name
async function testSearchByName(searchTerm) {
    console.log('\n--- TEST 2: Search by Name ---');
    console.log('Searching for:', searchTerm);
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            [Query.search('name', searchTerm)]
        );
        console.log('✅ Success! Found', response.documents.length, 'products');
        console.log('Results:', response.documents);
        return response.documents;
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
        return [];
    }
}

// Test 3: Search by barcode
async function testSearchByBarcode(barcode) {
    console.log('\n--- TEST 3: Search by Barcode ---');
    console.log('Searching for barcode:', barcode);
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            [Query.equal('barcode', barcode)]
        );
        console.log('✅ Success! Found', response.documents.length, 'products');
        console.log('Results:', response.documents);
        return response.documents;
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
        return [];
    }
}

// Run all tests
async function runAllTests() {
    const products = await testFetchProducts();

    if (products.length > 0) {
        // Test search with first product
        await testSearchByName(products[0].name);
        await testSearchByBarcode(products[0].barcode);
    } else {
        console.log('\n⚠️ No products found. Please add products via Admin Panel first.');
    }
}

// Auto-run
runAllTests();

// Export for manual testing
window.appwriteDebug = {
    testFetchProducts,
    testSearchByName,
    testSearchByBarcode,
    runAllTests
};

console.log('\n💡 You can also run tests manually:');
console.log('  window.appwriteDebug.testFetchProducts()');
console.log('  window.appwriteDebug.testSearchByName("product name")');
console.log('  window.appwriteDebug.testSearchByBarcode("123456")');
