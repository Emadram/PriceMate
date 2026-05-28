import { create } from 'zustand';
import { db, storage, getAppwriteConfig } from '../lib/appwrite';
import { ID } from 'appwrite';
import { validateSupermarketCoordinates } from '../utils/coordinateValidation';

const { endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID } = getAppwriteConfig();
const SUPERMARKETS_LOGO_BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_SUPERMARKET_LOGOS || 'supermarkets-logo';

const normalizeOptionalNumber = (value, parser) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parser(value);
    return Number.isFinite(parsed) ? parsed : null;
};

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
                latitude: normalizeOptionalNumber(data.latitude, Number.parseFloat),
                longitude: normalizeOptionalNumber(data.longitude, Number.parseFloat),
                address: data.address || null,
                embedHtml: data.embedHtml || null,
                phoneNumber: data.phoneNumber || null,
                email: data.email || null,
                icon: data.icon || null,
                isParent: data.isParent || false,
                parentId: data.parentId || null,
                status: data.status || 'open',
                googleMapsUrl: data.googleMapsUrl || null,
                rating: normalizeOptionalNumber(data.rating, Number.parseFloat),
                reviewsCount: normalizeOptionalNumber(data.reviewsCount, (value) => Number.parseInt(value, 10))
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
                latitude: normalizeOptionalNumber(data.latitude, Number.parseFloat),
                longitude: normalizeOptionalNumber(data.longitude, Number.parseFloat),
                address: data.address || null,
                embedHtml: data.embedHtml || null,
                phoneNumber: data.phoneNumber || null,
                email: data.email || null,
                icon: data.icon || null,
                isParent: data.isParent || false,
                parentId: data.parentId || null,
                status: data.status ?? undefined,
                googleMapsUrl: data.googleMapsUrl || null,
                rating: normalizeOptionalNumber(data.rating, Number.parseFloat),
                reviewsCount: normalizeOptionalNumber(data.reviewsCount, (value) => Number.parseInt(value, 10))
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

    setSupermarketStatus: async (id, status) => {
        set({ loading: true, error: null });
        try {
            await db.supermarkets.update(id, { status });
            await useSupermarketsStore.getState().fetchSupermarkets();
            set({ loading: false });
            return true;
        } catch (error) {
            console.error('Set supermarket status error:', error);
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

const guardCoordinates = (data) => {
    const hasEmbed = String(data.embedHtml || '').trim().length > 0;
    if (hasEmbed) return;
    const error = validateSupermarketCoordinates(data.latitude, data.longitude);
    if (error) throw new Error(error);
};

export default useSupermarketsStore;
export { validateSupermarketCoordinates };
