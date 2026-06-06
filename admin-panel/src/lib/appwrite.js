import { Client, Account, Databases, Storage, Functions, Teams } from 'appwrite';

const resolveAppwriteConfig = () => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

    const missing = [];
    if (!endpoint) missing.push('VITE_APPWRITE_ENDPOINT');
    if (!projectId) missing.push('VITE_APPWRITE_PROJECT_ID');
    if (!databaseId) missing.push('VITE_APPWRITE_DATABASE_ID');

    if (missing.length) {
        console.warn(`Environment variables missing: ${missing.join(', ')}. App might malfunction.`);
    }

    return { endpoint, projectId, databaseId };
};

const RESOLVED_APPWRITE_CONFIG = resolveAppwriteConfig();

export const client = new Client()
    .setEndpoint(RESOLVED_APPWRITE_CONFIG.endpoint)
    .setProject(RESOLVED_APPWRITE_CONFIG.projectId);

/**
 * Verifies reachability of the Appwrite API (called once from main.jsx on startup).
 */
export function pingAppwriteBackend() {
    if (!RESOLVED_APPWRITE_CONFIG.endpoint || !RESOLVED_APPWRITE_CONFIG.projectId) {
        console.warn('[Appwrite] ping skipped: VITE_APPWRITE_ENDPOINT or VITE_APPWRITE_PROJECT_ID missing');
        return;
    }
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
export const teams = new Teams(client);

export const APPWRITE_CONFIG = {
    PROJECT_ID: RESOLVED_APPWRITE_CONFIG.projectId,
    DATABASE_ID: RESOLVED_APPWRITE_CONFIG.databaseId,
    COLLECTIONS: {
        CATEGORIES: import.meta.env.VITE_APPWRITE_COLLECTION_CATEGORIES || 'category',
        PRODUCTS: import.meta.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
        SUPERMARKETS: import.meta.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets',
        PRICES: import.meta.env.VITE_APPWRITE_COLLECTION_PRICES || 'prices_collection',
        PRICE_HISTORY: import.meta.env.VITE_APPWRITE_COLLECTION_PRICE_HISTORY || 'price_history',
        FEEDBACK: import.meta.env.VITE_APPWRITE_COLLECTION_FEEDBACK || 'feedback',
        ANNOUNCEMENTS: import.meta.env.VITE_APPWRITE_COLLECTION_ANNOUNCEMENTS || 'announcements',
        CHAT_HISTORY: import.meta.env.VITE_APPWRITE_COLLECTION_CHAT_HISTORY || 'chat_history',
        AI_CHAT_MEMORY: import.meta.env.VITE_APPWRITE_COLLECTION_AI_CHAT_MEMORY || 'ai_chat_memory'
    }
};

export const getAppwriteConfig = () => RESOLVED_APPWRITE_CONFIG;
export const { DATABASE_ID, COLLECTIONS } = APPWRITE_CONFIG;
import { ID, Query } from 'appwrite';
import { recordGetRead, recordListRead } from '../utils/readStats';

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
        create: (data, permissions) => dbAction.create(COLLECTIONS.CATEGORIES, data, permissions),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.CATEGORIES, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.CATEGORIES, id)
    },
    products: {
        list: (queries) => dbAction.list(COLLECTIONS.PRODUCTS, queries),
        create: (data, permissions) => dbAction.create(COLLECTIONS.PRODUCTS, data, permissions),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.PRODUCTS, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.PRODUCTS, id)
    },
    supermarkets: {
        list: (queries) => dbAction.list(COLLECTIONS.SUPERMARKETS, queries),
        create: (data, permissions) => dbAction.create(COLLECTIONS.SUPERMARKETS, data, permissions),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.SUPERMARKETS, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.SUPERMARKETS, id)
    },
    prices: {
        list: (queries) => dbAction.list(COLLECTIONS.PRICES, queries),
        create: (data, permissions) => dbAction.create(COLLECTIONS.PRICES, data, permissions),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.PRICES, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.PRICES, id)
    },
    priceHistory: {
        list: (queries) => dbAction.list(COLLECTIONS.PRICE_HISTORY, queries),
        create: (data, permissions) => dbAction.create(COLLECTIONS.PRICE_HISTORY, data, permissions),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.PRICE_HISTORY, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.PRICE_HISTORY, id)
    },
    feedback: {
        list: (queries) => dbAction.list(COLLECTIONS.FEEDBACK, queries),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.FEEDBACK, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.FEEDBACK, id)
    },
    announcements: {
        list: (queries) => dbAction.list(COLLECTIONS.ANNOUNCEMENTS, queries),
        create: (data, permissions) => dbAction.create(COLLECTIONS.ANNOUNCEMENTS, data, permissions),
        update: (id, data, permissions) => dbAction.update(COLLECTIONS.ANNOUNCEMENTS, id, data, permissions),
        delete: (id) => dbAction.delete(COLLECTIONS.ANNOUNCEMENTS, id)
    },
    chatHistory: {
        list: (queries) => dbAction.list(COLLECTIONS.CHAT_HISTORY, queries),
        delete: (id) => dbAction.delete(COLLECTIONS.CHAT_HISTORY, id)
    },
    aiChatMemory: {
        list: (queries) => dbAction.list(COLLECTIONS.AI_CHAT_MEMORY, queries),
        delete: (id) => dbAction.delete(COLLECTIONS.AI_CHAT_MEMORY, id)
    }
};

export { Query, ID };

