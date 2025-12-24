import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { Query } from 'appwrite';

const { DATABASE_ID, COLLECTIONS } = APPWRITE_CONFIG;

// Helper to safely get ID from a relationship field (which could be an object, array, or string ID)
const getRelationshipId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) {
        return field.length > 0 ? getRelationshipId(field[0]) : null;
    }
    if (typeof field === 'string') return field;
    return field.$id;
};

// Helper to safely get attribute from relationship (only if expanded)
const getRelationshipAttribute = (field, attribute) => {
    if (!field) return null;
    if (Array.isArray(field)) {
        return field.length > 0 ? getRelationshipAttribute(field[0], attribute) : null;
    }
    if (typeof field === 'object' && field[attribute]) {
        return field[attribute];
    }
    return null;
};

/**
 * Fetch all prices with supermarket relationship data
 */
export const fetchAllPrices = async (limit = 200) => {
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.PRICES,
            [
                Query.limit(limit),
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'products.*', 'supermarkets.*', 'products.categoryId.*'])
            ]
        );
        return response.documents;
    } catch (error) {
        console.error('Error fetching all prices:', error);
        return [];
    }
};

/**
 * Get prices for a specific product ID
 */
export const getPricesForProduct = (prices, productId) => {
    if (!prices || !productId) return [];
    return prices.filter(price => {
        const priceProductId = getRelationshipId(price.products);
        return priceProductId === productId;
    });
};

/**
 * Get the cheapest price for a product
 * @returns {Object|null} Price object with lowest price, or null if no prices
 */
export const getCheapestPrice = (prices, productId) => {
    const productPrices = getPricesForProduct(prices, productId);
    if (productPrices.length === 0) return null;

    return productPrices.reduce((min, price) =>
        price.price < min.price ? price : min
    );
};

/**
 * Get price statistics for a product across all supermarkets
 * @returns {Object|null} Stats object with min, max, avg, count
 */
export const getPriceStats = (prices, productId) => {
    const productPrices = getPricesForProduct(prices, productId);
    if (productPrices.length === 0) return null;

    const priceValues = productPrices.map(p => p.price);
    return {
        min: Math.min(...priceValues),
        max: Math.max(...priceValues),
        avg: (priceValues.reduce((a, b) => a + b, 0) / priceValues.length).toFixed(2),
        count: productPrices.length,
        cheapestStore: getCheapestPrice(prices, productId)
    };
};

/**
 * Get the lowest price from a list of prices
 */
export const getLowestPrice = (prices) => {
    if (!prices || prices.length === 0) return null;
    return prices.reduce((min, p) => p.price < min.price ? p : min, prices[0]);
};

/**
 * Fetch products with category relationship
 */
export const fetchProducts = async (limit = 50) => {
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.PRODUCTS,
            [
                Query.limit(limit),
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'categoryId.*'])
            ]
        );
        return response.documents;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
};

/**
 * Search products by name or barcode
 */
export const searchProducts = async (query, categoryId = null) => {
    try {
        const searchLower = query?.toLowerCase() || '';

        const queries = [
            Query.limit(100),
            Query.select(['*', 'categoryId.*'])
        ];

        // If category is provided, we can filter server-side
        if (categoryId) {
            queries.push(Query.equal('categoryId', categoryId));
        }

        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.PRODUCTS,
            queries
        );

        // Filter client-side by name or barcode if query exists
        let filtered = response.documents;
        if (searchLower) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchLower) ||
                product.barcode.includes(query)
            );
        }

        return filtered.slice(0, 20); // Return top 20 matches

    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
};

/**
 * Fetch single product by barcode
 */
export const fetchProductByBarcode = async (barcode) => {
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.PRODUCTS,
            [
                Query.equal('barcode', barcode),
                Query.equal('barcode', barcode),
                Query.limit(1),
                Query.select(['*', 'categoryId.*'])
            ]
        );
        return response.documents[0] || null;
    } catch (error) {
        console.error('Error fetching product by barcode:', error);
        return null;
    }
};

/**
 * Fetch supermarket by ID
 */
export const fetchSupermarketById = async (id) => {
    try {
        const response = await databases.getDocument(
            DATABASE_ID,
            COLLECTIONS.SUPERMARKETS,
            id
        );
        return response;
    } catch (error) {
        console.error('Error fetching supermarket:', error);
        return null;
    }
};

/**
 * Fetch prices by supermarket ID
 */
export const fetchPricesBySupermarket = async (supermarketId) => {
    try {
        // 1. Fetch ALL prices (or a large subset) - Safer than querying relationship directly if unsupported
        const pricesResponse = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.PRICES,
            [
                Query.limit(500), // Fetch more to ensure we catch them
                Query.orderDesc('$createdAt'),
                Query.select(['*', 'products.*', 'supermarkets.*', 'products.categoryId.*'])
            ]
        );

        const allPrices = pricesResponse.documents;

        // Filter client-side for this supermarket
        const prices = allPrices.filter(p => {
            const sId = getRelationshipId(p.supermarkets);
            return sId === supermarketId;
        });

        if (prices.length === 0) return [];

        // 2. Enrich with product details
        const enrichedPricesPromises = prices.map(async (price) => {
            // Handle product relationship
            let product = price.products;
            const productId = getRelationshipId(product);

            // If product is just an ID (not expanded), we must fetch it. 
            // Should not happen if standard depth > 0, but good for safety.
            if (typeof product === 'string') {
                try {
                    product = await databases.getDocument(DATABASE_ID, COLLECTIONS.PRODUCTS, product);
                } catch (e) {
                    console.warn('Could not fetch product details for ID:', product);
                    return null;
                }
            }

            if (!product) return null;

            // Calculate comparison (lowest price logic)
            // We can reuse 'allPrices' to find the min price for this product locally!
            // This avoids N+1 network calls.
            const productPrices = allPrices.filter(p => getRelationshipId(p.products) === productId);

            // If local list is partial, this might be inaccurate, but much faster.
            // For a "perfect" system, we'd need another query, but reusing allPrices is a good optimization 
            // if we assume 'allPrices' contains enough market coverage.
            // To be safe/accurate, let's query specific product prices only if we doubt 'allPrices' coverage,
            // but let's stick to the previous logic of precise calculation for now to be safe,
            // OR use the local calculation if we think 500 prices covers most competitors.
            // Let's do the QUERY to be safe (accuracy over speed for this checkup).

            const minPriceResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.PRICES,
                [
                    Query.equal('products', productId),
                    Query.orderAsc('price'),
                    Query.limit(1)
                ]
            ).catch(() => ({ documents: [] }));

            const minPrice = minPriceResponse.documents?.[0]?.price || price.price;
            const priceDiff = price.price - minPrice;

            return {
                ...product, // Spread product details
                price: price.price,
                currency: price.currency,
                priceId: price.$id,
                priceDiff: priceDiff,
                isLowest: priceDiff <= 0
            };
        });

        const enrichedPrices = (await Promise.all(enrichedPricesPromises)).filter(p => p !== null);
        return enrichedPrices;

    } catch (error) {
        console.error('Error fetching supermarket prices:', error);
        return [];
    }
};/**
 * Fetch all categories
 */
export const fetchCategories = async () => {
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.CATEGORIES,
            [Query.limit(100), Query.orderAsc('categoryName')]
        );
        return response.documents;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
};
