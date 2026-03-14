import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiShoppingCart, FiShare2, FiHeart, FiPackage, FiShoppingBag, FiTrendingDown, FiTrendingUp, FiBox, FiHome, FiCamera, FiImage, FiNavigation, FiClock, FiCheckCircle, FiAlertCircle, FiCalendar, FiTag } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { fetchProductByBarcode, fetchAllPrices, getPricesForProduct, calculateDistance } from '../utils/productUtils';
import Navbar from '../components/Navbar';
import useAuthStore from '../stores/authStore';
import useFavoritesStore from '../stores/favoritesStore';
import useCurrencyStore from '../stores/currencyStore';
import useUserLocation from '../hooks/useUserLocation';
import PriceHistoryChart from '../components/PriceHistoryChart';

const StockBranch = ({ name, count, status, price, distance, t }) => {
    const statusColors = {
        high: "text-green-600 bg-green-50 dark:bg-green-900/20",
        low: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
        none: "text-red-500 bg-red-50 dark:bg-red-900/20"
    };
    
    const handleBranchLocation = (branchName) => {
        // TODO: INTEGRATION REMINDER - Phase 2
        // When user clicks branch location:
        // 1. Get branch coordinates from Appwrite (lat: 41.0082, lng: 28.9784)
        // 2. Open Google Maps: window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${branchLat},${branchLng}`)
        // 3. Alternatively, use a built-in map component with leaflet/google-maps-react
        console.log(`Navigating to branch: ${branchName}`);
        alert(`Opening navigation to ${branchName}...\n(Google Maps API integration pending)`);
    };

    return (
        <div 
            onClick={() => handleBranchLocation(name)}
            className="flex flex-col gap-1.5 p-2 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 shadow-sm hover:border-blue-500/50 hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-all group"
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black text-gray-800 dark:text-white truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors uppercase">{name}</span>
                <span className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase whitespace-nowrap ${statusColors[status]}`}>
                    {status === 'none' ? t('out_of_stock') : `${count} ${t('in_stock')}`}
                </span>
            </div>
            <div className="flex items-center justify-between mt-0.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/30">
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                        <FiNavigation size={8} /> {distance}
                    </span>
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Branch</span>
                </div>
                <span className="text-[10px] font-black text-gray-900 dark:text-white">
                    {price}
                </span>
            </div>
        </div>
    );
};

const PriceComparison = () => {
    const { t } = useTranslation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const { location: userLocation, loading: locationLoading } = useUserLocation();
    const { barcode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [product, setProduct] = useState(null);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('prices'); // 'prices' or 'insights'
    const [sortBy, setSortBy] = useState('price'); // 'price' or 'distance'
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

            // Attach distances if user location available
            const pricesWithDistance = productPrices.map(price => {
                const supermarket = Array.isArray(price.supermarkets) ? price.supermarkets[0] : price.supermarkets;
                let distance = null;
                
                if (userLocation && supermarket?.latitude && supermarket?.longitude) {
                    distance = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        supermarket.latitude,
                        supermarket.longitude
                    );
                }
                
                return { ...price, distance: distance ? parseFloat(distance) : null };
            });

            setPrices(pricesWithDistance);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load product information');
        }
        setLoading(false);
    };

    const sortedPrices = useMemo(() => {
        let sorted = [...prices];

        // If query param exists, put that supermarket's price first
        if (supermarketIdParam) {
            sorted.sort((a, b) => {
                const aId = Array.isArray(a.supermarkets) ? a.supermarkets[0].$id : a.supermarkets.$id;
                const bId = Array.isArray(b.supermarkets) ? b.supermarkets[0].$id : b.supermarkets.$id;

                if (aId === supermarketIdParam) return -1;
                if (bId === supermarketIdParam) return 1;
                
                // Fallback to current sort preference
                if (sortBy === 'distance' && a.distance !== null && b.distance !== null) {
                    return a.distance - b.distance;
                }
                return a.price - b.price;
            });
        } else {
            // Standard sorting
            if (sortBy === 'distance') {
                sorted.sort((a, b) => {
                    if (a.distance === null) return 1;
                    if (b.distance === null) return -1;
                    return a.distance - b.distance;
                });
            } else {
                sorted.sort((a, b) => a.price - b.price);
            }
        }
        return sorted;
    }, [prices, sortBy, supermarketIdParam]);

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
        // Find truly lowest regardless of current display sort
        return [...prices].sort((a, b) => a.price - b.price)[0];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">
                    {t('loading')}
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <FiPackage className="text-gray-400 text-6xl mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 uppercase tracking-tight">
                        {error ? t('failed_to_load_product') : t('product_not_found')}
                    </h2>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-blue-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-black transition-colors"
                    >
                        {t('go_back_home')}
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 sm:pb-0">
            <Navbar />
            
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100 dark:border-gray-700">
                <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBack}
                            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded-full text-gray-700 dark:text-gray-200 shadow-sm transition-all"
                            title={t('home')}
                        >
                            <FiArrowLeft size={16} />
                        </button>
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">{t('compare_prices')}</h1>
                    </div>
                    {user && (
                        <button
                            onClick={handleFavoriteClick}
                            className={`p-2 rounded-full transition-all ${isProductFavorite(product?.$id)
                                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                            title={isProductFavorite(product?.$id) ? t('favorites') : t('favorites')}
                        >
                            <FiHeart className={isProductFavorite(product?.$id) ? 'fill-current' : ''} size={18} />
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
                {/* Product Info Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start text-center sm:text-left">
                            {/* Product Image */}
                            <div className="w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-700/50">
                                {product.imageUrl ? (
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-24 h-24 object-contain"
                                    />
                                ) : (
                                    <FiPackage className="text-gray-300 text-4xl" />
                                )}
                            </div>

                            {/* Product Details */}
                            <div className="flex-1">
                                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight leading-tight">
                                    {product.name}
                                </h2>
                                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-lg text-[9px] items-center gap-1 inline-flex uppercase tracking-[0.2em] font-black">
                                        <FiTag size={10} /> {getCategoryName()}
                                    </span>
                                    <span className="flex items-center gap-1 text-[9px] font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                                        <FiBox size={10} /> {t('stock')}: {product.stockQuantity || 0}
                                    </span>
                                </div>
                                {product.description && (
                                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-2 leading-relaxed italic max-w-sm">
                                        "{product.description}"
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Best Price Banner */}
                        {lowestPrice && (
                            <div className="mt-4 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-500/20 dark:border-green-600/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-500/20">
                                        <FiTrendingDown className="text-white text-base" />
                                    </div>
                                    <div>
                                        <p className="text-[8px] uppercase font-black tracking-[0.2em] text-green-700 dark:text-green-400">{t('best_price')}</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-green-600 dark:text-green-400">{convert(lowestPrice.price, 'TRY')}</span>
                                            <span className="text-xs font-bold text-green-600/60 ">{getCurrencySymbol()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-green-500/10 pt-2 sm:pt-0 sm:pl-4">
                                    <p className="text-[8px] text-green-700 dark:text-green-400 font-black uppercase tracking-widest">{t('market_avg')}</p>
                                    <p className="text-sm font-bold text-gray-500 line-through decoration-red-500/30">
                                        {convert(lowestPrice.price * 1.15, 'TRY')} {getCurrencySymbol()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={() => setActiveTab('prices')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'prices' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm border border-black/5 dark:border-white/5' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FiShoppingBag size={18} /> {t('price')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('insights')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'insights' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm border border-black/5 dark:border-white/5' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FiTrendingUp size={18} /> {t('price_history')}
                    </button>
                </div>

                {activeTab === 'insights' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <PriceHistoryChart productId={product.$id} productName={product.name} />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Prices List & Sorting Controls */}
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">
                                {t('available_stores')} <span className="ml-1 text-blue-600 opacity-50">({prices.length})</span>
                            </h3>
                            
                            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                <button 
                                    onClick={() => setSortBy('price')}
                                    className={`p-2 rounded-lg transition-all ${sortBy === 'price' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-blue-600'}`}
                                    title="By Price"
                                >
                                    <FiTrendingDown size={14} />
                                </button>
                                <button 
                                    onClick={() => setSortBy('distance')}
                                    className={`p-2 rounded-lg transition-all ${sortBy === 'distance' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-blue-600'}`}
                                    disabled={!userLocation}
                                    title="By Distance"
                                >
                                    <FiNavigation size={14} />
                                </button>
                            </div>
                        </div>

                        {prices.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-16 text-center border-2 border-dashed border-gray-100 dark:border-gray-700">
                                <FiShoppingBag className="text-gray-300 text-6xl mx-auto mb-4" />
                                <p className="text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">
                                    {t('no_prices_available')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sortedPrices.map((priceEntry) => {
                                    const supermarket = Array.isArray(priceEntry.supermarkets) ? priceEntry.supermarkets[0] : priceEntry.supermarkets;
                                    const isSelectedContext = supermarketIdParam && supermarket?.$id === supermarketIdParam;
                                    const isLowest = getLowestPrice()?.$id === priceEntry.$id;
                                    
                                    const updatedAt = priceEntry.$updatedAt ? new Date(priceEntry.$updatedAt) : new Date();
                                    const formattedDate = updatedAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    const formattedTime = updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                                    const distanceDisplay = priceEntry.distance !== null ? `${priceEntry.distance} km` : t('calculating');

                                    return (
                                        <div
                                            key={priceEntry.$id}
                                            className={`group relative bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-2 
                                                ${isSelectedContext ? 'border-blue-500 shadow-blue-500/10' : 'border-transparent'}
                                                ${isLowest && !isSelectedContext ? 'border-green-500 shadow-green-500/10' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <Link 
                                                    to={`/supermarket/${supermarket?.$id}`}
                                                    className="relative w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-700/50 group-hover:scale-105 transition-transform"
                                                >
                                                    {supermarket?.icon || supermarket?.logoUrl ? (
                                                        <img src={supermarket.icon || supermarket.logoUrl} className="w-14 h-14 object-contain" alt="" />
                                                    ) : (
                                                        <FiShoppingBag className="text-gray-300 text-2xl" />
                                                    )}
                                                </Link>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-lg font-black text-gray-800 dark:text-white truncate uppercase tracking-tight">
                                                            {supermarket?.name || 'Store'}
                                                        </h4>
                                                        {supermarket?.branchName && (
                                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-lg font-black uppercase">
                                                                {supermarket.branchName}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                                                            <FiNavigation size={14} className="opacity-70" />
                                                            {distanceDisplay}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase ${priceEntry.stockStatus === 'in_stock' ? 'text-green-600' : 'text-amber-500'}`}>
                                                            <div className={`w-2 h-2 rounded-full ${priceEntry.stockStatus === 'in_stock' ? 'bg-green-600 animate-pulse' : 'bg-amber-500'}`} />
                                                            {priceEntry.stockStatus === 'in_stock' ? t('in_stock') : t('low_stock')}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right flex flex-col items-end">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-3xl font-black ${isLowest ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                                            {convert(priceEntry.price, 'TRY')}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-400">{getCurrencySymbol()}</span>
                                                    </div>
                                                    <div className="mt-1 flex flex-col items-end gap-0.5">
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                            <FiCalendar size={10} /> {formattedDate}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-gray-400 tracking-wider">
                                                            <FiClock size={10} /> {formattedTime}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dropdown Section */}
                                            <details className="mt-5 group/details">
                                                <summary className="list-none cursor-pointer flex items-center justify-center py-2 px-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover/details:text-blue-600 flex items-center gap-2">
                                                        <FiMapPin size={12} /> {t('view_all')} {t('stock')} <FiArrowLeft className="rotate-[270deg] transition-transform group-open/details:rotate-90" size={10} />
                                                    </span>
                                                </summary>
                                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 animate-in slide-in-from-top-2 duration-300">
                                                    <StockBranch 
                                                        name="Central Mall Branch" 
                                                        count="42" 
                                                        status="high" 
                                                        t={t}
                                                        price={`${convert(priceEntry.price, 'TRY')} ${getCurrencySymbol()}`}
                                                        distance="0.8 km"
                                                    />
                                                    <StockBranch 
                                                        name="Downtown Express" 
                                                        count="5" 
                                                        status="low" 
                                                        t={t}
                                                        price={`${convert(priceEntry.price * 1.02, 'TRY')} ${getCurrencySymbol()}`}
                                                        distance="2.4 km"
                                                    />
                                                    <StockBranch 
                                                        name="City Square Hyper" 
                                                        count="128" 
                                                        status="high" 
                                                        t={t}
                                                        price={`${convert(priceEntry.price * 0.98, 'TRY')} ${getCurrencySymbol()}`}
                                                        distance="4.1 km"
                                                    />
                                                    <StockBranch 
                                                        name="Harbor Street Market" 
                                                        count="0" 
                                                        status="none" 
                                                        t={t}
                                                        price={`${convert(priceEntry.price, 'TRY')} ${getCurrencySymbol()}`}
                                                        distance="5.7 km"
                                                    />
                                                </div>
                                            </details>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Floating Action Bar (Sticky Best Price) */}
            {lowestPrice && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg animate-in slide-in-from-bottom-5 duration-500">
                    <div className="bg-blue-600 dark:bg-blue-500 rounded-3xl p-4 shadow-2xl shadow-blue-500/40 flex items-center justify-between text-white border-t border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                                <FiTrendingDown size={24} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Lowest Today</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black">{convert(lowestPrice.price, 'TRY')}</span>
                                    <span className="text-sm font-bold opacity-80">{getCurrencySymbol()}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setActiveTab('prices');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                            GET IT NOW
                        </button>
                    </div>
                </div>
            )}

            {/* Footer space for floating bar */}
            <div className="h-32" />

            {/* Quick actions only when coming from scanner */}
            {fromScan && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 z-40">
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
