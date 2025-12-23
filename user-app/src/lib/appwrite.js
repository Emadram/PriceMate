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
        CATEGORIES: 'category',
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection',
        FEEDBACK: 'feedback',
        USER_PROFILES: 'user_profiles'
    }
};

export const { DATABASE_ID, COLLECTIONS } = APPWRITE_CONFIG;
export { Query } from 'appwrite';



