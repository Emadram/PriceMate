import { create } from 'zustand';
import { account } from '../lib/appwrite';
import { ID } from 'appwrite';

const useAuthStore = create((set, get) => ({
    user: null,
    loading: true,
    error: null,

    // Initialize session
    checkSession: async () => {
        set({ loading: true, error: null });
        try {
            const user = await account.get();
            set({ user, loading: false });
        } catch (error) {
            // No session found - clean state but don't error loudly
            set({ user: null, loading: false });
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            set({ user, loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    signup: async (email, password, name) => {
        set({ loading: true, error: null });
        try {
            // Create account
            await account.create(ID.unique(), email, password, name);
            // Auto login
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            set({ user, loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    logout: async () => {
        set({ loading: true, error: null });
        try {
            await account.deleteSession('current');
            set({ user: null, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    }
}));

export default useAuthStore;
