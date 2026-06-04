import sdk from 'node-appwrite';
import { listAllDocuments } from './lib/appwriteList.js';

const NUTRITION_META_MARKER = '\n\n[PriceMate Nutrition]\n';
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID;
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
const PRODUCTS_COLLECTION = process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products';

const flags = new Set(process.argv.slice(2));
const dryRun = flags.has('--dry-run');

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : null;
};

const extractNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    if (markerIndex < 0) return null;
    try {
        return JSON.parse(text.slice(markerIndex + NUTRITION_META_MARKER.length).trim());
    } catch {
        return null;
    }
};

const buildPayload = (doc) => {
    const meta = extractNutritionMeta(doc.description);
    if (!meta) return null;
    const payload = {};
    const ingredientsText = String(meta.ingredientsText || '').trim();
    const nutritionSource = String(meta.nutritionSource || '').trim();
    const allergens = Array.isArray(meta.allergens)
        ? meta.allergens.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30)
        : [];
    const sugarsPer100g = parseNumber(meta.sugarsPer100g);
    const sodiumMgPer100g = parseNumber(meta.sodiumMgPer100g);
    const caffeineMgPerL = parseNumber(meta.caffeineMgPerL);

    if (ingredientsText && !doc.ingredientsText) payload.ingredientsText = ingredientsText;
    if (allergens.length > 0 && (!Array.isArray(doc.allergens) || doc.allergens.length === 0)) payload.allergens = allergens;
    if (nutritionSource && !doc.nutritionSource) payload.nutritionSource = nutritionSource;
    if (sugarsPer100g !== null && doc.sugarsPer100g == null) payload.sugarsPer100g = sugarsPer100g;
    if (sodiumMgPer100g !== null && doc.sodiumMgPer100g == null) payload.sodiumMgPer100g = sodiumMgPer100g;
    if (caffeineMgPerL !== null && doc.caffeineMgPerL == null) payload.caffeineMgPerL = caffeineMgPerL;
    if (Object.keys(payload).length > 0) payload.nutritionUpdatedAt = new Date().toISOString();
    return Object.keys(payload).length > 0 ? payload : null;
};

const main = async () => {
    if (!PROJECT_ID || !DATABASE_ID || !API_KEY) {
        throw new Error('Missing VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, or APPWRITE_API_KEY.');
    }

    const client = new sdk.Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
    const databases = new sdk.Databases(client);
    const products = await listAllDocuments((queries) =>
        databases.listDocuments(DATABASE_ID, PRODUCTS_COLLECTION, queries)
    );

    let planned = 0;
    let updated = 0;
    for (const product of products) {
        const payload = buildPayload(product);
        if (!payload) continue;
        planned += 1;
        if (dryRun) {
            console.log(`[dry-run] ${product.$id} ${product.name || product.barcode}: ${Object.keys(payload).join(', ')}`);
            continue;
        }
        await databases.updateDocument(DATABASE_ID, PRODUCTS_COLLECTION, product.$id, payload);
        updated += 1;
    }

    console.log(`Product nutrition migration complete. Planned: ${planned}. Updated: ${updated}.`);
};

main().catch((error) => {
    console.error('Product nutrition migration failed:', error?.message || error);
    process.exit(1);
});
