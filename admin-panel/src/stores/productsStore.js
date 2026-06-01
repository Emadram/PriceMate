import { create } from 'zustand';
import { db, storage, getAppwriteConfig } from '../lib/appwrite';
import { ID, Query } from 'appwrite';

const { endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID } = getAppwriteConfig();
const PRODUCT_IMAGES_BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_SUPERMARKET_LOGOS || 'product-images';
const NUTRITION_META_MARKER = '\n\n[PriceMate Nutrition]\n';

const stripNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    return markerIndex >= 0 ? text.slice(0, markerIndex).trimEnd() : text.trimEnd();
};

const buildNutritionMeta = (data) => {
    const parseNumber = (v) => {
        if (v === undefined || v === null || String(v).trim() === '') return null;
        const n = parseFloat(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    };

    const sugars = parseNumber(data.sugarsPer100g);
    const sodium = parseNumber(data.sodiumMgPer100g);
    const ingredientsText = data.ingredientsText !== undefined && data.ingredientsText !== null ? String(data.ingredientsText).trim() : '';
    const nutritionSource = data.nutritionSource !== undefined && data.nutritionSource !== null ? String(data.nutritionSource).trim() : '';

    const hasNutrition = sugars !== null || sodium !== null || ingredientsText || nutritionSource;
    if (!hasNutrition) return '';

    return JSON.stringify({
        sugarsPer100g: sugars,
        sodiumMgPer100g: sodium,
        ingredientsText,
        nutritionSource,
    });
};

const attachNutritionDescription = (payload, data) => {
    const baseDescription = stripNutritionMeta(data.description || '');
    const nutritionBlock = buildNutritionMeta(data);

    if (nutritionBlock) {
        payload.description = `${baseDescription}${NUTRITION_META_MARKER}${nutritionBlock}`;
    } else if (baseDescription) {
        payload.description = baseDescription;
    } else if (payload.description !== undefined) {
        payload.description = '';
    }
};

/** Optional product nutrition handling.
 * Appwrite collections may reject unknown top-level attributes (e.g. sugarsPer100g).
 * To avoid invalid-document errors, we persist nutrition as a hidden JSON block in `description`.
 */
const attachOptionalNutrition = (payload, data, { allowNullClear = false } = {}) => {
    attachNutritionDescription(payload, data);

    // Defensive: ensure we never send legacy top-level nutrition keys or unsupported nested fields.
    delete payload.nutrition;
    delete payload.sugarsPer100g;
    delete payload.sodiumMgPer100g;
    delete payload.ingredientsText;
    delete payload.nutritionSource;

    if (allowNullClear && !payload.description) {
        payload.description = '';
    }

    return payload;
};

const useProductsStore = create((set, get) => ({
    products: [],
    loading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 10,

    setPage: (page) => set({ page }),

    fetchProducts: async (page = 1) => {
        set({ loading: true, error: null });
        try {
            const limit = get().limit;
            const offset = (page - 1) * limit;

            const response = await db.products.list([
                Query.limit(limit),
                Query.offset(offset),
                Query.orderDesc('$createdAt')
            ]);
            set({ 
                products: response.documents, 
                total: response.total,
                page: page,
                loading: false 
            });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    uploadProductImage: async (file) => {
        if (!file) return '';
        try {
            const response = await storage.createFile(
                PRODUCT_IMAGES_BUCKET,
                ID.unique(),
                file
            );

            return `${APPWRITE_ENDPOINT}/storage/buckets/${PRODUCT_IMAGES_BUCKET}/files/${response.$id}/view?project=${APPWRITE_PROJECT_ID}`;
        } catch (error) {
            console.error('Product image upload failed:', error);
            set({ error: error.message });
            return '';
        }
    },

    addProduct: async (data) => {
        set({ loading: true, error: null });
        console.log('Adding product to Appwrite:', data);
        try {
            const payload = {
                name: data.name,
                barcode: data.barcode,
                imageUrl: data.imageUrl,
                stockQuantity: parseInt(data.stockQuantity)
            };

            // Add optional fields
            if (data.brand) {
                payload.brand = String(data.brand).trim();
            }

            if (data.description) {
                payload.description = data.description;
            }

            // Add relationships - these are Many-to-One, so send as string ID or null
            if (data.categoryId) {
                payload.categoryId = data.categoryId;
            }

            if (data.supermarkets) {
                payload.supermarkets = data.supermarkets;
            }

            attachOptionalNutrition(payload, data);

            console.log('Payload being sent:', payload);

            const result = await db.products.create(payload);
            console.log('Product created successfully:', result);
            await useProductsStore.getState().fetchProducts();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add product error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                type: error.type
            });
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateProductOpeMapping: async (id, mapping) => {
        set({ loading: true, error: null });
        try {
            const payload = {};
            if (mapping?.opeStore != null) payload.opeStore = String(mapping.opeStore).trim();
            if (mapping?.opeProductName != null) {
                payload.opeProductName = String(mapping.opeProductName).trim();
            }
            if (mapping?.opeLastImportAt != null) payload.opeLastImportAt = mapping.opeLastImportAt;
            if (!Object.keys(payload).length) {
                set({ loading: false });
                return true;
            }
            await db.products.update(id, payload);
            await useProductsStore.getState().fetchProducts();
            set({ loading: false });
            return true;
        } catch (error) {
            console.warn('OPE mapping update failed (add opeStore, opeProductName, opeLastImportAt to products schema):', error);
            set({ loading: false });
            return false;
        }
    },

    updateProduct: async (id, data) => {
        set({ loading: true, error: null });
        console.log('Updating product:', id, data);
        try {
            const payload = {
                name: data.name,
                barcode: data.barcode,
                imageUrl: data.imageUrl,
                stockQuantity: parseInt(data.stockQuantity)
            };

            // Add optional fields
            if (data.brand) {
                payload.brand = String(data.brand).trim();
            }

            if (data.description) {
                payload.description = data.description;
            }

            // Add relationships
            if (data.categoryId) {
                payload.categoryId = data.categoryId;
            }

            if (data.supermarkets) {
                payload.supermarkets = data.supermarkets;
            }

            if (data.opeStore !== undefined) {
                payload.opeStore = String(data.opeStore).trim();
            }
            if (data.opeProductName !== undefined) {
                payload.opeProductName = String(data.opeProductName).trim();
            }
            if (data.opeLastImportAt !== undefined) {
                payload.opeLastImportAt = data.opeLastImportAt;
            }

            attachOptionalNutrition(payload, data, { allowNullClear: true });

            console.log('Update payload:', payload);

            const result = await db.products.update(id, payload);
            console.log('Product updated successfully:', result);
            await useProductsStore.getState().fetchProducts();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Update product error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                type: error.type
            });
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteProduct: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.products.delete(id);
            await useProductsStore.getState().fetchProducts();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useProductsStore;
