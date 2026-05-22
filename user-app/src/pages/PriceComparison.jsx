import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { 
    FiArrowLeft, FiMapPin, FiShoppingCart, FiShare2, FiPackage, 
    FiShoppingBag, FiTrendingDown, FiTrendingUp, FiBox, FiHome, FiCamera, 
    FiImage, FiNavigation, FiClock, FiCheckCircle, FiAlertCircle, 
    FiCalendar, FiTag, FiPlusCircle, FiAlertTriangle, FiInfo 
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { buildDirectionsUrl, calculateDistance, hasValidLatLon, fetchSimilarProductsByCategory, fetchPricesForProducts, getRelationshipId, normalizeProduct } from '../utils/productUtils';
import PriceHistoryChart from '../components/PriceHistoryChart';
import AddPriceModal from '../components/AddPriceModal';
import ReportModal from '../components/ReportModal';
import StoreMap from '../components/StoreMap';
import BackButton from '../components/BackButton';
import FavoriteHeartButton from '../components/FavoriteHeartButton';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/SkeletonLoaders';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import useProductStore from '../stores/productStore';
import useFavoritesStore from '../stores/favoritesStore';
import useCurrencyStore from '../stores/currencyStore';
import useUserLocation from '../hooks/useUserLocation';
import StarRating from '../components/StarRating';

const normalizeStockStatus = (status) => {
    if (!status) return 'in_stock';
    if (status === 'high' || status === 'in_stock') return 'in_stock';
    if (status === 'low' || status === 'low_stock') return 'low_stock';
    if (status === 'none' || status === 'out_of_stock') return 'out_of_stock';
    return status;
};

const StockBranch = ({ name, status, price, distance, t, currencyLabel, supermarketId }) => {
    const normalizedStatus = normalizeStockStatus(status);
    const statusColors = {
        in_stock: "text-green-600 bg-green-50 dark:bg-green-900/20",
        low_stock: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
        out_of_stock: "text-red-500 bg-red-50 dark:bg-red-900/20"
    };
    
    const getStatusLabel = () => {
        if (normalizedStatus === 'out_of_stock') return t('out_of_stock');
        if (normalizedStatus === 'low_stock') return t('low_stock');
        return t('in_stock');
    };

    const inner = (
        <>
            <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-brand-600 transition-colors">
                    {name}
                </span>
                <div className="flex items-center gap-2">
                    {distance && (
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                             <FiMapPin size={10} /> {distance} km
                        </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[normalizedStatus] || statusColors.in_stock}`}>
                        {getStatusLabel()}
                    </span>
                </div>
            </div>
            
            <div className="text-right flex flex-col items-end">
                <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {price}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {currencyLabel || 'TRY'}
                </span>
            </div>
        </>
    );

    const className =
        'flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-soft hover:shadow-soft-lg transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700 cursor-pointer group';

    if (supermarketId) {
        return (
            <Link
                to={`/supermarket/${supermarketId}`}
                className={className}
                role="listitem"
                aria-label={`${name}, ${getStatusLabel()}, Distance: ${distance || 'unknown'} km, Price: ${price}`}
            >
                {inner}
            </Link>
        );
    }

    return (
        <div 
            className={className}
            role="listitem"
            aria-label={`${name}, ${getStatusLabel()}, Distance: ${distance || 'unknown'} km, Price: ${price}`}
        >
            {inner}
        </div>
    );
};

const PriceComparison = () => {
    const { t } = useTranslation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const { location: userLocation, error: locationError, loading: locationLoading, retry: retryLocation } = useUserLocation();
    const { barcode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [sortBy, setSortBy] = useState('price'); // 'price' or 'distance'
    const [isAddPriceModalOpen, setIsAddPriceModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const user = useAuthStore((state) => state.user);
    const { isProductFavorite, toggleProductFavorite } = useFavoritesStore();

    // From productStore
    const { 
        product, 
        prices: rawPrices, 
        loading, 
        error, 
        fetchProductByBarcode 
    } = useProductStore();
    const [prices, setPrices] = useState([]);
    const [similarProducts, setSimilarProducts] = useState([]);
    const [similarLoading, setSimilarLoading] = useState(false);

    const getSupermarketFromPrice = (price) => {
        if (!price) return null;
        if (price.supermarkets) {
            return Array.isArray(price.supermarkets) ? price.supermarkets[0] : price.supermarkets;
        }
        return price.supermarketId || null;
    };

    const getSupermarketId = (price) => {
        const supermarket = getSupermarketFromPrice(price);
        if (!supermarket) return null;
        return typeof supermarket === 'string' ? supermarket : supermarket.$id;
    };

    const getPriceTimestamp = (price) => price?.$updatedAt || price?.updatedAt || price?.$createdAt || price?.createdAt || null;

    const normalizePriceCurrency = (value) => {
        if (!value) return 'TRY';
        const upper = String(value).trim().toUpperCase();
        return upper === 'TL' ? 'TRY' : upper;
    };

    const getPriceCurrency = (price) => normalizePriceCurrency(price?.currency);

    const fromScan = location.state?.fromScan || searchParams.get('fromScan') === '1';

    const handleFavoriteClick = () => {
        if (!user) {
            toast.error('Log in to save favorites');
            return;
        }
        toggleProductFavorite(product.$id);
    };

    const supermarketIdParam = searchParams.get('supermarketId');

    useEffect(() => {
        fetchProductByBarcode(barcode);
    }, [barcode, fetchProductByBarcode]);

    useEffect(() => {
        if (!rawPrices) return;

        const pricesWithDistance = rawPrices.map((price) => {
            const supermarket = getSupermarketFromPrice(price);
            let distance = null;

            if (
                userLocation &&
                hasValidLatLon(userLocation.latitude, userLocation.longitude) &&
                supermarket &&
                typeof supermarket === 'object' &&
                hasValidLatLon(supermarket.latitude, supermarket.longitude)
            ) {
                distance = calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    supermarket.latitude,
                    supermarket.longitude
                );
            }

            return { ...price, distance: distance ? parseFloat(distance) : null };
        });

        // Grouping logic for multi-branch support
        const brandsMap = new Map();
        const noStoreFallback = [];

        pricesWithDistance.forEach((price) => {
            const supermarket = getSupermarketFromPrice(price);
            if (!supermarket) {
                noStoreFallback.push(price);
                return;
            }

            // Identify the grouping key (parentId or brand name or the supermarket itself)
            // If it's a branch, we group by its parentId. If it's a parent or has no parent, it's a group head.
            const brandId = supermarket.parentId || (supermarket.isParent ? supermarket.$id : supermarket.$id);
            
            if (!brandsMap.has(brandId)) {
                brandsMap.set(brandId, {
                    brand: supermarket.isParent ? supermarket : (supermarket.brand || supermarket.name),
                    prices: []
                });
            }
            brandsMap.get(brandId).prices.push(price);
        });

        // For now, to maintain UI compatibility, we'll keep picking the best price per brand
        // but mark entries that have "More branches"
        const finalPrices = [];
        brandsMap.forEach((group) => {
            // Sort group prices by logic (e.g., latest update)
            const sortedGroup = group.prices.sort((a, b) => {
                const aTime = new Date(getPriceTimestamp(a)).getTime();
                const bTime = new Date(getPriceTimestamp(b)).getTime();
                return bTime - aTime;
            });
            
            // Primary price entry for the brand
            const primary = { ...sortedGroup[0], _allBranches: sortedGroup };
            finalPrices.push(primary);
        });

        setPrices([...finalPrices, ...noStoreFallback]);
    }, [rawPrices, userLocation]);

    const productId = product?.$id;
    const productCategory = product?.categoryId;
    const productIsGlobal = product?.is_global;

    useEffect(() => {
        let active = true;

        const loadSimilar = async () => {
            if (!productId || productIsGlobal) {
                if (active) setSimilarProducts([]);
                return;
            }

            const categoryId = getRelationshipId(productCategory);
            if (!categoryId) {
                if (active) setSimilarProducts([]);
                return;
            }

            setSimilarLoading(true);
            try {
                const candidates = await fetchSimilarProductsByCategory(categoryId, productId, 6);
                const localIds = candidates.filter((p) => p.$id).map((p) => p.$id);
                const batchPrices = localIds.length > 0
                    ? await fetchPricesForProducts(localIds)
                    : [];
                const normalized = candidates.map((p) => normalizeProduct(p, batchPrices));
                if (active) setSimilarProducts(normalized);
            } catch (error) {
                console.warn('Similar products fetch failed:', error?.message || error);
            } finally {
                if (active) setSimilarLoading(false);
            }
        };

        loadSimilar();
        return () => {
            active = false;
        };
    }, [productId, productCategory, productIsGlobal]);

    const handleRefreshData = () => {
        fetchProductByBarcode(barcode);
    };

    const sortedPrices = useMemo(() => {
        let sorted = [...prices];
        const hasDistance = sorted.some((item) => item.distance !== null && item.distance !== undefined);

        // If query param exists, put that supermarket's price first
        if (supermarketIdParam) {
            sorted.sort((a, b) => {
                const aId = Array.isArray(a.supermarkets) ? a.supermarkets[0].$id : a.supermarkets.$id;
                const bId = Array.isArray(b.supermarkets) ? b.supermarkets[0].$id : b.supermarkets.$id;

                if (aId === supermarketIdParam) return -1;
                if (bId === supermarketIdParam) return 1;
                
                // Fallback to current sort preference
                if (sortBy === 'distance' && hasDistance) {
                    const aDist = a.distance ?? Infinity;
                    const bDist = b.distance ?? Infinity;
                    if (aDist !== bDist) return aDist - bDist;
                    return a.price - b.price;
                }
                return a.price - b.price;
            });
        } else {
            // Standard sorting
            if (sortBy === 'distance' && hasDistance) {
                sorted.sort((a, b) => {
                    const aDist = a.distance ?? Infinity;
                    const bDist = b.distance ?? Infinity;
                    if (aDist !== bDist) return aDist - bDist;
                    return a.price - b.price;
                });
            } else {
                sorted.sort((a, b) => a.price - b.price);
            }
        }
        return sorted;
    }, [prices, sortBy, supermarketIdParam]);

    const [showMapForPriceId, setShowMapForPriceId] = useState(null);

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
                <div className="w-full max-w-md rounded-[2rem] bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-5">
                        <FiPackage className="text-amber-500 text-4xl" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                        {error ? t('failed_to_load_product') : t('product_not_found')}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-2">
                        {error
                            ? error
                            : barcode
                                ? `We could not find a product for barcode ${barcode}. Try scanning again or search manually.`
                                : 'We could not find a product for this scan. Try scanning again or search manually.'}
                    </p>
                    {barcode && (
                        <div className="mt-4 mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-900/60 text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                            <FiAlertCircle className="text-amber-500" />
                            {barcode}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/scan')}
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-colors"
                        >
                            <FiCamera />
                            {t('scan_another_product')}
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <FiHome />
                            {t('go_back_home')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-safe md:pb-12">
            <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-2 pb-6 md:py-8 space-y-3 md:space-y-8">
                <div className="flex items-center">
                    <BackButton label="Go Back" onClick={handleBack} />
                </div>
                {locationError && (
                    <div className="rounded-3xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200">Distance view is limited</p>
                            <p className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-100/80 leading-snug">{locationError}</p>
                        </div>
                        <button
                            type="button"
                            onClick={retryLocation}
                            disabled={locationLoading}
                            className="shrink-0 inline-flex items-center justify-center rounded-2xl bg-amber-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity disabled:opacity-60"
                        >
                            Try Again
                        </button>
                    </div>
                )}
                {/* Product Info Card - Modern & Mobile Friendly */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="p-3 sm:p-6 md:p-10">
                        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-center md:items-start text-center md:text-left">
                            {/* Product Image */}
                            <div className="w-[6.75rem] h-[6.75rem] sm:w-36 sm:h-36 md:w-56 md:h-56 lg:w-64 lg:h-64 bg-gray-50 dark:bg-gray-900 rounded-2xl md:rounded-[3rem] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner border border-gray-100 dark:border-gray-800/50 relative group">
                                {product.imageUrl ? (
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-contain p-2.5 sm:p-6 md:p-8 transition-transform group-hover:scale-110 duration-500"
                                    />
                                ) : (
                                    <FiPackage className="text-gray-300 text-3xl sm:text-6xl" />
                                )}
                            </div>

                            {/* Product Details */}
                            <div className="flex-1 space-y-2.5 sm:space-y-4 md:space-y-5 w-full max-w-full">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                                        <span className="bg-brand-600/10 text-brand-600 dark:text-brand-500 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-brand-600/20">
                                            {getCategoryName()}
                                        </span>
                                        {product.stockQuantity > 0 && (
                                            <span className="bg-green-600/10 text-green-600 dark:text-green-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-green-600/20">
                                                In Stock
                                            </span>
                                        )}
                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border ${
                                            typeof product.stockQuantity === 'number' && product.stockQuantity <= 0
                                                ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                : typeof product.stockQuantity === 'number' && product.stockQuantity <= 5
                                                    ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                                    : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                        }`}>
                                            {typeof product.stockQuantity === 'number' ? `${product.stockQuantity} Units` : 'Stock count unavailable'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <h2 className="flex-1 min-w-0 text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight text-center md:text-left">
                                            {product.name}
                                        </h2>
                                        <div className="flex items-center justify-center md:justify-end gap-2 sm:gap-3 shrink-0">
                                            {user && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsReportModalOpen(true)}
                                                    className="inline-flex items-center gap-2 text-[9px] sm:text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest border border-gray-100 dark:border-gray-700 hover:border-red-100 dark:hover:border-red-900/30 px-2.5 sm:px-4 py-2 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-sm"
                                                >
                                                    <FiAlertTriangle size={14} />
                                                    Report
                                                </button>
                                            )}
                                            <FavoriteHeartButton
                                                className="shrink-0"
                                                pressed={isProductFavorite(product.$id)}
                                                onClick={handleFavoriteClick}
                                            />
                                        </div>
                                    </div>
                                </div>

                        {user && (
                        <>
                        <ReportModal 
                            isOpen={isReportModalOpen} 
                            onClose={() => setIsReportModalOpen(false)} 
                            targetName={product.name}
                            targetType="product"
                            targetId={product.$id}
                        />
                        </>
                        )}
                        
                        {product.description && (
                                    <p className="text-xs sm:text-sm md:text-base text-gray-500 dark:text-gray-400 leading-relaxed max-w-xl font-medium italic">
                                        "{product.description}"
                                    </p>
                                )}

                                {/* Global Database Health & Nutrition Info */}
                                {(product.nutriscore || product.allergens || product.is_global) && (
                                    <div className="pt-2 flex flex-wrap gap-3 items-center justify-center md:justify-start" aria-label="Product Nutrition and Information">
                                        {/* Nutriscore Badge */}
                                        {product.nutriscore && (
                                            <div 
                                                className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-3 py-1.5 shadow-soft"
                                                aria-label={`Nutriscore rating: ${product.nutriscore.toUpperCase()}`}
                                            >
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Nutriscore</span>
                                                <span 
                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg font-black text-white text-sm
                                                        ${product.nutriscore.toUpperCase() === 'A' ? 'bg-green-500 shadow-lg shadow-green-500/20' : 
                                                          product.nutriscore.toUpperCase() === 'B' ? 'bg-emerald-400' :
                                                          product.nutriscore.toUpperCase() === 'C' ? 'bg-yellow-400' :
                                                          product.nutriscore.toUpperCase() === 'D' ? 'bg-orange-500' :
                                                          'bg-red-500 shadow-lg shadow-red-500/20'}
                                                    `}
                                                    aria-hidden="true"
                                                >
                                                    {product.nutriscore.toUpperCase()}
                                                </span>
                                            </div>
                                        )}

                                        {/* Allergens List */}
                                        {product.allergens && product.allergens.length > 0 && (
                                            <div className="flex flex-wrap gap-1 items-center" aria-label={`Contains allergens: ${Array.isArray(product.allergens) ? product.allergens.join(', ') : product.allergens}`}>
                                                <FiAlertTriangle className="text-amber-500 mr-1" size={14} aria-hidden="true" />
                                                {(Array.isArray(product.allergens) ? product.allergens : product.allergens.split(',')).map((allergen, i) => (
                                                    <span key={i} className="bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider border border-amber-200/50">
                                                        {allergen.trim().replace('en:', '')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Global Product Disclaimer */}
                                        {product.is_global && (
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-brand-500/70 uppercase tracking-widest bg-brand-50/50 dark:bg-brand-900/10 px-3 py-1.5 rounded-xl border border-brand-100/30">
                                                <FiInfo size={12} />
                                                Global Database Source
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>

                {/* Price History Section */}
                <div className="space-y-4 md:space-y-6">
                    <div className="px-2">
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Trends</p>
                         <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">Market History</h3>
                    </div>
                    <PriceHistoryChart
                        productId={product?.$id}
                        productName={product?.name}
                        currentPrices={rawPrices}
                    />
                </div>

                {/* Available Stores Section */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Prices List & Sorting Controls */}
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">
                            {t('available_stores')} <span className="ml-1 text-brand-600 opacity-50">({prices.length})</span>
                        </h3>
                        
                        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <button 
                                type="button"
                                onClick={() => setSortBy('price')}
                                className={`tap-target h-11 w-11 p-2 rounded-lg transition-all ${sortBy === 'price' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-brand-600'}`}
                                title="By Price"
                            >
                                <FiTrendingDown size={14} />
                            </button>
                            <button 
                                type="button"
                                onClick={() => setSortBy('distance')}
                                className={`tap-target h-11 w-11 p-2 rounded-lg transition-all ${sortBy === 'distance' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-brand-600'}`}
                                disabled={!userLocation}
                                title="By Distance"
                            >
                                <FiNavigation size={14} />
                            </button>
                        </div>
                    </div>

                    {prices.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-10 md:p-16 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 space-y-8 animate-in fade-in zoom-in duration-500">
                            <div className="space-y-4">
                                <div className="relative inline-flex items-center justify-center p-8 bg-brand-50/50 dark:bg-brand-900/10 rounded-full border border-brand-100/30">
                                    <FiShoppingBag className="text-gray-300 text-6xl animate-pulse-slow" />
                                    <div className="absolute -top-1 -right-1 p-3 bg-brand-600 rounded-2xl shadow-lg shadow-brand-500/30 animate-float">
                                        <FiPlusCircle className="text-white" size={24} />
                                    </div>
                                </div>
                                <div className="max-w-xs mx-auto space-y-2">
                                    <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Help the community!</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                        Be the first to add a price for this product at your local supermarket.
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={() => setIsAddPriceModalOpen(true)}
                                aria-label="Add the first price for this product"
                                className="w-full max-w-sm inline-flex items-center justify-center gap-3 bg-brand-600 hover:bg-black text-white px-8 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-lg shadow-brand-500/30 hover:shadow-none transition-all duration-300 transform hover:scale-[0.98] active:scale-95 group"
                            >
                                <FiPlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                Add First Price
                            </button>

                            {product.is_global && (
                                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900/50 py-3 px-6 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                                    <FiInfo size={14} className="text-accent-500" />
                                    From our global database
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                                {sortedPrices.map((priceEntry) => {
                                    const supermarket = getSupermarketFromPrice(priceEntry);
                                    const supermarketId = typeof supermarket === 'string' ? supermarket : supermarket?.$id;
                                    const supermarketName = typeof supermarket === 'object' ? supermarket?.name : 'Store';
                                    const supermarketAddress = typeof supermarket === 'object' ? supermarket?.address : null;
                                    const hasCoordinates =
                                        typeof supermarket === 'object' &&
                                        hasValidLatLon(supermarket?.latitude, supermarket?.longitude);
                                    const hasDirections =
                                        hasCoordinates ||
                                        (typeof supermarket === 'object' &&
                                            supermarket?.googleMapsUrl &&
                                            supermarket?.googleMapsUrl.trim());
                                    const isSelectedContext = supermarketIdParam && supermarketId === supermarketIdParam;
                                    const isLowest = getLowestPrice()?.$id === priceEntry.$id;
                                    const normalizedStatus = normalizeStockStatus(priceEntry.stockStatus);
                                    const priceCurrency = getPriceCurrency(priceEntry);
                                    const convertedPrice = convert(priceEntry.price, priceCurrency);
                                    const ratingValue = typeof supermarket === 'object' ? (supermarket.rating ?? supermarket.avgRating ?? supermarket.averageRating ?? null) : null;
                                    const reviewsCount = typeof supermarket === 'object' ? (supermarket.reviewsCount ?? supermarket.reviews ?? null) : null;
                                    const isMapVisible = showMapForPriceId === priceEntry.$id;
                                    
                                    const updatedAtValue = getPriceTimestamp(priceEntry);
                                    const updatedAt = updatedAtValue ? new Date(updatedAtValue) : new Date();
                                    const formattedDate = updatedAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    const formattedTime = updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    const distanceDisplay = priceEntry.distance !== null ? `${priceEntry.distance} km` : t('calculating');

                                    return (
                                        <div
                                            key={priceEntry.$id}
                                            className={`group relative bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300 border-2 
                                                ${isSelectedContext ? 'border-brand-500 shadow-brand-500/10' : 'border-transparent'}
                                                ${isLowest && !isSelectedContext ? 'border-green-500 shadow-green-500/10' : ''}
                                            `}
                                        >
                                                <div className="flex items-center gap-2.5 sm:gap-4">
                                                    <Link 
                                                        to={supermarketId ? `/supermarket/${supermarketId}` : '#'}
                                                        className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gray-50 dark:bg-gray-900 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                                                    >
                                                        {typeof supermarket === 'object' && (supermarket.icon || supermarket.logoUrl) ? (
                                                            <img src={supermarket.icon || supermarket.logoUrl} className="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 object-contain" alt="" />
                                                        ) : (
                                                            <FiShoppingBag className="text-gray-200 text-lg sm:text-xl" />
                                                        )}
                                                    </Link>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                                                            {supermarketName}
                                                        </h4>
                                                        {typeof supermarket === 'object' && supermarket?.branchName && (
                                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                                                                {supermarket.branchName}
                                                            </span>
                                                        )}
                                                        {ratingValue !== null && ratingValue !== undefined && (
                                                            <div className="mt-1 flex items-center gap-2">
                                                                <StarRating value={ratingValue} size={14} />
                                                                <span className="text-[11px] text-gray-500">{ratingValue}</span>
                                                                {reviewsCount !== null && reviewsCount !== undefined && (
                                                                    <span className="text-[10px] text-gray-400">· {reviewsCount}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {supermarketAddress && (
                                                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-2">
                                                            <FiMapPin size={12} />
                                                            <span className="truncate">{supermarketAddress}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                        {hasDirections ? (
                                                            <a
                                                                href={buildDirectionsUrl(supermarket.latitude, supermarket.longitude, supermarket.googleMapsUrl)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="tap-target inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-500 hover:text-brand-700"
                                                                title={t('get_directions')}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <FiNavigation size={12} />
                                                                {distanceDisplay}
                                                            </a>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                                                                <FiNavigation size={12} />
                                                                {distanceDisplay}
                                                            </span>
                                                        )}
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                                                            normalizedStatus === 'out_of_stock' ? 'text-red-500' : 
                                                            normalizedStatus === 'low_stock' ? 'text-amber-500' : 
                                                            'text-green-600'
                                                        }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                                normalizedStatus === 'out_of_stock' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 
                                                                normalizedStatus === 'low_stock' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                                                                'bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.4)]'
                                                            }`} />
                                                            {normalizedStatus === 'out_of_stock' ? t('out_of_stock') : 
                                                             normalizedStatus === 'low_stock' ? t('low_stock') : 
                                                             t('in_stock')}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right flex flex-col items-end">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-lg sm:text-xl md:text-2xl font-bold ${isLowest ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                                            {convertedPrice}
                                                        </span>
                                                        <span className="text-xs font-semibold text-gray-400">{getCurrencySymbol()}</span>
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-gray-300">
                                                        <FiCalendar size={10} /> {formattedDate} {formattedTime}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Simplified branch details - keeping hidden by default for minimalism */}
                                            <details className="mt-4 group/details border-t border-gray-50 dark:border-gray-700/50 pt-3">
                                                        <summary className="list-none cursor-pointer flex items-center justify-between py-2 px-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover/details:text-brand-600 flex items-center gap-2">
                                                        {hasCoordinates ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setShowMapForPriceId(isMapVisible ? null : priceEntry.$id);
                                                                }}
                                                                        className={`tap-target h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                                                                    isMapVisible
                                                                        ? 'bg-brand-600 text-white'
                                                                        : 'bg-gray-900/70 text-white hover:bg-brand-600'
                                                                }`}
                                                                title={isMapVisible ? 'Hide Map' : 'Show Map'}
                                                                aria-label={isMapVisible ? 'Hide Map' : 'Show Map'}
                                                            >
                                                                <FiMapPin size={10} />
                                                            </button>
                                                        ) : (
                                                            <FiMapPin size={12} />
                                                        )}
                                                        {t('view_all')} {t('stock')} <FiArrowLeft className="rotate-[270deg] transition-transform group-open/details:rotate-90" size={10} />
                                                    </span>
                                                </summary>
                                                <div className="mt-4 space-y-4">
                                                    {/* Local Map showing branches - only when toggled */}
                                                        {isMapVisible && hasCoordinates && (
                                                        <div className="h-44 rounded-2xl overflow-hidden shadow-inner border border-gray-100 dark:border-gray-800/50 animate-in zoom-in-95 duration-300">
                                                            <StoreMap 
                                                                supermarkets={[supermarket]} 
                                                                lat={supermarket.latitude} 
                                                                lon={supermarket.longitude} 
                                                                zoom={14} 
                                                                height="100%" 
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 animate-in slide-in-from-top-2 duration-300">
                                                        {priceEntry._allBranches?.map((branchPrice) => {
                                                            const branchSM = getSupermarketFromPrice(branchPrice);
                                                            const bConverted = convert(branchPrice.price, getPriceCurrency(branchPrice));
                                                            const branchSupermarketId = getSupermarketId(branchPrice);
                                                            return (
                                                                <StockBranch 
                                                                    key={branchPrice.$id}
                                                                    name={`${supermarketName} - ${branchSM?.branchName || 'Main'}`}
                                                                    status={branchPrice.stockStatus || 'high'} 
                                                                    t={t}
                                                                    price={`${bConverted}`}
                                                                    currencyLabel={getCurrencySymbol()}
                                                                    distance={branchPrice.distance !== null ? `${branchPrice.distance}` : null}
                                                                    supermarketId={branchSupermarketId}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                {/* Similar Products */}
                {(similarLoading || similarProducts.length > 0) && (
                    <div className="space-y-4 md:space-y-6">
                        <div className="px-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Similar</p>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">Similar Products</h3>
                        </div>
                        {similarLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <ProductCardSkeleton key={i} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                {similarProducts.map((item) => (
                                    <ProductCard key={item.$id} product={item} prices={item.prices} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>


            {/* Quick actions only when coming from scanner */}
            {fromScan && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 z-40 pb-safe-nav">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex gap-3">
                        <button
                            onClick={handleGoHome}
                            aria-label="Go to home page"
                            className="tap-target flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            <FiHome /> Home
                        </button>
                        <button
                            onClick={handleScanAnother}
                            aria-label="Scan another product"
                            className="tap-target flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition"
                        >
                            <FiCamera /> Scan Another
                        </button>
                    </div>
                </div>
            )}

            {/* Contribution Modal */}
            {product && (
                <AddPriceModal 
                    isOpen={isAddPriceModalOpen} 
                    onClose={(wasSuccessful) => {
                        setIsAddPriceModalOpen(false);
                        if (wasSuccessful) {
                            handleRefreshData();
                        }
                    }} 
                    product={product}
                    barcode={barcode}
                />
            )}
        </div>
    );
};

export default PriceComparison;
