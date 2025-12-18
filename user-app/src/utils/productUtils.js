import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { Query } from 'appwrite';

// MOCK DATA
const MOCK_SUPERMARKETS = [
    {
        $id: 'sup1',
        name: 'Carrefour',
        address: 'Istinye Park, Istanbul',
        phoneNumber: '+90 212 123 4567',
        email: 'contact@carrefour.com.tr',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Carrefour_logo.svg/1200px-Carrefour_logo.svg.png',
        bannerUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&auto=format&fit=crop&q=80',
        latitude: 41.1112,
        longitude: 29.0321
    },
    {
        $id: 'sup2',
        name: 'Migros',
        address: 'Kanyon Mall, Istanbul',
        phoneNumber: '+90 212 987 6543',
        email: 'info@migros.com.tr',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Migros_logo.svg/2560px-Migros_logo.svg.png',
        bannerUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80',
        latitude: 41.0783,
        longitude: 29.0118
    },
    {
        $id: 'sup3',
        name: 'BIM',
        address: 'Fatih, Istanbul',
        phoneNumber: '+90 212 555 1234',
        email: 'support@bim.com.tr',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Bim_Birle%C5%9Fik_Ma%C4%9Fazalar_A.%C5%9E._logo.svg/1200px-Bim_Birle%C5%9Fik_Ma%C4%9Fazalar_A.%C5%9E._logo.svg.png',
        bannerUrl: 'https://images.unsplash.com/photo-1604719312566-b76d4685332e?w=1200&auto=format&fit=crop&q=80',
        latitude: 41.0122,
        longitude: 28.9760
    },
    {
        $id: 'sup4',
        name: 'A101',
        address: 'Kadikoy, Istanbul',
        phoneNumber: '+90 216 444 5566',
        email: 'iletisim@a101.com.tr',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/A101_logo.svg/1200px-A101_logo.svg.png',
        bannerUrl: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=1200&auto=format&fit=crop&q=80',
        latitude: 40.9901,
        longitude: 29.0292
    },
    {
        $id: 'sup5',
        name: 'Sok Market',
        address: 'Besiktas, Istanbul',
        phoneNumber: '+90 212 222 3344',
        email: 'musteri@sokmarket.com.tr',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/%C5%9Eok_Market_logo.svg/1200px-%C5%9Eok_Market_logo.svg.png',
        bannerUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=1200&auto=format&fit=crop&q=80',
        latitude: 41.0422,
        longitude: 29.0060
    }
];

