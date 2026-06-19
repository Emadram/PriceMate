import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, Query } from '../lib/appwrite';
import useAuthStore from './authStore';
import { FAVORITES_SYNC_TTL_MS } from '../utils/cacheTtls';

const useFavoritesStore = create(
    persist(
        (set, get) => ({
            favoriteProducts: [],
            favoriteSupermarkets: [],
            loading: false,
            lastSyncedAt: 0,
            _warnedMissingFavorites: false,

            // Fetch favorites from backend
            syncFavorites: async ({ force = false } = {}) => {
                const user = useAuthStore.getState().user;
                if (!user) return;

                const { lastSyncedAt } = get();
                if (!force && lastSyncedAt && Date.now() - lastSyncedAt < FAVORITES_SYNC_TTL_MS) {
                    return;
                }

                set({ loading: true });
                try {
                    const FAV_PAGE = 100;
                    const allDocs = [];
                    let lastId;
                    for (;;) {
                        const queries = [
                            Query.equal('userId', user.$id),
                            Query.limit(FAV_PAGE),
                            Query.select(['$id', 'productId', 'supermarketId']),
                            Query.orderAsc('$id'),
                        ];
                        if (lastId) queries.push(Query.cursorAfter(lastId));
                        const page = await db.favorites.list(queries);
                        if (page.documents.length === 0) break;
                        allDocs.push(...page.documents);
                        if (page.documents.length < FAV_PAGE) break;
                        lastId = page.documents[page.documents.length - 1].$id;
                    }
                    const response = { documents: allDocs };

                    const products = response.documents
                        .filter(doc => doc.productId && doc.productId !== '')
                        .map(doc => doc.productId);

                    const supermarkets = response.documents
                        .filter(doc => doc.supermarketId && doc.supermarketId !== '')
                        .map(doc => doc.supermarketId);

                    set({
                        favoriteProducts: [...new Set(products)],
                        favoriteSupermarkets: [...new Set(supermarkets)],
                        loading: false,
                        lastSyncedAt: Date.now(),
                    });
                } catch (error) {
                    if (error?.code === 404) {
                        if (!get()._warnedMissingFavorites) {
                            console.warn('Favorites collection missing in Appwrite (404). Skipping sync.');
                            set({ _warnedMissingFavorites: true });
                        }
                    } else {
                        console.error('Error fetching favorites:', error);
                    }
                    set({ loading: false });
                }
            },

            // Products
            toggleProductFavorite: async (productId) => {
                const user = useAuthStore.getState().user;
                if (!user) return;

                const { favoriteProducts } = get();
                const isFavorite = favoriteProducts.includes(productId);

                try {
                    if (isFavorite) {
                        const response = await db.favorites.list(
                            [
                                Query.equal('userId', user.$id),
                                Query.equal('productId', productId),
                                Query.limit(5),
                                Query.select(['$id'])
                            ]
                        );

                        for (const doc of response.documents) {
                            await db.favorites.delete(doc.$id);
                        }
                    } else {
                        await db.favorites.create({
                            userId: user.$id,
                            productId: productId,
                            supermarketId: ''
                            }
                        );
                    }
                } catch (error) {
                    console.error('Error toggling product favorite in backend:', error);
                }

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
                if (!user) return;

                const { favoriteSupermarkets } = get();
                const isFavorite = favoriteSupermarkets.includes(supermarketId);

                try {
                    if (isFavorite) {
                        const response = await db.favorites.list(
                            [
                                Query.equal('userId', user.$id),
                                Query.equal('supermarketId', supermarketId),
                                Query.limit(5),
                                Query.select(['$id'])
                            ]
                        );

                        for (const doc of response.documents) {
                            await db.favorites.delete(doc.$id);
                        }
                    } else {
                        await db.favorites.create({
                            userId: user.$id,
                            supermarketId: supermarketId,
                            productId: ''
                        });
                    }
                } catch (error) {
                    console.error('Error toggling supermarket favorite in backend:', error);
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
                set({ favoriteProducts: [], favoriteSupermarkets: [], lastSyncedAt: 0 });
            }
        }),
        {
            name: 'pricemate-favorites'
        }
    )
);

export default useFavoritesStore;
