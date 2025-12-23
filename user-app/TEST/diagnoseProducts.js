import { Client, Databases } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('68f5e984002817f132e2')
    .setKey('standard_d1cd075cb234b9ffd01889cd3586bb40a20416b0e4d0135d35be63334b889d3f5fcf02bdfac3c988e1d5da6893bf2abefbfa5d536d203a568097db4b715a5787380032846d30e37a67387f24a853c4fda84fd5130f30d826c289620a24d1003586daf8030c670d9012d2c6ed2d7680a2dcbbd4cdb83ab3e65e40206a49292624'); // Using hardcoded key for this test script

const databases = new Databases(client);
const DATABASE_ID = '6924bf52002dda6b6eff';
const PRODUCTS_COLLECTION_ID = 'products'; // Assuming 'products' is the ID, will verify if fails

async function inspectProducts() {
    try {
        console.log('Fetching products...');
        const response = await databases.listDocuments(
            DATABASE_ID,
            PRODUCTS_COLLECTION_ID,
            [] // No queries initially
        );

        console.log(`Fetched ${response.documents.length} products.`);
        if (response.documents.length > 0) {
            const firstProduct = response.documents[0];
            console.log('Sample Product Structure:');
            console.log(JSON.stringify(firstProduct, null, 2));

            console.log('\nChecking categoryId field specifically:');
            console.log('Type of categoryId:', typeof firstProduct.categoryId);
            console.log('Value of categoryId:', firstProduct.categoryId);
        } else {
            console.log('No products found.');
        }

    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

inspectProducts();
