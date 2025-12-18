import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useFavoritesStore = create(
    persist(
        (set, get) => ({
            favoriteProducts: [],
            favoriteSupermarkets: [],

            // Products
            toggleProductFavorite: (productId) => {
                const { favoriteProducts } = get();
                if (favoriteProducts.includes(productId)) {
                    set({ favoriteProducts: favoriteProducts.filter(id => id !== productId) });
                } else {
                    set({ favoriteProducts: [...favoriteProducts, productId] });
                }
            },

            isProductFavorite: (productId) => {
                return get().favoriteProducts.includes(productId);
            },

            // Supermarkets
            toggleSupermarketFavorite: (supermarketId) => {
                const { favoriteSupermarkets } = get();
                if (favoriteSupermarkets.includes(supermarketId)) {
                    set({ favoriteSupermarkets: favoriteSupermarkets.filter(id => id !== supermarketId) });
                } else {
                    set({ favoriteSupermarkets: [...favoriteSupermarkets, supermarketId] });
                }
            },

            isSupermarketFavorite: (supermarketId) => {
                return get().favoriteSupermarkets.includes(supermarketId);
            }
        }),
        {
            name: 'pricemate-favorites'
        }
    )
);

export default useFavoritesStore;
