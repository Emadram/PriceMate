import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../lib/appwrite';
import { ID } from 'appwrite';
import useAuthStore from './authStore';

const useFavoritesStore = create(
    persist(
        (set, get) => ({
            favoriteProducts: [],
            favoriteSupermarkets: [],
            loading: false,

            // Fetch favorites from backend
            syncFavorites: async () => {
                const user = useAuthStore.getState().user;
                if (!user) return;

                set({ loading: true });
                try {
                    const response = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.FAVORITES,
                        [Query.equal('userId', user.$id)]
                    );

                    const products = response.documents
                        .filter(doc => doc.productId && doc.productId !== '')
                        .map(doc => doc.productId);

                    const supermarkets = response.documents
                        .filter(doc => doc.supermarketId && doc.supermarketId !== '')
                        .map(doc => doc.supermarketId);

                    set({
                        favoriteProducts: [...new Set(products)],
                        favoriteSupermarkets: [...new Set(supermarkets)],
                        loading: false
                    });
                } catch (error) {
                    console.error('Error fetching favorites:', error);
                    set({ loading: false });
                }
            },

            // Products
            toggleProductFavorite: async (productId) => {
                const user = useAuthStore.getState().user;
                const { favoriteProducts } = get();
                const isFavorite = favoriteProducts.includes(productId);

                if (user) {
                    try {
                        if (isFavorite) {
                            // Find and delete the document in Appwrite
                            const response = await databases.listDocuments(
                                DATABASE_ID,
                                COLLECTIONS.FAVORITES,
                                [
                                    Query.equal('userId', user.$id),
                                    Query.equal('productId', productId)
                                ]
                            );

                            // Delete all matches just in case of duplicates
                            for (const doc of response.documents) {
                                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.FAVORITES, doc.$id);
                            }
                        } else {
                            // Create document in Appwrite
                            await databases.createDocument(
                                DATABASE_ID,
                                COLLECTIONS.FAVORITES,
                                ID.unique(),
                                {
                                    userId: user.$id,
                                    productId: productId,
                                    supermarketId: '' // Explicitly set to empty string if your collection allows it or depends on your schema
                                }
                            );
                        }
                    } catch (error) {
                        console.error('Error toggling product favorite in backend:', error);
                        // Optionally show an alert or toast here
                    }
                }

                // Update local state regardless (provides instant feedback)
                if (isFavorite) {
                    set({ favoriteProducts: favoriteProducts.filter(id => id !== productId) });
                } else {
                    set({ favoriteProducts: [...favoriteProducts, productId] });
                }
            },

            isProductFavorite: (productId) => {
                return get().favoriteProducts.includes(productId);
            },

            // Supermarkets
            toggleSupermarketFavorite: async (supermarketId) => {
                const user = useAuthStore.getState().user;
                const { favoriteSupermarkets } = get();
                const isFavorite = favoriteSupermarkets.includes(supermarketId);

                if (user) {
                    try {
                        if (isFavorite) {
                            // Find and delete the document in Appwrite
                            const response = await databases.listDocuments(
                                DATABASE_ID,
                                COLLECTIONS.FAVORITES,
                                [
                                    Query.equal('userId', user.$id),
                                    Query.equal('supermarketId', supermarketId)
                                ]
                            );

                            for (const doc of response.documents) {
                                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.FAVORITES, doc.$id);
                            }
                        } else {
                            // Create document in Appwrite
                            await databases.createDocument(
                                DATABASE_ID,
                                COLLECTIONS.FAVORITES,
                                ID.unique(),
                                {
                                    userId: user.$id,
                                    supermarketId: supermarketId,
                                    productId: ''
                                }
                            );
                        }
                    } catch (error) {
                        console.error('Error toggling supermarket favorite in backend:', error);
                    }
                }

                if (isFavorite) {
                    set({ favoriteSupermarkets: favoriteSupermarkets.filter(id => id !== supermarketId) });
                } else {
                    set({ favoriteSupermarkets: [...favoriteSupermarkets, supermarketId] });
                }
            },

            isSupermarketFavorite: (supermarketId) => {
                return get().favoriteSupermarkets.includes(supermarketId);
            },

            // Clear favorites (e.g. on logout)
            clearFavorites: () => {
                set({ favoriteProducts: [], favoriteSupermarkets: [] });
            }
        }),
        {
            name: 'pricemate-favorites'
        }
    )
);

export default useFavoritesStore;
