import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const resolveSystemTheme = () => {
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
        return 'light';
    }
};

const applyThemeClass = (theme) => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
};

const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'system', // 'system' | 'light' | 'dark'
            effectiveTheme: 'light',

            setTheme: (next) => {
                const theme = next === 'dark' || next === 'light' || next === 'system' ? next : 'system';
                const effectiveTheme = theme === 'system' ? resolveSystemTheme() : theme;
                applyThemeClass(effectiveTheme);
                set({ theme, effectiveTheme });
            },

            toggleTheme: () => {
                const { theme, effectiveTheme } = get();
                const base = theme === 'system' ? effectiveTheme : theme;
                const next = base === 'dark' ? 'light' : 'dark';
                applyThemeClass(next);
                set({ theme: next, effectiveTheme: next });
            },
        }),
        {
            name: 'pricemate-admin-theme',
            onRehydrateStorage: () => (state) => {
                const theme = state?.theme || 'system';
                const effectiveTheme = theme === 'system' ? resolveSystemTheme() : theme;
                applyThemeClass(effectiveTheme);
                state?.setTheme?.(theme);
            },
        }
    )
);

export default useThemeStore;

