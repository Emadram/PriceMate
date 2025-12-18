import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiShoppingCart, FiShare2, FiHeart, FiPackage, FiShoppingBag, FiTrendingDown, FiBox } from 'react-icons/fi';
import { fetchProductByBarcode, fetchAllPrices, getPricesForProduct } from '../utils/productUtils';
import useAuthStore from '../stores/authStore';

const PriceComparison = () => {
    const { barcode } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchProductAndPrices();
    }, [barcode]);

    const fetchProductAndPrices = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('Fetching product with barcode:', barcode);

            // Use mock data utility
            const productData = await fetchProductByBarcode(barcode);

            if (!productData) {
                setError('Product not found');
                setLoading(false);
                return;
            }

            console.log('Product data:', productData);
            setProduct(productData);

            // Fetch ALL prices (mock)
            const allPrices = await fetchAllPrices();

            // Filter prices for this product
            const productPrices = getPricesForProduct(allPrices, productData.$id);

            console.log('Filtered prices for this product:', productPrices);

            // Sort prices by value (lowest first)
            const sortedPrices = productPrices.sort((a, b) => a.price - b.price);
            setPrices(sortedPrices);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load product information');
        }
        setLoading(false);
    };

    const getCategoryName = () => {
        if (product?.categoryId && typeof product.categoryId === 'object') {
            return product.categoryId.categoryName || 'Uncategorized';
        }
        return 'Uncategorized';
    };

    const getLowestPrice = () => {
        if (prices.length === 0) return null;
        return prices[0];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-gray-600 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <FiPackage className="text-gray-400 text-6xl mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {error || 'Product Not Found'}
                    </h2>
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Go Back Home
                    </button>
                </div>
            </div>
        );
    }

    const lowestPrice = getLowestPrice();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2 mb-3"
                    >
                        <FiArrowLeft /> Back
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white">Price Comparison</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Product Info Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-6">
                        <div className="flex gap-6">
                            {/* Product Image */}
                            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {product.imageUrl ? (
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <FiPackage className="text-gray-400 text-4xl" />
                                )}
                            </div>

                            {/* Product Details */}
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                                    {product.name}
                                </h2>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <FiPackage className="text-blue-600 dark:text-blue-400" />
                                        <span>Category: {getCategoryName()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <FiBox className="text-green-600 dark:text-green-400" />
                                        <span>Stock: {product.stockQuantity || 0} units</span>
                                    </div>
                                    {product.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                                            {product.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Best Price Banner */}
                        {lowestPrice && (
                            <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4 border-2 border-green-500 dark:border-green-600">
                                <div className="flex items-center gap-3">
                                    <FiTrendingDown className="text-green-600 dark:text-green-400 text-2xl" />
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Best Price</p>
                                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {lowestPrice.price} {lowestPrice.currency || 'EGP'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Prices Section */}
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                        Available at {prices.length} {prices.length === 1 ? 'Store' : 'Stores'}
                    </h3>

                    {prices.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                            <FiShoppingBag className="text-gray-400 text-5xl mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">
                                No prices available yet for this product
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {prices.map((priceEntry, index) => {
                                const supermarket = priceEntry.supermarkets;
                                const isLowest = index === 0;

                                return (
                                    <div
                                        key={priceEntry.$id}
                                        className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden ${isLowest ? 'ring-2 ring-green-500 dark:ring-green-600' : ''
                                            }`}
                                    >
                                        <div className="p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                {/* Supermarket Info */}
                                                <Link
                                                    to={`/supermarket/${supermarket?.$id}`}
                                                    className="flex items-center gap-4 flex-1 hover:opacity-80 transition group"
                                                >
                                                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                                                        <FiShoppingBag className="text-blue-600 dark:text-blue-400 text-2xl" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-gray-800 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                                            {supermarket?.name || 'Unknown Store'}
                                                        </h4>
                                                        {supermarket?.address && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                                                <FiMapPin className="text-xs" />
                                                                {supermarket.address}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Link>

                                                {/* Price */}
                                                <div className="text-right">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-3xl font-bold text-gray-800 dark:text-white">
                                                            {priceEntry.price}
                                                        </span>
                                                        <span className="text-lg text-gray-600 dark:text-gray-400">
                                                            {priceEntry.currency || 'EGP'}
                                                        </span>
                                                    </div>
                                                    {isLowest && (
                                                        <span className="inline-block mt-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                                                            Lowest Price
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default PriceComparison;
