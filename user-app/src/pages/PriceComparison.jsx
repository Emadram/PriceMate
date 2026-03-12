import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiShoppingCart, FiShare2, FiHeart, FiPackage, FiShoppingBag, FiTrendingDown, FiBox, FiHome, FiCamera, FiImage } from 'react-icons/fi';
import { fetchProductByBarcode, fetchAllPrices, getPricesForProduct } from '../utils/productUtils';
import useAuthStore from '../stores/authStore';
import useFavoritesStore from '../stores/favoritesStore';
import useCurrencyStore from '../stores/currencyStore';

const PriceComparison = () => {
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const { barcode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [product, setProduct] = useState(null);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const user = useAuthStore((state) => state.user);
    const { isProductFavorite, toggleProductFavorite } = useFavoritesStore();

    const fromScan = location.state?.fromScan || searchParams.get('fromScan') === '1';

    const handleFavoriteClick = () => {
        if (!user) {
            alert('Please login to favorite products');
            return;
        }
        toggleProductFavorite(product.$id);
    };

    const supermarketIdParam = searchParams.get('supermarketId');

    useEffect(() => {
        fetchProductAndPrices();
    }, [barcode]);

    const fetchProductAndPrices = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('Fetching product with barcode:', barcode);

            // Fetch product by barcode
            const productData = await fetchProductByBarcode(barcode);

            if (!productData) {
                setError('Product not found');
                setLoading(false);
                return;
            }

            console.log('Product data:', productData);
            setProduct(productData);

            // Fetch ALL prices
            const allPrices = await fetchAllPrices();

            // Filter prices for this product
            const productPrices = getPricesForProduct(allPrices, productData.$id);

            console.log('Filtered prices for this product:', productPrices);

            let sortedPrices = productPrices;

            // If query param exists, put that supermarket's price first
            if (supermarketIdParam) {
                sortedPrices = productPrices.sort((a, b) => {
                    const aId = Array.isArray(a.supermarkets) ? a.supermarkets[0].$id : a.supermarkets.$id;
                    const bId = Array.isArray(b.supermarkets) ? b.supermarkets[0].$id : b.supermarkets.$id;

                    if (aId === supermarketIdParam) return -1;
                    if (bId === supermarketIdParam) return 1;
                    return a.price - b.price; // sort remainder by price
                });
            } else {
                // Default: Sort prices by value (lowest first)
                sortedPrices = productPrices.sort((a, b) => a.price - b.price);
            }

            setPrices(sortedPrices);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load product information');
        }
        setLoading(false);
    };

    const getCategoryName = () => {
        const cat = product?.categoryId;
        if (!cat) return 'Uncategorized';

        if (Array.isArray(cat)) {
            return cat[0]?.categoryName || 'Uncategorized';
        }
        return cat.categoryName || 'Uncategorized';
    };

    const getLowestPrice = () => {
        if (prices.length === 0) return null;
        // If sorting logic puts specific supermarket first, checks against actual prices to verify if it is TRULY lowest
        const lowest = [...prices].sort((a, b) => a.price - b.price)[0];
        return lowest;
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

    const handleBack = () => {
        if (fromScan) {
            navigate('/scan');
        } else {
            navigate(-1);
        }
    };

    const handleScanAnother = () => {
        navigate('/scan');
    };

    const handleGoHome = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <button
                            onClick={handleBack}
                            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2.5 rounded-full text-gray-700 dark:text-gray-200 shadow-sm transition-all mb-1"
                            title="Go Back"
                        >
                            <FiArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Price Comparison</h1>
                    </div>
                    {user && (
                        <button
                            onClick={handleFavoriteClick}
                            className={`p-3 rounded-full transition-all ${isProductFavorite(product?.$id)
                                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                            title={isProductFavorite(product?.$id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <FiHeart className={isProductFavorite(product?.$id) ? 'fill-current' : ''} size={24} />
                        </button>
                    )}
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
                                        className="w-full h-full object-contain"
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
                            <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-2 border-green-500 dark:border-green-600">
                                <div className="flex items-center gap-3">
                                    <FiTrendingDown className="text-green-600 dark:text-green-400 text-2xl" />
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Best Price</p>
                                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                            {convert(lowestPrice.price, 'TRY')} {getCurrencySymbol()}
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
                                const supermarket = Array.isArray(priceEntry.supermarkets) ? priceEntry.supermarkets[0] : priceEntry.supermarkets;
                                const isSelectedContext = supermarketIdParam && supermarket?.$id === supermarketIdParam;
                                const isLowest = getLowestPrice().$id === priceEntry.$id; // Re-calculate simple lowest for badge
                                const priceDiff = (priceEntry.price - getLowestPrice().price).toFixed(2);

                                return (
                                    <div
                                        key={priceEntry.$id}
                                        className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden 
                                            ${isSelectedContext ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : ''}
                                            ${isLowest && !isSelectedContext ? 'ring-2 ring-green-500 dark:ring-green-600' : ''}
                                        `}
                                    >
                                        <div className="p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                {/* Supermarket Info */}
                                                <Link
                                                    to={`/supermarket/${supermarket?.$id}`}
                                                    className="flex items-center gap-4 flex-1 hover:opacity-80 transition group"
                                                >
                                                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:scale-110 transition ${isSelectedContext ? 'bg-blue-200 dark:bg-blue-800' : 'bg-blue-100 dark:bg-blue-900'}`}>
                                                        {supermarket?.icon || supermarket?.logoUrl ? (
                                                            <img
                                                                src={supermarket.icon || supermarket.logoUrl}
                                                                alt={supermarket?.name || 'Supermarket'}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        ) : (
                                                            <FiShoppingBag className="text-blue-600 dark:text-blue-400 text-2xl" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-gray-800 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                                            {supermarket?.name || 'Unknown Store'}
                                                            {isSelectedContext && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Viewing</span>}
                                                        </h4>
                                                        {isLowest && (
                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 mt-1">
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                                BEST PRICE
                                                            </span>
                                                        )}
                                                        {supermarket?.address && !isLowest && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                                                <FiMapPin className="text-xs" />
                                                                {supermarket.address}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Link>

                                                {/* Price Info */}
                                                <div className="text-right">
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className={`text-2xl font-bold ${isLowest ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                                                            {convert(priceEntry.price, 'TRY')}
                                                        </span>
                                                        <span className="text-gray-500 dark:text-gray-400 text-sm font-semibold">
                                                            {getCurrencySymbol()}
                                                        </span>
                                                    </div>
                                                    {priceDiff > 0 && (
                                                        <div className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium italic">
                                                            +{convert(priceDiff, 'TRY')} {getCurrencySymbol()} difference
                                                        </div>
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

            {/* Quick actions only when coming from scanner */}
            {fromScan && (
                <div className="sticky bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex gap-3">
                        <button
                            onClick={handleGoHome}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            <FiHome /> Home
                        </button>
                        <button
                            onClick={handleScanAnother}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition"
                        >
                            <FiCamera /> Scan Another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceComparison;
