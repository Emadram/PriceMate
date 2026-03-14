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

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export const APPWRITE_CONFIG = {
    PROJECT_ID: RESOLVED_APPWRITE_CONFIG.projectId,
    DATABASE_ID: RESOLVED_APPWRITE_CONFIG.databaseId,
    COLLECTIONS: {
        CATEGORIES: 'category',
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection',
        FEEDBACK: 'feedback',
        USER_PROFILES: import.meta.env.VITE_APPWRITE_COLLECTION_USER_PROFILES || 'user_profiles',
        FAVORITES: import.meta.env.VITE_APPWRITE_COLLECTION_FAVORITES || 'favorites'
    }
};

export const getAppwriteConfig = () => RESOLVED_APPWRITE_CONFIG;
export const { DATABASE_ID, COLLECTIONS } = APPWRITE_CONFIG;
export { Query } from 'appwrite';



