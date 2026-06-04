import { Client, Databases, Storage, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    listAllDocuments,
    createDocumentsInBatches,
} from './lib/appwriteList.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const COLLECTIONS = {
    PRODUCTS: process.env.VITE_APPWRITE_COLLECTION_PRODUCTS || 'products',
};

const config = {
    endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    projectId: process.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
    apiKey: process.env.APPWRITE_API_KEY,
    productImagesBucket: process.env.VITE_APPWRITE_BUCKET_PRODUCT_IMAGES || 'product-images',
};

const parseArgs = (argv) => {
    const flags = {
        dryRun: false,
        limit: null,
        concurrency: 4,
        force: false,
        includePlaceholders: true,
        bucketId: null,
        checkpointFile: null,
        useOpenFoodFacts: true,
    };

    for (const arg of argv) {
        if (arg === '--dry-run') flags.dryRun = true;
        else if (arg.startsWith('--limit=')) flags.limit = Number(arg.split('=')[1]) || null;
        else if (arg.startsWith('--concurrency=')) flags.concurrency = Number(arg.split('=')[1]) || 4;
        else if (arg === '--force') flags.force = true;
        else if (arg === '--no-include-placeholders') flags.includePlaceholders = false;
        else if (arg.startsWith('--bucket-id=')) flags.bucketId = arg.split('=')[1] || null;
        else if (arg.startsWith('--checkpoint-file=')) flags.checkpointFile = arg.split('=')[1] || null;
        else if (arg === '--no-openfoodfacts') flags.useOpenFoodFacts = false;
    }

    return flags;
};

const resolveCheckpointPath = (flags) => {
    if (flags.checkpointFile) {
        return path.isAbsolute(flags.checkpointFile)
            ? flags.checkpointFile
            : path.join(__dirname, flags.checkpointFile);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return path.join(__dirname, '.checkpoints', `fix_missing_product_images.${stamp}.json`);
};

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const loadCheckpoint = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return { processed: {} };
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { processed: parsed?.processed || {} };
    } catch {
        return { processed: {} };
    }
};

const saveCheckpoint = (filePath, checkpoint) => {
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
};

const looksLikePlaceholderUrl = (value) => {
    const url = String(value || '').trim().toLowerCase();
    if (!url) return false;
    if (url.includes('via.placeholder.com')) return true;
    if (url.includes('placehold.co')) return true;
    if (url.includes('dummyimage.com')) return true;
    return false;
};

const isMissingImage = (product, options = {}) => {
    const includePlaceholders = options.includePlaceholders !== false;
    const fields = [
        product.imageUrl,
        product.image,
        product.image_url,
        product.image_front_url,
    ];
    const trimmed = fields.map((v) => String(v || '').trim()).filter(Boolean);
    if (trimmed.length === 0) return true;
    if (includePlaceholders && trimmed.some((v) => looksLikePlaceholderUrl(v))) return true;
    return false;
};

const loadPlaceholderPngBuffer = () => {
    const base64Path = path.join(__dirname, 'assets', 'product-placeholder.png.base64.txt');
    const base64 = fs.readFileSync(base64Path, 'utf8').trim();
    return Buffer.from(base64, 'base64');
};

const safeString = (value) => String(value || '').trim();

const productDisplayName = (product) =>
    safeString(product.name) ||
    safeString(product.product_name) ||
    safeString(product.productName) ||
    '';

const productBarcode = (product) =>
    safeString(product.barcode) ||
    safeString(product.code) ||
    '';

