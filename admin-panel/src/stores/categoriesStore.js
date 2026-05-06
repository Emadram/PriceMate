import { create } from 'zustand';
import { db } from '../lib/appwrite';

const useCategoriesStore = create((set) => ({
    categories: [],
    loading: false,
    error: null,

    fetchCategories: async () => {
        set({ loading: true, error: null });
        try {
            const response = await db.categories.list();
            set({ categories: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    addCategory: async (data) => {
        set({ loading: true, error: null });
        console.log('Adding category to Appwrite:', data);
        try {
            const payload = {
                categoryName: data.categoryName
            };

            // Only add icon if it exists in the schema
            if (data.icon) {
                payload.icon = data.icon;
            }

            console.log('Payload being sent:', payload);

            const result = await db.categories.create(payload);
            console.log('Category created successfully:', result);
            await useCategoriesStore.getState().fetchCategories();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add category error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                type: error.type
            });
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateCategory: async (id, data) => {
        set({ loading: true, error: null });
        try {
            await db.categories.update(id, {
                categoryName: data.categoryName,
                icon: data.icon || null
            });
            await useCategoriesStore.getState().fetchCategories();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteCategory: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.categories.delete(id);
            await useCategoriesStore.getState().fetchCategories();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

export default useCategoriesStore;
