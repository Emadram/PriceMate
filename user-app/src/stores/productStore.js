import { create } from 'zustand';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { Query } from 'appwrite';

const useProductStore = create((set) => ({
    product: null,
    prices: [],
    loading: false,
    error: null,

    fetchProductByBarcode: async (barcode) => {
        set({ loading: true, error: null, product: null, prices: [] });
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                [Query.equal('barcode', barcode)]
            );

            if (response.documents.length === 0) {
                set({ loading: false, error: 'Product not found' });
                return null;
            }

            const product = response.documents[0];
            set({ product });

            // Fetch prices for this product
            await useProductStore.getState().fetchPrices(product.$id);

            set({ loading: false });
            return product;
        } catch (error) {
            set({ loading: false, error: error.message });
            return null;
        }
    },

    fetchPrices: async (productId) => {
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRICES,
                [Query.equal('productId', productId), Query.orderAsc('price')]
            );
            set({ prices: response.documents });
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    },

    fetchProductsByName: async (name) => {
        set({ loading: true, error: null, prices: [] });
        console.log('🔍 Searching for products with name:', name);
        console.log('📊 Using database:', APPWRITE_CONFIG.DATABASE_ID);
        console.log('📦 Using collection:', APPWRITE_CONFIG.COLLECTIONS.PRODUCTS);

        try {
            let response;

            // Strategy 1: Try fulltext search (requires index)
            try {
                response = await databases.listDocuments(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                    [Query.search('name', name)]
                );
                console.log('✅ Fulltext search successful!');
            } catch (searchError) {
                console.log('⚠️ Fulltext search failed (index might be missing), trying alternative...');

                // Strategy 2: Get all products and filter client-side
                const allProducts = await databases.listDocuments(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTIONS.PRODUCTS
                );

                response = {
                    documents: allProducts.documents.filter(p =>
                        p.name.toLowerCase().includes(name.toLowerCase())
                    )
                };
                console.log('✅ Client-side filter successful!');
            }

            console.log('✅ Search complete! Found', response.documents.length, 'products');
            console.log('📄 Products:', response.documents);

            set({ loading: false });
            return response.documents;
        } catch (error) {
            console.error('❌ Search error:', error.message);
            console.error('Full error:', error);
            set({ loading: false, error: error.message });
            return [];
        }
    }
}));

export default useProductStore;
