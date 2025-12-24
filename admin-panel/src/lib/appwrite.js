import { Client, Account, Databases, Storage, Functions } from 'appwrite';

export const client = new Client();

client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export const APPWRITE_CONFIG = {
    PROJECT_ID: import.meta.env.VITE_APPWRITE_PROJECT_ID,
    DATABASE_ID: import.meta.env.VITE_APPWRITE_DATABASE_ID,
    COLLECTIONS: {
        CATEGORIES: import.meta.env.VITE_APPWRITE_COLLECTION_CATEGORIES,
        PRODUCTS: import.meta.env.VITE_APPWRITE_COLLECTION_PRODUCTS,
        SUPERMARKETS: import.meta.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS,
        PRICES: import.meta.env.VITE_APPWRITE_COLLECTION_PRICES,
        FEEDBACK: import.meta.env.VITE_APPWRITE_COLLECTION_FEEDBACK,
        USER_PROFILES: import.meta.env.VITE_APPWRITE_COLLECTION_USER_PROFILES
    }
};

export const { DATABASE_ID, COLLECTIONS } = APPWRITE_CONFIG;



