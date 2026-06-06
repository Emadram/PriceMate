import sdk from 'node-appwrite';
import { DEFAULT_OPENING_HOURS_JSON } from './lib/storeHoursDefaults.js';

const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID;
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;

const SUPERMARKETS = process.env.VITE_APPWRITE_COLLECTION_SUPERMARKETS || 'supermarkets';

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const listAllSupermarkets = async () => {
    const docs = [];
    let offset = 0;
    const limit = 100;
    while (true) {
        const page = await databases.listDocuments({
            databaseId: DATABASE_ID,
            collectionId: SUPERMARKETS,
            queries: [sdk.Query.limit(limit), sdk.Query.offset(offset)],
        });
        docs.push(...page.documents);
        if (page.documents.length < limit) break;
        offset += limit;
    }
    return docs;
};

const main = async () => {
    if (!PROJECT_ID || !DATABASE_ID || !API_KEY) {
        throw new Error('Missing VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, or APPWRITE_API_KEY.');
    }

    client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

    const supermarkets = await listAllSupermarkets();
    let updated = 0;
    let skipped = 0;

    for (const sm of supermarkets) {
        if (sm.openingHours) {
            skipped += 1;
            continue;
        }
        await databases.updateDocument({
            databaseId: DATABASE_ID,
            collectionId: SUPERMARKETS,
            documentId: sm.$id,
            data: { openingHours: DEFAULT_OPENING_HOURS_JSON },
        });
        updated += 1;
        console.log(`Updated ${sm.name || sm.$id}`);
    }

    console.log(`Backfill complete. Updated: ${updated}, skipped (already set): ${skipped}.`);
};

main().catch((error) => {
    console.error('Backfill failed:', error?.message || error);
    process.exit(1);
});
