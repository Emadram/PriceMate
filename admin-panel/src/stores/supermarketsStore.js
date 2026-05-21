import { create } from 'zustand';
import { db, storage, getAppwriteConfig } from '../lib/appwrite';
import { ID } from 'appwrite';

const { endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID } = getAppwriteConfig();
const SUPERMARKETS_LOGO_BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_SUPERMARKET_LOGOS || 'supermarkets-logo';

const useSupermarketsStore = create((set) => ({
    supermarkets: [],
    loading: false,
    error: null,

    fetchSupermarkets: async () => {
        set({ loading: true, error: null });
        try {
            const response = await db.supermarkets.list();
            set({ supermarkets: response.documents, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    uploadSupermarketLogo: async (file) => {
        if (!file) return '';
        try {
            const response = await storage.createFile(
                SUPERMARKETS_LOGO_BUCKET,
                ID.unique(),
                file
            );

            return `${APPWRITE_ENDPOINT}/storage/buckets/${SUPERMARKETS_LOGO_BUCKET}/files/${response.$id}/view?project=${APPWRITE_PROJECT_ID}`;
        } catch (error) {
            console.error('Supermarket logo upload failed:', error);
            set({ error: error.message });
            return '';
        }
    },

    addSupermarket: async (data) => {
        set({ loading: true, error: null });
        try {
            guardCoordinates(data);
            await db.supermarkets.create({
                name: data.name,
                brand: data.brand || null,
                branchName: data.branchName || null,
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                address: data.address || null,
                phoneNumber: data.phoneNumber || null,
                email: data.email || null,
                icon: data.icon || null,
                isParent: data.isParent || false,
                parentId: data.parentId || null
            });
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Add supermarket error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    updateSupermarket: async (id, data) => {
        set({ loading: true, error: null });
        try {
            guardCoordinates(data);
            await db.supermarkets.update(id, {
                name: data.name,
                brand: data.brand || null,
                branchName: data.branchName || null,
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                address: data.address || null,
                phoneNumber: data.phoneNumber || null,
                email: data.email || null,
                icon: data.icon || null,
                isParent: data.isParent || false,
                parentId: data.parentId || null
            });
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Update supermarket error:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteSupermarket: async (id) => {
        set({ loading: true, error: null });
        try {
            await db.supermarkets.delete(id);
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));

const validateSupermarketCoordinates = (latitude, longitude) => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return 'Invalid coordinates: latitude and longitude must be numeric.';
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return 'Invalid coordinates: latitude must be between -90 and 90 and longitude between -180 and 180.';
    }
    if (lat === 0 && lon === 0) {
        return 'Invalid coordinates: (0, 0) is a placeholder and cannot be saved.';
    }
    return '';
};

const guardCoordinates = (data) => {
    const error = validateSupermarketCoordinates(data.latitude, data.longitude);
    if (error) throw new Error(error);
};

export default useSupermarketsStore;
