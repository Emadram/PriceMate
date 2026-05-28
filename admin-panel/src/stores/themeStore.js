import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const applyThemeClass = (theme) => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
};

const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'light', // 'light' | 'dark'
            effectiveTheme: 'light',

            setTheme: (next) => {
                const theme = next === 'dark' || next === 'light' ? next : 'light';
                applyThemeClass(theme);
                set({ theme, effectiveTheme: theme });
            },

            toggleTheme: () => {
                const { theme, effectiveTheme } = get();
                const base = theme === 'dark' || theme === 'light' ? theme : effectiveTheme;
                const next = base === 'dark' ? 'light' : 'dark';
                applyThemeClass(next);
                set({ theme: next, effectiveTheme: next });
            },
        }),
        {
            name: 'pricemate-admin-theme',
            onRehydrateStorage: () => (state) => {
                const theme = state?.theme === 'dark' || state?.theme === 'light' ? state.theme : 'light';
                applyThemeClass(theme);
                state?.setTheme?.(theme);
            },
        }
    )
);

export default useThemeStore;

