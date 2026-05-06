import { create } from 'zustand';
import { db, storage, getAppwriteConfig } from '../lib/appwrite';
import { ID, Query } from 'appwrite';

const { endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID } = getAppwriteConfig();
const PRODUCT_IMAGES_BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_SUPERMARKET_LOGOS || 'product-images';

/** Optional product nutrition for in-app AI (Appwrite `products` attributes must exist). */
const attachOptionalNutrition = (payload, data, { allowNullClear = false } = {}) => {
    const rawSugars = data.sugarsPer100g;
    const rawSodium = data.sodiumMgPer100g;

    const sugarsEmpty = rawSugars === undefined || rawSugars === null || String(rawSugars).trim() === '';
    const sodiumEmpty = rawSodium === undefined || rawSodium === null || String(rawSodium).trim() === '';

    if (!sugarsEmpty) {
        const n = parseFloat(String(rawSugars).replace(',', '.'));
        if (Number.isFinite(n)) payload.sugarsPer100g = n;
    } else if (allowNullClear) {
        payload.sugarsPer100g = null;
    }

    if (!sodiumEmpty) {
        const n = parseFloat(String(rawSodium).replace(',', '.'));
        if (Number.isFinite(n)) payload.sodiumMgPer100g = n;
    } else if (allowNullClear) {
        payload.sodiumMgPer100g = null;
    }

    if (data.ingredientsText !== undefined && data.ingredientsText !== null) {
        const t = String(data.ingredientsText).trim();
        if (t || allowNullClear) payload.ingredientsText = t || null;
    }

    if (data.nutritionSource !== undefined && data.nutritionSource !== null) {
        const t = String(data.nutritionSource).trim();
        if (t || allowNullClear) payload.nutritionSource = t || null;
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
