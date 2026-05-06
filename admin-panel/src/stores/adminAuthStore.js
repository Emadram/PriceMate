import { create } from 'zustand';
import { account, teams } from '../lib/appwrite';
import { ID } from 'appwrite';
import toast from 'react-hot-toast';

const useAdminAuthStore = create((set, get) => ({
    admin: null,
    session: null,
    loading: true,
    error: null,

    checkAdminStatus: async () => {
        try {
            const userTeams = await teams.list();
            const isAdmin = userTeams.teams.some(team => team.name.toLowerCase() === 'admins');
            if (!isAdmin) {
                await account.deleteSession('current');
                set({ admin: null, session: null, error: 'Access denied: You are not an administrator.' });
                toast.error('Access denied: Unauthorized identity');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Admin status check failed:', error);
            toast.error('Identity verification failed');
            return false;
        }
    },

    init: async () => {
        try {
            const user = await account.get();
            const isAdmin = await get().checkAdminStatus();
            if (isAdmin) {
                set({ admin: user, loading: false });
            } else {
                set({ loading: false });
            }
        } catch (error) {
            set({ admin: null, loading: false });
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            
            // Critical check for admin team membership
            const isAdmin = await get().checkAdminStatus();
            if (!isAdmin) {
                return false;
            }

            set({ admin: user, loading: false });
            toast.success('Welcome back, Admin');
            return true;
        } catch (error) {
            const message = error.message || 'Login failed';
            set({ error: message, loading: false });
            toast.error(message);
            return false;
        }
    },

    logout: async () => {
        try {
            await account.deleteSession('current');
            set({ admin: null, session: null });
            toast.success('Logged out');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Logout failed');
        }
    }
}));

export default useAdminAuthStore;
