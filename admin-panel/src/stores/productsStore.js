import { create } from 'zustand';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { ID, Query } from 'appwrite';

const useProductsStore = create((set) => ({
    products: [],
    loading: false,
    error: null,

    fetchProducts: async () => {
        set({ loading: true, error: null });
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS
            );
            set({ products: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
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

            console.log('Payload being sent:', payload);

            const result = await databases.createDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                ID.unique(),
                payload
            );
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

            console.log('Update payload:', payload);

            const result = await databases.updateDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                id,
                payload
            );
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
            await databases.deleteDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                id
            );
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