const MOCK_PRODUCTS = [
    {
        $id: 'prod1',
        name: 'Coca-Cola 330ml',
        barcode: '5449000000996',
        imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Refreshing carbonated soft drink',
        categoryId: { $id: 'cat1', categoryName: 'Beverages' },
        stockQuantity: 150
    },
    {
        $id: 'prod2',
        name: 'Lays Classic Salted',
        barcode: '123456789',
        imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Classic salted potato chips',
        categoryId: { $id: 'cat2', categoryName: 'Snacks' },
        stockQuantity: 50
    },
    {
        $id: 'prod3',
        name: 'Sutas Full Cream Milk 1L',
        barcode: '6281007000000',
        imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Fresh full cream milk',
        categoryId: { $id: 'cat3', categoryName: 'Dairy' },
        stockQuantity: 80
    },
    {
        $id: 'prod4',
        name: 'Nescafe Gold 200g',
        barcode: '7613035220065',
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Premium freeze-dried instant coffee',
        categoryId: { $id: 'cat1', categoryName: 'Beverages' },
        stockQuantity: 30
    },
    {
        $id: 'prod5',
        name: 'Heinz Tomato Ketchup',
        barcode: '0000000000000',
        imageUrl: 'https://images.unsplash.com/photo-1607301406259-dfb186e15de8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Classic tomato ketchup',
        categoryId: { $id: 'cat4', categoryName: 'Pantry' },
        stockQuantity: 100
    },
    {
        $id: 'prod6',
        name: 'Oreo Original',
        barcode: '7622300000000',
        imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Chocolate sandwich cookies with vanilla cream',
        categoryId: { $id: 'cat2', categoryName: 'Snacks' },
        stockQuantity: 200
    },
    {
        $id: 'prod7',
        name: 'Barilla Spaghetti No.5',
        barcode: '8076809513753',
        imageUrl: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Authentic Italian spaghetti',
        categoryId: { $id: 'cat4', categoryName: 'Pantry' },
        stockQuantity: 120
    },
    {
        $id: 'prod8',
        name: 'Nutella Hazelnut Spread',
        barcode: '8000500179864',
        imageUrl: 'https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Creamy hazelnut spread with cocoa',
        categoryId: { $id: 'cat5', categoryName: 'Breakfast' },
        stockQuantity: 60
    },
    {
        $id: 'prod9',
        name: 'Colgate Total Toothpaste',
        barcode: '8718951313454',
        imageUrl: 'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Complete protection for healthy teeth',
        categoryId: { $id: 'cat6', categoryName: 'Personal Care' },
        stockQuantity: 90
    },
    {
        $id: 'prod10',
        name: 'Dove Beauty Bar',
        barcode: '8712561874562',
        imageUrl: 'https://images.unsplash.com/photo-1624816657738-9226f4945417?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Moisturizing beauty bar soap',
        categoryId: { $id: 'cat6', categoryName: 'Personal Care' },
        stockQuantity: 75
    },
    {
        $id: 'prod11',
        name: 'Indomie Instant Noodles',
        barcode: '8998866200578',
        imageUrl: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Fried noodles with special seasoning',
        categoryId: { $id: 'cat4', categoryName: 'Pantry' },
        stockQuantity: 200
    },
    {
        $id: 'prod12',
        name: 'Basmati Rice 1kg',
        barcode: '123999888777',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Long grain aromatic basmati rice',
        categoryId: { $id: 'cat4', categoryName: 'Pantry' },
        stockQuantity: 100
    },
    {
        $id: 'prod13',
        name: 'Doritos Nacho Cheese',
        barcode: '123456789012',
        imageUrl: 'https://images.unsplash.com/photo-1621447504864-d84979071c17?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Crunchy tortilla chips with nacho cheese flavor',
        categoryId: { $id: 'cat2', categoryName: 'Snacks' },
        stockQuantity: 80
    },
    {
        $id: 'prod14',
        name: 'Red Bull Energy Drink',
        barcode: '9002490100070',
        imageUrl: 'https://images.unsplash.com/photo-1622483767128-3f66f32aef97?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Energy drink that gives you wings',
        categoryId: { $id: 'cat1', categoryName: 'Beverages' },
        stockQuantity: 120
    },
    {
        $id: 'prod15',
        name: 'Pringles Original',
        barcode: '5053990101559',
        imageUrl: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
        description: 'Original salted potato crisps',
        categoryId: { $id: 'cat2', categoryName: 'Snacks' },
        stockQuantity: 90
    }
];