const fetchJson = async (url) => {
    const res = await fetch(url, {
        headers: { 'user-agent': 'PriceMateSeeder/1.0 (+openfoodfacts)' },
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.json();
};

const fetchBinary = async (url) => {
    const res = await fetch(url, {
        headers: { 'user-agent': 'PriceMateSeeder/1.0 (+openfoodfacts)' },
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const contentType = res.headers.get('content-type') || '';
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
};

const pickImageUrlFromOffProduct = (p) => {
    const url =
        safeString(p?.image_front_url) ||
        safeString(p?.image_url) ||
        safeString(p?.image_small_url) ||
        '';
    return url;
};

const findOffImageByBarcode = async (barcode) => {
    const code = safeString(barcode);
    if (!code) return null;
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,image_front_url,image_url,image_small_url`;
    const json = await fetchJson(url);
    if (!json || json.status !== 1 || !json.product) return null;
    const imageUrl = pickImageUrlFromOffProduct(json.product);
    return imageUrl ? { imageUrl, source: 'off_barcode', code } : null;
};

const findOffImageByName = async (name) => {
    const q = safeString(name);
    if (!q) return null;
    const url =
        `https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1` +
        `&page_size=8&fields=code,product_name,brands,image_front_url,image_url,image_small_url` +
        `&search_terms=${encodeURIComponent(q)}`;
    const json = await fetchJson(url);
    const products = Array.isArray(json?.products) ? json.products : [];
    for (const p of products) {
        const imageUrl = pickImageUrlFromOffProduct(p);
        if (imageUrl) {
            return { imageUrl, source: 'off_name', code: safeString(p.code) || '' };
        }
    }
    return null;
};

const extFromContentType = (contentType) => {
    const ct = String(contentType || '').toLowerCase();
    if (ct.includes('png')) return 'png';
    if (ct.includes('webp')) return 'webp';
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
    if (ct.includes('gif')) return 'gif';
    return 'bin';
};

if (!config.projectId || !config.databaseId) {
    console.error('Missing VITE_APPWRITE_PROJECT_ID or VITE_APPWRITE_DATABASE_ID.');
    process.exit(1);
}
if (!config.apiKey) {
    console.error('Missing APPWRITE_API_KEY.');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

const databases = new Databases(client);
const storage = new Storage(client);

const run = async () => {
    const flags = parseArgs(process.argv.slice(2));
    const bucketId = flags.bucketId || config.productImagesBucket;
    const checkpointPath = resolveCheckpointPath(flags);
    ensureDir(path.dirname(checkpointPath));
    const checkpoint = flags.dryRun ? { processed: {} } : loadCheckpoint(checkpointPath);

    const ALLOWED_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

    // Ensure the bucket exists (auto-create if missing).
    try {
        const bucket = await storage.getBucket(bucketId);
        const allowed = Array.isArray(bucket.allowedFileExtensions) ? bucket.allowedFileExtensions : [];
        if (allowed.length > 0 && !allowed.some((ext) => ALLOWED_EXTS.includes(String(ext).toLowerCase()))) {
            console.warn(
                `Bucket "${bucketId}" has restricted extensions (${allowed.join(', ')}). ` +
                    `If uploads fail, allow: ${ALLOWED_EXTS.join(', ')} in Appwrite Console.`
            );
        }
    } catch (err) {
        if (flags.dryRun) {
            console.error(
                `Storage bucket not found: "${bucketId}". ` +
                    'Create it in Appwrite Console (Storage → Buckets) or pass --bucket-id=<bucketId>.'
            );
            console.error(`Tip: set VITE_APPWRITE_BUCKET_PRODUCT_IMAGES=<bucketId> in scripts/.env`);
            console.error('Error:', err?.message || err);
            process.exit(1);
        }

        console.warn(`Storage bucket "${bucketId}" not found. Creating it now...`);
        try {
            await storage.createBucket(
                bucketId,
                'Product Images',
                [],
                false,
                true,
                undefined,
                ALLOWED_EXTS
            );
        } catch (createErr) {
            console.error(`Failed to create bucket "${bucketId}". Create it manually and retry.`);
            console.error('Error:', createErr?.message || createErr);
            process.exit(1);
        }
    }

    const products = await listAllDocuments((queries) =>
        databases.listDocuments(config.databaseId, COLLECTIONS.PRODUCTS, queries)
    );

    const missing = products.filter((p) => (flags.force ? true : isMissingImage(p, { includePlaceholders: flags.includePlaceholders })));
    const pending = missing.filter((p) => !checkpoint.processed[p.$id]);
    const target = flags.limit ? pending.slice(0, flags.limit) : pending;

    console.log('Fix missing product images');
    console.log(`  Total products: ${products.length}`);
    console.log(`  Missing image: ${missing.length}${flags.force ? ' (force mode: includes all products)' : ''}`);
    console.log(`  Pending (not checkpointed): ${pending.length}`);
    console.log(`  Will process: ${target.length}`);
    console.log(`  Bucket: ${bucketId}`);
    console.log(`  Dry run: ${flags.dryRun}`);
    console.log(`  Include placeholder URLs: ${flags.includePlaceholders}`);
    console.log(`  Use OpenFoodFacts: ${flags.useOpenFoodFacts}`);

    if (target.length === 0) {
        console.log('Nothing to do.');
        return;
    }

    const placeholder = loadPlaceholderPngBuffer();

    if (flags.dryRun) {
        console.log('Sample product ids:', JSON.stringify(target.slice(0, 5).map((p) => p.$id), null, 2));
        return;
    }

    const startedAt = Date.now();
    const { created, failed, errors } = await createDocumentsInBatches(
        target,
        async (product) => {
            const name = productDisplayName(product);
            const barcode = productBarcode(product);

            let imageBytes = placeholder;
            let ext = 'png';
            let source = 'placeholder';

            if (flags.useOpenFoodFacts) {
                try {
                    const match =
                        (barcode ? await findOffImageByBarcode(barcode) : null) ||
                        (name ? await findOffImageByName(name) : null);
                    if (match?.imageUrl) {
                        const downloaded = await fetchBinary(match.imageUrl);
                        if (downloaded.buffer?.length) {
                            imageBytes = downloaded.buffer;
                            ext = extFromContentType(downloaded.contentType);
                            source = match.source;
                        }
                    }
                } catch (offErr) {
                    // Best-effort; fall back to placeholder.
                    source = 'placeholder';
                }
            }

            const tryUpload = async (bytes, extension) => {
                const fileName = `product-${product.$id}.${extension}`;
                const inputFile = InputFile.fromBuffer(bytes, fileName);
                return storage.createFile(bucketId, ID.unique(), inputFile, [
                    Permission.read(Role.any()),
                ]);
            };

            let file;
            try {
                file = await tryUpload(imageBytes, ext);
            } catch (uploadErr) {
                const msg = String(uploadErr?.message || uploadErr).toLowerCase();
                if (msg.includes('extension') && msg.includes('not allowed')) {
                    // Fallback: always upload placeholder.png
                    source = 'placeholder';
                    ext = 'png';
                    imageBytes = placeholder;
                    file = await tryUpload(imageBytes, ext);
                } else {
                    throw uploadErr;
                }
            }

            const fileId = file.$id;
            const imageUrl = `${config.endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${config.projectId}`;

            await databases.updateDocument(config.databaseId, COLLECTIONS.PRODUCTS, product.$id, {
                imageUrl,
            });

            checkpoint.processed[product.$id] = {
                fileId,
                imageUrl,
                source,
                barcode: barcode || null,
                name: name || null,
                at: new Date().toISOString(),
            };
            return true;
        },
        {
            concurrency: flags.concurrency,
            onProgress: (s) => {
                if (s.processed % 25 === 0 || s.processed === s.total) {
                    const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
                    const rate = (s.created / elapsed).toFixed(1);
                    console.log(`  Progress: ${s.processed}/${s.total} (updated ${s.created}, failed ${s.failed}, ${rate}/s)`);
                    saveCheckpoint(checkpointPath, checkpoint);
                }
            },
        }
    );

    saveCheckpoint(checkpointPath, checkpoint);
    console.log(`  Checkpoint saved: ${checkpointPath}`);
    console.log(`Done. Updated: ${created}, Failed: ${failed}`);
    if (errors.length) console.error('Errors:', errors);
    if (failed > 0) process.exit(1);
};

run().catch((err) => {
    console.error('Fix images failed:', err.message || err);
    process.exit(1);
});

