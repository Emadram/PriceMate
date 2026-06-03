import sdk from 'node-appwrite';

const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID;
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;

const COLLECTIONS = {
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
    CHAT_HISTORY: process.env.VITE_APPWRITE_COLLECTION_CHAT_HISTORY || 'chat_history',
    AI_CHAT_MEMORY: process.env.VITE_APPWRITE_COLLECTION_AI_CHAT_MEMORY || 'ai_chat_memory',
};

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isExists = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    return error?.code === 409 || msg.includes('already exists');
};

const isMissing = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    return error?.code === 404 || msg.includes('not found');
};

const ensure = async (label, fn) => {
    try {
        await fn();
        console.log(`created ${label}`);
    } catch (error) {
        if (isExists(error)) {
            console.log(`exists  ${label}`);
            return;
        }
        throw error;
    }
};

const waitForAttribute = async (collectionId, key) => {
    for (let i = 0; i < 30; i += 1) {
        const attrs = await databases.listAttributes({ databaseId: DATABASE_ID, collectionId });
        const attr = attrs.attributes.find((item) => item.key === key);
        if (!attr || attr.status === 'available') return;
        await sleep(1000);
    }
};

const ensureCollection = async (collectionId, name) => {
    try {
        await databases.getCollection({ databaseId: DATABASE_ID, collectionId });
        console.log(`exists  collection ${collectionId}`);
    } catch (error) {
        if (!isMissing(error)) throw error;
        await databases.createCollection({
            databaseId: DATABASE_ID,
            collectionId,
            name,
            permissions: [
                sdk.Permission.read(sdk.Role.users()),
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users()),
            ],
            documentSecurity: false,
            enabled: true,
        });
        console.log(`created collection ${collectionId}`);
    }
};

const ensureIndex = async (collectionId, key, type, attributes, orders = []) => {
    await ensure(`index ${collectionId}.${key}`, () =>
        databases.createIndex({
            databaseId: DATABASE_ID,
            collectionId,
            key,
            type,
            attributes,
            orders,
        })
    );
};

const ensureString = async (collectionId, key, size, required = false, array = false) => {
    await ensure(`attribute ${collectionId}.${key}`, () =>
        databases.createStringAttribute({
            databaseId: DATABASE_ID,
            collectionId,
            key,
            size,
            required,
            array,
        })
    );
    await waitForAttribute(collectionId, key);
};

const ensureText = async (collectionId, key, required = false) => {
    await ensure(`attribute ${collectionId}.${key}`, () =>
        databases.createTextAttribute({
            databaseId: DATABASE_ID,
            collectionId,
            key,
            required,
        })
    );
    await waitForAttribute(collectionId, key);
};

const ensureFloat = async (collectionId, key) => {
    await ensure(`attribute ${collectionId}.${key}`, () =>
        databases.createFloatAttribute({
            databaseId: DATABASE_ID,
            collectionId,
            key,
            required: false,
        })
    );
    await waitForAttribute(collectionId, key);
};

const ensureInteger = async (collectionId, key, required = false) => {
    await ensure(`attribute ${collectionId}.${key}`, () =>
        databases.createIntegerAttribute({
            databaseId: DATABASE_ID,
            collectionId,
            key,
            required,
        })
    );
    await waitForAttribute(collectionId, key);
};

const ensureDatetime = async (collectionId, key, required = false) => {
    await ensure(`attribute ${collectionId}.${key}`, () =>
        databases.createDatetimeAttribute({
            databaseId: DATABASE_ID,
            collectionId,
            key,
            required,
        })
    );
    await waitForAttribute(collectionId, key);
};

const main = async () => {
    if (!PROJECT_ID || !DATABASE_ID || !API_KEY) {
        throw new Error('Missing VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, or APPWRITE_API_KEY.');
    }

    client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

    await ensureString(COLLECTIONS.CHAT_HISTORY, 'conversationId', 64);
    await ensureIndex(COLLECTIONS.CHAT_HISTORY, 'chat_userId_idx', 'key', ['userId']);
    await ensureIndex(COLLECTIONS.CHAT_HISTORY, 'chat_conversationId_idx', 'key', ['conversationId']);
    await ensureIndex(COLLECTIONS.CHAT_HISTORY, 'chat_user_conversation_idx', 'key', ['userId', 'conversationId']);

    await ensureText(COLLECTIONS.PRODUCTS, 'ingredientsText');
    await ensureString(COLLECTIONS.PRODUCTS, 'allergens', 128, false, true);
    await ensureString(COLLECTIONS.PRODUCTS, 'nutritionSource', 64);
    await ensureFloat(COLLECTIONS.PRODUCTS, 'sugarsPer100g');
    await ensureFloat(COLLECTIONS.PRODUCTS, 'sodiumMgPer100g');
    await ensureFloat(COLLECTIONS.PRODUCTS, 'caffeineMgPerL');
    await ensureDatetime(COLLECTIONS.PRODUCTS, 'nutritionUpdatedAt');

    await ensureCollection(COLLECTIONS.AI_CHAT_MEMORY, 'AI chat memory');
    await ensureString(COLLECTIONS.AI_CHAT_MEMORY, 'userId', 64, true);
    await ensureString(COLLECTIONS.AI_CHAT_MEMORY, 'conversationId', 64, true);
    await ensureText(COLLECTIONS.AI_CHAT_MEMORY, 'summary');
    await ensureText(COLLECTIONS.AI_CHAT_MEMORY, 'factsJson');
    await ensureString(COLLECTIONS.AI_CHAT_MEMORY, 'lastProductBarcode', 32);
    await ensureString(COLLECTIONS.AI_CHAT_MEMORY, 'lastProductName', 255);
    await ensureInteger(COLLECTIONS.AI_CHAT_MEMORY, 'messageCount');
    await ensureInteger(COLLECTIONS.AI_CHAT_MEMORY, 'tokenEstimate');
    await ensureDatetime(COLLECTIONS.AI_CHAT_MEMORY, 'updatedAt');
    await ensureInteger(COLLECTIONS.AI_CHAT_MEMORY, 'version');
    await ensureIndex(COLLECTIONS.AI_CHAT_MEMORY, 'memory_user_conversation_idx', 'key', ['userId', 'conversationId']);
    await ensureIndex(COLLECTIONS.AI_CHAT_MEMORY, 'memory_user_updated_idx', 'key', ['userId', 'updatedAt'], ['asc', 'desc']);

    console.log('AI schema is ready.');
};

main().catch((error) => {
    console.error('AI schema setup failed:', error?.message || error);
    process.exit(1);
});