const MOCK_PRICES = [
    // Coca-Cola
    { $id: 'p1', price: 25.00, currency: 'TL', products: { $id: 'prod1' }, supermarkets: MOCK_SUPERMARKETS[0] },
    { $id: 'p2', price: 27.50, currency: 'TL', products: { $id: 'prod1' }, supermarkets: MOCK_SUPERMARKETS[1] },
    { $id: 'p3', price: 24.90, currency: 'TL', products: { $id: 'prod1' }, supermarkets: MOCK_SUPERMARKETS[2] },

    // Lays
    { $id: 'p4', price: 35.00, currency: 'TL', products: { $id: 'prod2' }, supermarkets: MOCK_SUPERMARKETS[0] },
    { $id: 'p5', price: 32.50, currency: 'TL', products: { $id: 'prod2' }, supermarkets: MOCK_SUPERMARKETS[3] },

    // Milk
    { $id: 'p6', price: 45.00, currency: 'TL', products: { $id: 'prod3' }, supermarkets: MOCK_SUPERMARKETS[1] },
    { $id: 'p7', price: 42.90, currency: 'TL', products: { $id: 'prod3' }, supermarkets: MOCK_SUPERMARKETS[2] },
    { $id: 'p8', price: 46.00, currency: 'TL', products: { $id: 'prod3' }, supermarkets: MOCK_SUPERMARKETS[4] },

    // Nescafe
    { $id: 'p9', price: 250.00, currency: 'TL', products: { $id: 'prod4' }, supermarkets: MOCK_SUPERMARKETS[0] },
    { $id: 'p10', price: 235.00, currency: 'TL', products: { $id: 'prod4' }, supermarkets: MOCK_SUPERMARKETS[3] },

    // Ketchup
    { $id: 'p11', price: 65.00, currency: 'TL', products: { $id: 'prod5' }, supermarkets: MOCK_SUPERMARKETS[1] },
    { $id: 'p12', price: 59.90, currency: 'TL', products: { $id: 'prod5' }, supermarkets: MOCK_SUPERMARKETS[2] },

    // Oreo
    { $id: 'p13', price: 30.00, currency: 'TL', products: { $id: 'prod6' }, supermarkets: MOCK_SUPERMARKETS[4] },
    { $id: 'p14', price: 28.50, currency: 'TL', products: { $id: 'prod6' }, supermarkets: MOCK_SUPERMARKETS[3] },

    // Spaghetti
    { $id: 'p15', price: 40.00, currency: 'TL', products: { $id: 'prod7' }, supermarkets: MOCK_SUPERMARKETS[0] },
    { $id: 'p16', price: 38.00, currency: 'TL', products: { $id: 'prod7' }, supermarkets: MOCK_SUPERMARKETS[1] },

    // Nutella
    { $id: 'p17', price: 180.00, currency: 'TL', products: { $id: 'prod8' }, supermarkets: MOCK_SUPERMARKETS[2] },
    { $id: 'p18', price: 175.00, currency: 'TL', products: { $id: 'prod8' }, supermarkets: MOCK_SUPERMARKETS[3] },

    // Toothpaste
    { $id: 'p19', price: 95.00, currency: 'TL', products: { $id: 'prod9' }, supermarkets: MOCK_SUPERMARKETS[4] },
    { $id: 'p20', price: 89.90, currency: 'TL', products: { $id: 'prod9' }, supermarkets: MOCK_SUPERMARKETS[0] },

    // Soap
    { $id: 'p21', price: 45.00, currency: 'TL', products: { $id: 'prod10' }, supermarkets: MOCK_SUPERMARKETS[1] },
    { $id: 'p22', price: 42.50, currency: 'TL', products: { $id: 'prod10' }, supermarkets: MOCK_SUPERMARKETS[2] },

    // Indomie
    { $id: 'p23', price: 10.00, currency: 'TL', products: { $id: 'prod11' }, supermarkets: MOCK_SUPERMARKETS[3] },
    { $id: 'p24', price: 9.50, currency: 'TL', products: { $id: 'prod11' }, supermarkets: MOCK_SUPERMARKETS[4] },
    { $id: 'p25', price: 11.00, currency: 'TL', products: { $id: 'prod11' }, supermarkets: MOCK_SUPERMARKETS[0] },

    // Rice
    { $id: 'p26', price: 85.00, currency: 'TL', products: { $id: 'prod12' }, supermarkets: MOCK_SUPERMARKETS[1] },
    { $id: 'p27', price: 79.90, currency: 'TL', products: { $id: 'prod12' }, supermarkets: MOCK_SUPERMARKETS[2] },

    // Doritos
    { $id: 'p28', price: 35.00, currency: 'TL', products: { $id: 'prod13' }, supermarkets: MOCK_SUPERMARKETS[0] },
    { $id: 'p29', price: 34.50, currency: 'TL', products: { $id: 'prod13' }, supermarkets: MOCK_SUPERMARKETS[3] },

    // Red Bull
    { $id: 'p30', price: 40.00, currency: 'TL', products: { $id: 'prod14' }, supermarkets: MOCK_SUPERMARKETS[4] },
    { $id: 'p31', price: 42.00, currency: 'TL', products: { $id: 'prod14' }, supermarkets: MOCK_SUPERMARKETS[1] },

    // Pringles
    { $id: 'p32', price: 75.00, currency: 'TL', products: { $id: 'prod15' }, supermarkets: MOCK_SUPERMARKETS[2] },
    { $id: 'p33', price: 72.50, currency: 'TL', products: { $id: 'prod15' }, supermarkets: MOCK_SUPERMARKETS[0] }
];

