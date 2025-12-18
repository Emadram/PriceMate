import { create } from 'zustand';
import { account } from '../lib/appwrite';
import { ID } from 'appwrite';

const useAuthStore = create((set, get) => ({
    user: null,
    session: null,
    loading: true,
    error: null,

    init: async () => {
        try {
            const user = await account.get();
            set({ user, loading: false });
        } catch (error) {
            set({ user: null, loading: false });
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const session = await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            set({ user, session, loading: false });
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    register: async (email, password, name) => {
        set({ loading: true, error: null });
        try {
            await account.create(ID.unique(), email, password, name);
            await get().login(email, password);
            return true;
        } catch (error) {
            set({ error: error.message, loading: false });
            return false;
        }
    },

    logout: async () => {
        try {
            await account.deleteSession('current');
            set({ user: null, session: null });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}));

export default useAuthStore;
