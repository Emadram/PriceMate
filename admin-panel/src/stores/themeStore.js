import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
    persist(
        (set) => ({
            theme: 'light', // Default to light mode
            toggleTheme: () => set((state) => {
                const newTheme = state.theme === 'light' ? 'dark' : 'light';
                document.documentElement.classList.toggle('dark', newTheme === 'dark');
                return { theme: newTheme };
            }),
            setTheme: (theme) => {
                document.documentElement.classList.toggle('dark', theme === 'dark');
                set({ theme });
            }
        }),
        {
            name: 'pricemate-admin-theme',
            onRehydrateStorage: () => (state) => {
                // Only apply dark class if theme is explicitly set to dark
                if (state && state.theme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        }
    )
);

export default useThemeStore;