/**
 * Fetch all prices with supermarket relationship data
 */
export const fetchAllPrices = async (limit = 200) => {
    return Promise.resolve(MOCK_PRICES);
};

/**
 * Get prices for a specific product ID
 */
export const getPricesForProduct = (prices, productId) => {
    return prices.filter(price => price.products?.$id === productId);
};

/**
 * Get the lowest price from a list of prices
 */
export const getLowestPrice = (prices) => {
    if (prices.length === 0) return null;
    return prices.reduce((min, p) => p.price < min.price ? p : min, prices[0]);
};

/**
 * Fetch products with category relationship
 */
export const fetchProducts = async (limit = 50) => {
    return Promise.resolve(MOCK_PRODUCTS);
};

/**
 * Fetch unique categories from mock products
 */
export const fetchCategories = async () => {
    const categories = new Map();
    MOCK_PRODUCTS.forEach(product => {
        if (product.categoryId) {
            categories.set(product.categoryId.$id, product.categoryId);
        }
    });
    return Promise.resolve(Array.from(categories.values()));
};

/**
 * Search products by name or barcode, optionally filtered by category
 */
export const searchProducts = async (query, categoryId = null) => {
    const products = MOCK_PRODUCTS;
    const searchLower = query.toLowerCase();

    return Promise.resolve(products.filter(product => {
        const matchesQuery =
            product.name.toLowerCase().includes(searchLower) ||
            product.barcode.includes(query) ||
            product.categoryId?.categoryName?.toLowerCase().includes(searchLower);

        const matchesCategory = categoryId ? product.categoryId?.$id === categoryId : true;

        return matchesQuery && matchesCategory;
    }));
};

/**
 * Fetch single product by barcode (Mock)
 */
export const fetchProductByBarcode = async (barcode) => {
    const product = MOCK_PRODUCTS.find(p => p.barcode === barcode);
    return Promise.resolve(product || null);
};

/**
 * Fetch supermarket by ID (Mock)
 */
export const fetchSupermarketById = async (id) => {
    const supermarket = MOCK_SUPERMARKETS.find(s => s.$id === id);
    return Promise.resolve(supermarket || null);
};

/**
 * Fetch prices by supermarket ID (Mock)
 */
export const fetchPricesBySupermarket = async (supermarketId) => {
    const prices = MOCK_PRICES.filter(p => p.supermarkets.$id === supermarketId);

    // Enrich with product data AND calculate price difference
    const enrichedPrices = prices.map(price => {
        const product = MOCK_PRODUCTS.find(p => p.$id === price.products.$id);

        // Calculate lowest price for this product across ALL supermarkets
        const allPricesForProduct = MOCK_PRICES.filter(p => p.products.$id === product.$id);
        const lowestPrice = Math.min(...allPricesForProduct.map(p => p.price));
        const priceDiff = price.price - lowestPrice;

        return {
            ...product,
            price: price.price,
            currency: price.currency,
            priceId: price.$id,
            priceDiff: priceDiff, // Difference from lowest price
            isLowest: priceDiff === 0
        };
    });
    return Promise.resolve(enrichedPrices);
};
