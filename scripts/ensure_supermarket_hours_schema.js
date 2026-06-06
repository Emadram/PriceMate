import sdk from 'node-appwrite';

const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID;
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;

const SUPERMARKETS = process.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets';

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isExists = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    return error?.code === 409 || msg.includes('already exists');
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

const main = async () => {
    if (!PROJECT_ID || !DATABASE_ID || !API_KEY) {
        throw new Error('Missing VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, or APPWRITE_API_KEY.');
    }

    client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

    await ensure(`attribute ${SUPERMARKETS}.openingHours`, () =>
        databases.createStringAttribute({
            databaseId: DATABASE_ID,
            collectionId: SUPERMARKETS,
            key: 'openingHours',
            size: 2000,
            required: false,
        })
    );
    await waitForAttribute(SUPERMARKETS, 'openingHours');

    console.log('Supermarket openingHours schema is ready.');
};

main().catch((error) => {
    console.error('Supermarket hours schema setup failed:', error?.message || error);
    process.exit(1);
});
