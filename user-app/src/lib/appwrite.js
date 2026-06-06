import { Client, Account, Databases, Storage, Functions } from 'appwrite';

const resolveAppwriteConfig = () => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

    const missing = [];
    if (!endpoint) missing.push('VITE_APPWRITE_ENDPOINT');
    if (!projectId) missing.push('VITE_APPWRITE_PROJECT_ID');
    if (!databaseId) missing.push('VITE_APPWRITE_DATABASE_ID');

    if (missing.length) {
        const message = `Missing Appwrite environment variables: ${missing.join(', ')}. Add them to your .env file.`;
        console.error(message);
        throw new Error(message);
    }

    return { endpoint, projectId, databaseId };
};

const RESOLVED_APPWRITE_CONFIG = resolveAppwriteConfig();

export const client = new Client()
    .setEndpoint(RESOLVED_APPWRITE_CONFIG.endpoint)
    .setProject(RESOLVED_APPWRITE_CONFIG.projectId);

/**
 * Verifies reachability of the Appwrite API (called once from main.jsx on startup).
 * Safe to ignore in production; check the browser console for "[Appwrite] ping OK".
 */
export function pingAppwriteBackend() {
    client
        .ping()
        .then((response) => {
            console.info('[Appwrite] ping OK:', response);
        })
        .catch((err) => {
            console.warn('[Appwrite] ping failed:', err?.message || err);
        });
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export const APPWRITE_CONFIG = {
    PROJECT_ID: RESOLVED_APPWRITE_CONFIG.projectId,
    DATABASE_ID: RESOLVED_APPWRITE_CONFIG.databaseId,
    COLLECTIONS: {
        CATEGORIES: import.meta.env.VITE_APPWRITE_COLLECTION_CATEGORIES || 'category',
        // Optional on products (AI ingredient fallback): sugarsPer100g (double), ingredientsText (string), nutritionSource (string), sodiumMgPer100g (double)
        PRODUCTS: import.meta.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
        SUPERMARKETS: import.meta.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets',
        PRICES: import.meta.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
        PRICE_HISTORY: import.meta.env.VITE_APPWRITE_COLLECTION_PRICE_HISTORY || 'price_history', 
        FEEDBACK: import.meta.env.VITE_APPWRITE_COLLECTION_FEEDBACK || 'feedback',
        USER_PROFILES: import.meta.env.VITE_APPWRITE_COLLECTION_USER_PROFILES || 'user_profiles',
        FAVORITES: import.meta.env.VITE_APPWRITE_COLLECTION_FAVORITES || 'favorites',
        ANNOUNCEMENTS: import.meta.env.VITE_APPWRITE_COLLECTION_ANNOUNCEMENTS || 'announcements',
        CHAT_HISTORY: import.meta.env.VITE_APPWRITE_COLLECTION_CHAT_HISTORY || 'chat_history',
        OFF_CACHE: import.meta.env.VITE_APPWRITE_COLLECTION_OFF_CACHE || 'off_cache',
        AI_CHAT_MEMORY: import.meta.env.VITE_APPWRITE_COLLECTION_AI_CHAT_MEMORY || 'ai_chat_memory'
    }
};

export const getAppwriteConfig = () => RESOLVED_APPWRITE_CONFIG;
export const { DATABASE_ID, COLLECTIONS } = APPWRITE_CONFIG;
import { ID, Query } from 'appwrite';
import { recordGetRead, recordListRead } from '../utils/readStats';

/**
 * DB Helper - Centralized logic for database operations
 * achieving a cleaner `db.collection.action()` API.
 */
const dbAction = {
    list: (collectionId, queries = []) => {
        recordListRead(collectionId);
        return databases.listDocuments(DATABASE_ID, collectionId, queries);
    },
    get: (collectionId, documentId, queries = []) => {
        recordGetRead(collectionId);
        return databases.getDocument(DATABASE_ID, collectionId, documentId, queries);
    },
    create: (collectionId, data, permissions) => 
        databases.createDocument(DATABASE_ID, collectionId, ID.unique(), data, permissions),
    update: (collectionId, documentId, data, permissions) => 
        databases.updateDocument(DATABASE_ID, collectionId, documentId, data, permissions),
    delete: (collectionId, documentId) =>
        databases.deleteDocument(DATABASE_ID, collectionId, documentId)
};

export const db = {
    categories: {
        list: (queries) => dbAction.list(COLLECTIONS.CATEGORIES, queries),
        get: (id) => dbAction.get(COLLECTIONS.CATEGORIES, id),
    },
    products: {
        list: (queries) => dbAction.list(COLLECTIONS.PRODUCTS, queries),
        get: (id) => dbAction.get(COLLECTIONS.PRODUCTS, id),
        update: (id, data) => dbAction.update(COLLECTIONS.PRODUCTS, id, data),
    },
    supermarkets: {
        list: (queries) => dbAction.list(COLLECTIONS.SUPERMARKETS, queries),
        get: (id) => dbAction.get(COLLECTIONS.SUPERMARKETS, id),
    },
    prices: {
        list: (queries) => dbAction.list(COLLECTIONS.PRICES, queries),
        create: (data) => dbAction.create(COLLECTIONS.PRICES, data),
    },
    priceHistory: {
        list: (queries) => dbAction.list(COLLECTIONS.PRICE_HISTORY, queries),
        create: (data) => dbAction.create(COLLECTIONS.PRICE_HISTORY, data),
    },
    favorites: {
        list: (queries) => dbAction.list(COLLECTIONS.FAVORITES, queries),
        create: (data) => dbAction.create(COLLECTIONS.FAVORITES, data),
        delete: (id) => dbAction.delete(COLLECTIONS.FAVORITES, id),
    },
    announcements: {
        list: (queries) => dbAction.list(COLLECTIONS.ANNOUNCEMENTS, queries),
    },
    feedback: {
        list: (queries) => dbAction.list(COLLECTIONS.FEEDBACK, queries),
        create: (data) => dbAction.create(COLLECTIONS.FEEDBACK, data),
    },
    // chat_history (COLLECTIONS.CHAT_HISTORY): REQUIRED for multi-thread AI chat — add optional String attribute
    //   key: conversationId, size ≥ 36 (UUID), required: no. Without it, creates fail when the app sends thread IDs.
    //   Legacy messages omit this field; they are grouped as one thread in the UI.
    chatHistory: {
        list: (queries) => dbAction.list(COLLECTIONS.CHAT_HISTORY, queries),
        create: (data) => dbAction.create(COLLECTIONS.CHAT_HISTORY, data),
        delete: (id) => dbAction.delete(COLLECTIONS.CHAT_HISTORY, id),
    },
    aiChatMemory: {
        list: (queries) => dbAction.list(COLLECTIONS.AI_CHAT_MEMORY, queries),
        create: (data) => dbAction.create(COLLECTIONS.AI_CHAT_MEMORY, data),
        update: (id, data) => dbAction.update(COLLECTIONS.AI_CHAT_MEMORY, id, data),
        delete: (id) => dbAction.delete(COLLECTIONS.AI_CHAT_MEMORY, id),
    },
    offCache: {
        list: (queries) => dbAction.list(COLLECTIONS.OFF_CACHE, queries),
        create: (data) => dbAction.create(COLLECTIONS.OFF_CACHE, data),
        update: (id, data) => dbAction.update(COLLECTIONS.OFF_CACHE, id, data),
    }
};

export { Query, ID };

