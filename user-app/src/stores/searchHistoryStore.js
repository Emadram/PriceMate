import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSearchHistoryStore = create(
    persist(
        (set, get) => ({
            history: [],

            addSearch: (query) => {
                const { history } = get();
                // Remove duplicates and add to front
                const newHistory = [
                    query,
                    ...history.filter(item => item !== query)
                ].slice(0, 10); // Keep only last 10 searches

                set({ history: newHistory });
            },

            clearHistory: () => set({ history: [] }),

            removeSearch: (query) => {
                const { history } = get();
                set({ history: history.filter(item => item !== query) });
            }
        }),
        {
            name: 'pricemate-search-history'
        }
    )
);

export default useSearchHistoryStore;
