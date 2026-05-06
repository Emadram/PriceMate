import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    ShoppingBag, Package, MapPin, Phone, Mail, 
    MessageSquare, Star, Globe, 
    Clock, Home, AlertTriangle, TrendingDown,
    ChevronRight, ExternalLink, Share2, Info, ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
    fetchSupermarketById, 
    fetchPricesBySupermarket, 
    calculateDistance, 
    resolveRelatedSupermarkets,
    isStoreOpen,
    formatLastUpdate,
    getRelationshipAttribute,
    hasValidLatLon,
} from '../utils/productUtils';
import ReportModal from '../components/ReportModal';
import StoreMap from '../components/StoreMap';
import Navbar from '../components/Navbar';
import BackButton from '../components/BackButton';
import FavoriteHeartButton from '../components/FavoriteHeartButton';
import CategoryIconLabel from '../components/CategoryIconLabel';
import useFavoritesStore from '../stores/favoritesStore';
import useAuthStore from '../stores/authStore';
import useUserLocation from '../hooks/useUserLocation';
import useCurrencyStore from '../stores/currencyStore';

const SupermarketProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { location } = useUserLocation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const [supermarket, setSupermarket] = useState(null);
    const [branches, setBranches] = useState([]);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isProductReportOpen, setIsProductReportOpen] = useState(false);
    const [productReportTarget, setProductReportTarget] = useState(null);
    const { isSupermarketFavorite, toggleSupermarketFavorite } = useFavoritesStore();
    const user = useAuthStore((state) => state.user);

    const handleFavoriteClick = () => {
        if (!user) {
            alert('Please login to favorite supermarkets');
            return;
        }
        toggleSupermarketFavorite(supermarket.$id);
    };

    const handleReportClick = () => {
        if (!user) {
            alert('Please login to report issues');
            return;
        }
        setIsReportModalOpen(true);
    };

    useEffect(() => {
        loadSupermarketData();
    }, [id]);

    const loadSupermarketData = async () => {
        setLoading(true);
        try {
            const supermarketData = await fetchSupermarketById(id);
            if (supermarketData) {
                setSupermarket(supermarketData);
                
                const related = await resolveRelatedSupermarkets(supermarketData);
                const othersFirst = related.filter((b) => b.$id !== id);
                const sortedOthers = [...othersFirst].sort((a, b) =>
                    (a.address || a.branchName || '').localeCompare(b.address || b.branchName || '', undefined, {
                        sensitivity: 'base'
                    })
                );
                setBranches(sortedOthers);

                const productsData = await fetchPricesBySupermarket(id);
                setProducts(productsData);
            }
        } catch (error) {
            console.error('Error loading supermarket data:', error);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#0A0A0B] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-black/10 dark:border-white/10 border-t-black dark:border-t-white rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!supermarket) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#0A0A0B] p-6 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-[2rem] flex items-center justify-center mb-6">
                    <ShoppingBag className="text-gray-400 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Supermarket Not Found</h2>
                <p className="text-gray-500 mb-8 max-w-xs">We couldn't find the store you're looking for. It might have been removed or the link is broken.</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-black dark:bg-white text-white dark:text-black px-8 py-3.5 rounded-2xl font-semibold transition-transform active:scale-95 shadow-soft"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    const userGeoOk = location && hasValidLatLon(location.latitude, location.longitude);
    const storeGeoOk = hasValidLatLon(supermarket.latitude, supermarket.longitude);
    const distance = userGeoOk && storeGeoOk
        ? calculateDistance(location.latitude, location.longitude, supermarket.latitude, supermarket.longitude)
        : null;

    const ratingValue = supermarket.rating ?? supermarket.avgRating ?? supermarket.averageRating ?? null;
    const reviewsCount = supermarket.reviewsCount ?? supermarket.reviewCount ?? null;
    const statusFromDb = (supermarket.status || supermarket.storeStatus || '').toString().toLowerCase();
    const isOpen = statusFromDb
        ? ['open', 'opened', 'available'].includes(statusFromDb)
        : isStoreOpen(supermarket.openingHours);
    const latestProductUpdate = products.length > 0
        ? Math.max(...products.map((p) => new Date(p.$updatedAt).getTime()))
        : null;
    const lastUpdateValue = latestProductUpdate || supermarket.lastUpdatedAt || supermarket.updatedAt || supermarket.$updatedAt || null;

    return (
        <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0A0A0B] pb-24">
            <Navbar />

            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="flex items-center">
                    <BackButton label="Go Back" onClick={() => navigate(-1)} />
                </div>
            </div>

            {/* Profile Content */}
            <div className="max-w-4xl mx-auto px-6 mt-6 relative z-10">
                <div className="relative bg-white dark:bg-[#121214] rounded-[2.5rem] shadow-soft p-8 border border-gray-100 dark:border-white/5 transition-colors">
                    <div className="absolute top-6 right-6 flex gap-2">
                        <button className="w-11 h-11 bg-gray-50 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300 transition-all active:scale-90">
                            <Share2 size={18} />
                        </button>
                        <FavoriteHeartButton
                            pressed={isSupermarketFavorite(supermarket.$id)}
                            onClick={handleFavoriteClick}
                            ariaLabel={
                                isSupermarketFavorite(supermarket.$id)
                                    ? 'Remove supermarket from favorites'
                                    : 'Add supermarket to favorites'
                            }
                        />
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-8">
                        {/* Logo / Icon */}
                        <div className="w-32 h-32 bg-white dark:bg-[#1C1C1E] rounded-[2.2rem] shadow-2xl p-4 flex items-center justify-center flex-shrink-0 border border-gray-50 dark:border-white/5 overflow-hidden ring-8 ring-white dark:ring-[#121214]">
                            {supermarket.icon || supermarket.logoUrl ? (
                                <img src={supermarket.icon || supermarket.logoUrl} alt={supermarket.name} className="w-full h-full object-contain" />
                            ) : (
                                <ShoppingBag className="text-gray-300 w-12 h-12" />
                            )}
                        </div>

                        {/* Store Info Header */}
                        <div className="flex-1 w-full space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                {supermarket.isVerified && (
                                    <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-500/20">
                                        Verified Partner
                                    </span>
                                )}
                                {distance && (
                                    <span className="bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[12px] font-medium px-2.5 py-1 rounded-full">
                                        {distance} away
                                    </span>
                                )}
                            </div>
                            
                            <div className="space-y-1 relative">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                        {supermarket.name}
                                    </h1>
                                    
                                    {/* Branch Selector Hook */}
                                    {(branches.length > 0) && (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                                className="mt-1 p-2 bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all active:scale-95"
                                                title="Switch Branch"
                                            >
                                                <ChevronDown size={18} className={`transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isBranchDropdownOpen && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-40" 
                                                        onClick={() => setIsBranchDropdownOpen(false)}
                                                    ></div>
                                                    <div className="absolute left-0 mt-3 w-72 bg-white dark:bg-[#1C1C1E] rounded-[1.5rem] shadow-2xl border border-gray-100 dark:border-white/5 py-3 z-50 animate-in fade-in slide-in-from-top-2">
                                                        <div className="px-4 py-2 mb-2">
                                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Branches</p>
                                                        </div>
                                                        <div
                                                            className="w-full px-4 py-3 flex items-start gap-3 bg-gray-50/80 dark:bg-white/5 text-left border-b border-gray-100 dark:border-white/5"
                                                            aria-current="true"
                                                        >
                                                            <MapPin size={16} className="mt-0.5 text-blue-600 dark:text-blue-400" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Current</p>
                                                                <p className="text-[14px] font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                                    {supermarket.branchName ? `${supermarket.name} — ${supermarket.branchName}` : supermarket.address || 'This branch'}
                                                                </p>
                                                                {distance && (
                                                                    <p className="text-[12px] text-gray-500">{distance} away</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {branches.map(branch => (
                                                            <button
                                                                key={branch.$id}
                                                                type="button"
                                                                onClick={() => {
                                                                    navigate(`/supermarket/${branch.$id}`);
                                                                    setIsBranchDropdownOpen(false);
                                                                }}
                                                                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group"
                                                            >
                                                                <MapPin size={16} className="mt-0.5 text-gray-400 group-hover:text-black dark:group-hover:text-white" />
                                                                <div>
                                                                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                                        {branch.branchName ? `${branch.name || supermarket.name} — ${branch.branchName}` : branch.address || 'Branch'}
                                                                    </p>
                                                                    {userGeoOk && hasValidLatLon(branch.latitude, branch.longitude) && (
                                                                        <p className="text-[12px] text-gray-500">{calculateDistance(location.latitude, location.longitude, branch.latitude, branch.longitude)} km away</p>
                                                                    )}
                                                                </div>
                                                                <ChevronRight size={14} className="ml-auto mt-1 text-gray-300 group-hover:text-black dark:group-hover:text-white" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[15px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 ml-0.5">
                                    <MapPin size={14} className="text-gray-400" />
                                    {supermarket.address}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Action Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-8 border-t border-gray-50 dark:border-white/5">
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-4 rounded-2xl">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Products</p>
                            <p className="text-xl font-bold dark:text-white">{products.length}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-4 rounded-2xl">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Rating</p>
                            {ratingValue !== null && ratingValue !== undefined ? (
                                <div className="flex items-center gap-1">
                                    <p className="text-xl font-bold dark:text-white">{ratingValue}</p>
                                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                    {reviewsCount !== null && reviewsCount !== undefined && (
                                        <span className="text-[10px] text-gray-400 font-medium ml-1">({reviewsCount})</span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm font-semibold text-gray-400 pt-1">No ratings yet</p>
                            )}
                        </div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-4 rounded-2xl">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Status</p>
                            <div className="flex items-center gap-1.5 pt-1">
                                {isOpen ? (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-500">Open Now</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <p className="text-sm font-semibold text-red-600 dark:text-red-500">Closed</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-4 rounded-2xl">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Last Update</p>
                            <p className="text-sm font-semibold dark:text-white pt-1">
                                {lastUpdateValue ? formatLastUpdate(lastUpdateValue) : 'No updates yet'}
                            </p>
                        </div>
                    </div>

                    {/* Operational Details */}
                    <div className="mt-8 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex gap-2">
                                <button className="inline-flex items-center gap-2 px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all w-full md:w-auto">
                                    <ExternalLink size={16} />
                                    Get Directions
                                </button>
                                {user && (
                                <button
                                    onClick={handleReportClick}
                                    className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all border border-red-100 dark:border-red-500/20"
                                    title="Report an issue"
                                >
                                    <AlertTriangle size={20} />
                                </button>
                                )}
                            </div>
                            
                            <div className="flex gap-4">
                                {supermarket.phone && (
                                    <a href={`tel:${supermarket.phone}`} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                        <Phone size={20} />
                                    </a>
                                )}
                                {supermarket.website && (
                                    <a href={supermarket.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                        <Globe size={20} />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="mt-12 space-y-12">
                    {/* Map Section */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-2xl font-bold dark:text-white tracking-tight">Location</h2>
                            <span className="text-sm font-medium text-gray-400">Tap to expand map</span>
                        </div>
                        <div className="rounded-[2.5rem] overflow-hidden shadow-soft border border-gray-100 dark:border-white/5 h-64 relative group">
                            {storeGeoOk ? (
                                <StoreMap 
                                    supermarkets={[supermarket]} 
                                    center={[supermarket.latitude, supermarket.longitude]} 
                                    zoom={15}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1C1C1E] px-6 text-center">
                                    <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('supermarket_location_not_on_map')}</p>
                                    {supermarket.address && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{supermarket.address}</p>
                                    )}
                                </div>
                            )}
                            <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5 rounded-[2.5rem]"></div>
                        </div>
                    </section>

                    {/* Available Products Section */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-2xl font-bold dark:text-white tracking-tight">Available Items</h2>
                            <div className="flex items-center gap-4">
                                <TrendingDown size={18} className="text-green-500" />
                                <span className="text-sm font-medium text-gray-500">Live prices</span>
                            </div>
                        </div>

                        {products.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {products.map((price) => {
                                    const status = (price.stockStatus || '').toLowerCase();
                                    const stockBadgeClass =
                                        status === 'in-stock' || status === 'in_stock' || status === 'in stock' || status === 'available'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                                            : status === 'low-stock' || status === 'low_stock' || status === 'low stock' || status === 'low'
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                                                : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
                                    const stockLabel = price.stockStatus ? price.stockStatus.replace(/[_-]/g, ' ') : '';
                                    const productKey =
                                        price.products?.barcode ||
                                        price.products?.code ||
                                        price.products?.$id ||
                                        price.productId ||
                                        '';
                                    const productReportId = price.products?.$id || price.productId || null;
                                    const productReportName = price.products?.name || 'Product';
                                    const categoryFallback =
                                        price.products?.category ||
                                        getRelationshipAttribute(price.products?.categoryId, 'categoryName') ||
                                        getRelationshipAttribute(price.products?.categoryId, 'name') ||
                                        'Other';
                                    const productBrand =
                                        price.products?.brand || price.products?.brands || '';

                                    return (
                                    <Link 
                                        key={price.$id} 
                                        to={`/price-comparison/${productKey}`}
                                        className="group relative block overflow-hidden rounded-3xl border border-transparent bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gray-100 hover:shadow-soft-lg dark:bg-gray-800 dark:hover:border-gray-700"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-900 sm:h-28 sm:w-28">
                                                {(price.products?.image || price.products?.imageUrl || price.products?.image_url) ? (
                                                    <img 
                                                        src={price.products.image || price.products.imageUrl || price.products.image_url} 
                                                        alt={price.products.name} 
                                                        className="h-20 w-20 object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110 dark:mix-blend-normal sm:h-24 sm:w-24" 
                                                    />
                                                ) : (
                                                    <Package className="h-8 w-8 text-gray-300" />
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col py-1">
                                                <div className="mb-auto">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                            <h3 className="truncate text-base font-semibold leading-tight text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white sm:text-lg">
                                                                {price.products?.name || 'Unknown Product'}
                                                            </h3>
                                                            {price.stockStatus && (
                                                                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded-full ${stockBadgeClass}`}>
                                                                    {stockLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {user && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                setProductReportTarget({ id: productReportId, name: productReportName });
                                                                setIsProductReportOpen(true);
                                                            }}
                                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-sm transition-all hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
                                                            title="Report an issue"
                                                            aria-label="Report an issue"
                                                        >
                                                            <AlertTriangle size={18} />
                                                        </button>
                                                        )}
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <CategoryIconLabel
                                                            categoryId={price.products?.categoryId}
                                                            fallbackName={categoryFallback}
                                                        />
                                                        {productBrand && (
                                                            <>
                                                                <span className="hidden h-1 w-1 shrink-0 rounded-full bg-gray-300 sm:inline dark:bg-gray-600" aria-hidden />
                                                                <span className="max-w-[40%] truncate text-xs font-medium text-gray-400 sm:max-w-none dark:text-gray-500">{productBrand}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-green-600 dark:text-green-400">
                                                        Updated {new Date(price.$updatedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                                                    <div className="flex flex-wrap items-baseline gap-2">
                                                        <span className="text-xl font-bold leading-none text-gray-900 dark:text-white">
                                                            {getCurrencySymbol()} {convert(price.price)}
                                                        </span>
                                                        {price.isOnSale && (
                                                            <>
                                                                <span className="text-sm font-medium text-gray-400 line-through decoration-red-500/30">
                                                                    {getCurrencySymbol()} {convert(price.originalPrice)}
                                                                </span>
                                                                <span className="text-[10px] font-bold rounded-full bg-green-500 px-1.5 py-0.5 text-white ring-2 ring-white dark:ring-gray-800">SALE</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-12 text-center border border-dashed border-gray-200 dark:border-white/10 shadow-soft">
                                <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Info className="text-gray-300" />
                                </div>
                                <h3 className="text-xl font-semibold dark:text-white mb-2">No prices found</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">Help the community by contributing the first price for this location!</p>
                                <button className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-semibold active:scale-95 transition-all">
                                    Contribute Data
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                targetId={supermarket.$id}
                targetType="supermarket"
            />

            <ReportModal
                isOpen={isProductReportOpen}
                onClose={() => setIsProductReportOpen(false)}
                targetId={productReportTarget?.id}
                targetName={productReportTarget?.name}
                targetType="product"
            />
        </div>
    );
};

export default SupermarketProfile;
