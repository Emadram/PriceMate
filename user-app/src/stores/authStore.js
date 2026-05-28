import { create } from 'zustand';
import { account } from '../lib/appwrite';
import { ID } from 'appwrite';
import toast from 'react-hot-toast';
import useNavHistoryStore from './navHistoryStore';
import { buildStoredAiProfilePrefs, buildStoredAllergyPrefs, normalizeAiProfile, normalizeAllergyProfile } from '../utils/aiCheckUtils';

const normalizeAllergyPrefs = (value) => {
    return normalizeAllergyProfile(value);
};

const clearAiChatIntentCache = () => {
    try {
        Object.keys(window.localStorage || {})
            .filter((key) => key.startsWith('pricemate_intent_cache_'))
            .forEach((key) => window.localStorage.removeItem(key));
    } catch {
        // Cache clearing is best-effort; preference saving should not fail because of storage.
    }
};

const useAuthStore = create((set, get) => ({
    user: null,
    loading: true,
    error: null,
    errorCode: null,

    // Initialize session
    checkSession: async () => {
        set({ loading: true, error: null, errorCode: null });
        try {
            const user = await account.get();
            set({ user, loading: false });
        } catch (error) {
            // Silently handle 401 Unauthorized (unauthenticated users)
            // Or "User (role: guests) missing scopes (['account'])" error
            if (error.code === 401 || error.type === 'general_unauthorized_scope') {
                set({ user: null, loading: false, errorCode: null });
                return;
            }
            console.error('Session Check Error:', error.message);
            set({ user: null, loading: false, error: error.message, errorCode: null });
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null, errorCode: null });
        try {
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            if (!user.emailVerification) {
                await account.deleteSession('current');
                const message = 'Please verify your email before logging in.';
                set({ user: null, loading: false, error: message, errorCode: 'email_not_verified' });
                toast.error(message, { duration: 5000 });
                return false;
            }
            set({ user, loading: false, errorCode: null });
            toast.success('Welcome back!');
            return true;
        } catch (error) {
            const message = error.message || 'Login failed';
            set({ error: message, loading: false, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    signup: async (email, password, name, allergies = []) => {
        set({ loading: true, error: null, errorCode: null });
        try {
            if (!password || password.length < 8) {
                const message = 'Password must be at least 8 characters.';
                set({ error: message, loading: false, errorCode: 'password_too_short' });
                toast.error(message);
                return false;
            }

            const allergyPrefs = buildStoredAllergyPrefs(allergies);
            // Create account
            await account.create(ID.unique(), email, password, name);
            
            // Create a temporary session just to trigger verification
            // Appwrite requires a session to send a verification email
            await account.createEmailPasswordSession(email, password);
            
            try {
                try {
                    await account.updatePrefs(allergyPrefs);
                } catch (prefsError) {
                    console.error('Could not persist allergy preferences during signup:', prefsError);
                }

                await account.createVerification(`${window.location.origin}/verify-email`);
                
                // CRITICAL: Log out immediately after triggering verification
                // This ensures the user must use the verification link to fully "activate"
                // and prevents them from being logged in with an unverified account.
                await account.deleteSession('current');
                
                set({ user: null, loading: false, errorCode: null });
                toast.success('Account created! Please verify your email to log in.', {
                    duration: 6000
                });
                return true;
            } catch (verifyError) {
                console.error('Verification error:', verifyError);
                // If verification triggers fail, we still log them out for safety
                await account.deleteSession('current');
                set({ user: null, loading: false, errorCode: null });
                toast.error('Account created, but failed to send verification email. Please contact support.');
                return false;
            }
        } catch (error) {
            const message = error.message || 'Signup failed';
            set({ error: message, loading: false, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    verifyEmail: async (userId, secret) => {
        set({ loading: true, error: null, errorCode: null });
        try {
            await account.updateVerification(userId, secret);
            set({ loading: false, errorCode: null });
            // Try to refresh user in the background if a session exists
            account.get()
                .then((user) => set({ user }))
                .catch(() => {});
            toast.success('Email verified successfully!');
            return true;
        } catch (error) {
            // Check if the error is actually because it was already verified
            // (common in double-execution scenarios)
            if (error.message?.toLowerCase().includes('already verified') || error.code === 401) {
                const user = await account.get().catch(() => null);
                if (user?.emailVerification) {
                    set({ user, loading: false, errorCode: null });
                    return true; // Treat as success if they are already verified
                }
            }

            const message = error.message || 'Verification failed';
            set({ error: message, loading: false, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    resendVerification: async (email, password) => {
        set({ loading: true, error: null, errorCode: null });
        try {
            await account.createEmailPasswordSession(email, password);
            try {
                await account.createVerification(`${window.location.origin}/verify-email`);
                toast.success('Verification email sent. Please check your inbox.');
            } finally {
                await account.deleteSession('current');
            }
            set({ loading: false, errorCode: null });
            return true;
        } catch (error) {
            const message = error.message || 'Failed to resend verification email';
            set({ error: message, loading: false, errorCode: 'resend_failed' });
            toast.error(message);
            return false;
        }
    },

    requestPasswordReset: async (email) => {
        set({ loading: true, error: null, errorCode: null });
        try {
            await account.createRecovery(email, `${window.location.origin}/reset-password`);
            set({ loading: false, errorCode: null });
            toast.success('Password reset email sent. Please check your inbox.');
            return true;
        } catch (error) {
            const message = error.message || 'Failed to send reset email';
            set({ error: message, loading: false, errorCode: 'reset_request_failed' });
            toast.error(message);
            return false;
        }
    },

    confirmPasswordReset: async (userId, secret, password, confirmPassword) => {
        set({ loading: true, error: null, errorCode: null });
        if (!password || password !== confirmPassword) {
            const message = 'Passwords do not match.';
            set({ error: message, loading: false, errorCode: 'password_mismatch' });
            toast.error(message);
            return false;
        }
        if (password.length < 8) {
            const message = 'Password must be at least 8 characters.';
            set({ error: message, loading: false, errorCode: 'password_too_short' });
            toast.error(message);
            return false;
        }

        try {
            await account.updateRecovery(userId, secret, password, confirmPassword);
            set({ loading: false, errorCode: null });
            toast.success('Password updated. You can now sign in.');
            return true;
        } catch (error) {
            const message = error.message || 'Failed to reset password';
            set({ error: message, loading: false, errorCode: 'reset_confirm_failed' });
            toast.error(message);
            return false;
        }
    },

    logout: async () => {
        set({ loading: true, error: null, errorCode: null });
        try {
            await account.deleteSession('current');
            set({ user: null, loading: false, errorCode: null });
            // Clear navigation history on logout to avoid leaking previous routes
            try { useNavHistoryStore.getState().clear(); } catch { void 0; }
            toast.success('Logged out');
        } catch (error) {
            const message = error.message || 'Logout failed';
            set({ error: message, loading: false, errorCode: null });
            toast.error(message);
        }
    },

    updateProfileName: async (name) => {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (!trimmed) {
            toast.error('Please enter a name.');
            return false;
        }
        try {
            const user = await account.updateName(trimmed);
            set({ user, error: null, errorCode: null });
            toast.success('Name updated');
            return true;
        } catch (error) {
            const message = error.message || 'Could not update name';
            set({ error: message, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    updatePasswordWhileLoggedIn: async (oldPassword, newPassword, confirmPassword) => {
        if (!oldPassword) {
            toast.error('Enter your current password.');
            return false;
        }
        if (!newPassword || newPassword !== confirmPassword) {
            toast.error('New passwords do not match.');
            return false;
        }
        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return false;
        }
        try {
            const user = await account.updatePassword(newPassword, oldPassword);
            set({ user, error: null, errorCode: null });
            toast.success('Password updated');
            return true;
        } catch (error) {
            const message = error.message || 'Could not update password';
            set({ error: message, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    updateAllergyPreferences: async (allergies = []) => {
        const normalizedPrefs = buildStoredAllergyPrefs(normalizeAllergyPrefs(allergies));
        try {
            const currentUser = get().user;
            const currentPrefs = currentUser?.prefs && typeof currentUser.prefs === 'object'
                ? currentUser.prefs
                : {};
            const nextPrefs = {
                ...currentPrefs,
                ...normalizedPrefs
            };
            const user = await account.updatePrefs(nextPrefs);
            clearAiChatIntentCache();
            set({ user, error: null, errorCode: null });
            toast.success('AI allergy preferences updated');
            return true;
        } catch (error) {
            const message = error.message || 'Could not update allergy preferences';
            set({ error: message, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    updateAiProfilePreferences: async (profile = {}) => {
        const normalizedPrefs = buildStoredAiProfilePrefs(normalizeAiProfile(profile));
        try {
            const currentUser = get().user;
            const currentPrefs = currentUser?.prefs && typeof currentUser.prefs === 'object'
                ? currentUser.prefs
                : {};
            const nextPrefs = {
                ...currentPrefs,
                ...normalizedPrefs
            };
            const user = await account.updatePrefs(nextPrefs);
            clearAiChatIntentCache();
            set({ user, error: null, errorCode: null });
            toast.success('AI shopping profile updated');
            return true;
        } catch (error) {
            const message = error.message || 'Could not update AI shopping profile';
            set({ error: message, errorCode: null });
            toast.error(message);
            return false;
        }
    },

    updateUiPreferences: async (partial = {}) => {
        try {
            const currentUser = get().user;
            const currentPrefs = currentUser?.prefs && typeof currentUser.prefs === 'object'
                ? currentUser.prefs
                : {};

            const nextPrefs = {
                ...currentPrefs,
                ...partial,
            };

            const user = await account.updatePrefs(nextPrefs);
            set({ user, error: null, errorCode: null });
            return true;
        } catch (error) {
            const message = error.message || 'Could not update preferences';
            set({ error: message, errorCode: null });
            toast.error(message);
            return false;
        }
    },
}));

export default useAuthStore;
