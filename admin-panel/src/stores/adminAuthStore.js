import { create } from 'zustand';
import { account } from '../lib/appwrite';
import { ID } from 'appwrite';

const useAdminAuthStore = create((set, get) => ({
    admin: null,
    session: null,
    loading: true,
    error: null,

    init: async () => {
        try {
            const user = await account.get();
            set({ admin: user, loading: false });
        } catch (error) {
            set({ admin: null, loading: false });
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const session = await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            set({ admin: user, session, loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    logout: async () => {
        try {
            await account.deleteSession('current');
            set({ admin: null, session: null });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}));

export default useAdminAuthStore;
