
import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from the root or current dir
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY // Need this for administrative checks if possible, else skip
};

if (!config.projectId || !config.databaseId) {
    console.error('❌ Missing VITE_APPWRITE_PROJECT_ID or VITE_APPWRITE_DATABASE_ID in environment.');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);

// REMOVE administrative key for generic bucket check
// if (config.apiKey) {
//     client.setKey(config.apiKey);
// }

const databases = new Databases(client);

const COLLECTIONS = {
    CATEGORIES: process.env.VITE_APPWRITE_COLLECTION_CATEGORIES || 'category',
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    SUPERMARKETS: process.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets',
    PRICES: process.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
    FEEDBACK: process.env.VITE_APPWRITE_COLLECTION_FEEDBACK || 'feedback',
    ANNOUNCEMENTS: process.env.VITE_APPWRITE_COLLECTION_ANNOUNCEMENTS || 'announcements',
    CHAT_HISTORY: process.env.VITE_APPWRITE_COLLECTION_CHAT_HISTORY || 'chat_history'
};

async function testCollections() {
    console.log('--- 🛡️ PriceMate Backend Sync Test ---');
    console.log(`Project: ${config.projectId}`);
    console.log(`Database: ${config.databaseId}`);
    console.log('------------------------------------');

    for (const [name, id] of Object.entries(COLLECTIONS)) {
        try {
            const result = await databases.listDocuments(config.databaseId, id, [Query.limit(1)]);
            console.log(`✅ ${name.padEnd(15)}: [ID: ${id.padEnd(20)}] - Found ${result.total} documents.`);
        } catch (error) {
            console.log(`❌ ${name.padEnd(15)}: [ID: ${id.padEnd(20)}] - Error: ${error.message}`);
        }
    }

    console.log('------------------------------------');
    console.log('Checking for CHAT_HISTORY specifically...');
    try {
        const chats = await databases.listDocuments(config.databaseId, COLLECTIONS.CHAT_HISTORY, [Query.limit(5)]);
        if (chats.total > 0) {
            console.log(`✅ Successfully retrieved ${chats.documents.length} chat logs.`);
            // console.log('Sample content:', chats.documents[0].content?.substring(0, 50) + '...');
        } else {
            console.log('⚠️ CHAT_HISTORY exists but is EMPTY.');
        }
    } catch (e) {
        console.log(`❌ Failed to access CHAT_HISTORY: ${e.message}`);
    }
}

testCollections();
