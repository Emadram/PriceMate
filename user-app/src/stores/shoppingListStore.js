import { create } from 'zustand';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../lib/appwrite';
import { ID } from 'appwrite';
import useAuthStore from './authStore';

const useShoppingListStore = create((set, get) => ({
    lists: [],
    loading: false,
    error: null,

    fetchLists: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ loading: true, error: null });
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.LISTS,
                [Query.equal('user_id', user.$id)]
            );

            // For each list, fetch its items
            const listsWithItems = await Promise.all(response.documents.map(async (list) => {
                const itemsResponse = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.LIST_ITEMS,
                    [Query.equal('list_id', list.$id)]
                );
                return { ...list, items: itemsResponse.documents };
            }));

            set({ lists: listsWithItems, loading: false });
        } catch (error) {
            console.error('Error fetching lists:', error);
            set({ error: error.message, loading: false });
        }
    },

    createList: async (name) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ loading: true, error: null });
        try {
            const newList = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.LISTS,
                ID.unique(),
                {
                    name: name,
                    user_id: user.$id
                }
            );
            // It starts with 0 items
            const listWithItems = { ...newList, items: [] };
            set((state) => ({
                lists: [...state.lists, listWithItems],
                loading: false
            }));
            return true;
        } catch (error) {
            console.error('Error creating list:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteList: async (listId) => {
        set({ loading: true, error: null });
        try {
            // 1. Delete all items in the list first (cleanup)
            const list = get().lists.find(l => l.$id === listId);
            if (list && list.items) {
                await Promise.all(list.items.map(item =>
                    databases.deleteDocument(DATABASE_ID, COLLECTIONS.LIST_ITEMS, item.$id)
                ));
            }

            // 2. Delete the list itself
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LISTS, listId);

            set((state) => ({
                lists: state.lists.filter((l) => l.$id !== listId),
                loading: false
            }));
            return true;
        } catch (error) {
            console.error('Error deleting list:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    addItem: async (listId, productId, quantity = 1) => {
        set({ loading: true, error: null });
        try {
            // Check if item already exists in list
            const currentList = get().lists.find(l => l.$id === listId);
            const existingItem = currentList?.items.find(item => item.product_id === productId);

            if (existingItem) {
                // Update quantity instead
                const updatedItem = await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.LIST_ITEMS,
                    existingItem.$id,
                    { quantity: existingItem.quantity + quantity }
                );
                // Update state
                set((state) => ({
                    lists: state.lists.map(l => {
                        if (l.$id === listId) {
                            return {
                                ...l,
                                items: l.items.map(i => i.$id === existingItem.$id ? updatedItem : i)
                            };
                        }
                        return l;
                    }),
                    loading: false
                }));
            } else {
                // Create new item
                const newItem = await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.LIST_ITEMS,
                    ID.unique(),
                    {
                        list_id: listId,
                        product_id: productId,
                        quantity: quantity,
                        checked: false
                    }
                );

                // Update state
                set((state) => ({
                    lists: state.lists.map(l => {
                        if (l.$id === listId) {
                            return {
                                ...l,
                                items: [...l.items, newItem]
                            };
                        }
                        return l;
                    }),
                    loading: false
                }));
            }
            return true;
        } catch (error) {
            console.error('Error adding item:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    toggleItem: async (listId, itemId) => {
        // Optimistic update
        const currentList = get().lists.find(l => l.$id === listId);
        const itemToToggle = currentList?.items.find(i => i.$id === itemId);
        if (!itemToToggle) return;

        const newStatus = !itemToToggle.checked;

        set((state) => ({
            lists: state.lists.map(l => {
                if (l.$id === listId) {
                    return {
                        ...l,
                        items: l.items.map(i => i.$id === itemId ? { ...i, checked: newStatus } : i)
                    };
                }
                return l;
            })
        }));

        try {
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.LIST_ITEMS,
                itemId,
                { checked: newStatus }
            );
        } catch (error) {
            console.error('Error toggling item:', error);
            // Revert on error
            set((state) => ({
                lists: state.lists.map(l => {
                    if (l.$id === listId) {
                        return {
                            ...l,
                            items: l.items.map(i => i.$id === itemId ? { ...i, checked: !newStatus } : i)
                        };
                    }
                    return l;
                })
            }));
        }
    }
}));

export default useShoppingListStore;
