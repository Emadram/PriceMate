import { useCallback, useEffect, useState } from 'react';
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
    resolveCoordinates,
} from '../utils/productUtils';
import ReportModal from '../components/ReportModal';
import StoreMap from '../components/StoreMap';
import BackButton from '../components/BackButton';
import FavoriteHeartButton from '../components/FavoriteHeartButton';
import CategoryIconLabel from '../components/CategoryIconLabel';
import useFavoritesStore from '../stores/favoritesStore';
import useAuthStore from '../stores/authStore';
import useUserLocation from '../hooks/useUserLocation';
import useCurrencyStore from '../stores/currencyStore';
import StarRating from '../components/StarRating';

const extractEmbedSrc = (embedHtml) => {
    const text = String(embedHtml || '').trim();
    if (!text) return '';
    const match = text.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (match) {
        const src = match[1];
        if (!/google\.com\/maps\/embed/i.test(src)) return '';
        return src;
    }
    return /google\.com\/maps\/embed/i.test(text) ? text : '';
};

const SupermarketProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { location, error: locationError, loading: locationLoading, retry: retryLocation } = useUserLocation();
    const [showRoute, setShowRoute] = useState(false);
    const [routeOrigin, setRouteOrigin] = useState(null);
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
            alert(t('login_to_favorite_supermarkets', 'Please login to favorite supermarkets'));
            return;
        }
        toggleSupermarketFavorite(supermarket.$id);
    };

    const handleReportClick = () => {
        if (!user) {
            alert(t('login_to_report_issues', 'Please login to report issues'));
            return;
        }
        setIsReportModalOpen(true);
    };

    const handleShareClick = async () => {
        const shareUrl = window.location.href;
        const shareText = supermarket?.name
            ? `${supermarket.name} on PriceMate`
            : t('share_supermarket_text', 'Check this supermarket on PriceMate');

        try {
            if (navigator.share) {
                await navigator.share({
                    title: supermarket?.name || 'PriceMate',
                    text: shareText,
                    url: shareUrl,
                });
                return;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                alert(t('link_copied', 'Link copied to clipboard'));
                return;
            }

            window.prompt(t('copy_this_link', 'Copy this link'), shareUrl);
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error('Share failed:', error);
                alert(t('share_failed', 'Could not share this page right now.'));
            }
        }
    };

    const loadSupermarketData = useCallback(async () => {
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
    }, [id]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadSupermarketData();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [loadSupermarketData]);

    useEffect(() => {
        const t = setTimeout(() => setIsBranchDropdownOpen(false), 0);
        return () => clearTimeout(t);
    }, [id]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setShowRoute(false);
            setRouteOrigin(null);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [id]);

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
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{t('supermarket_not_found', 'Supermarket Not Found')}</h2>
                <p className="text-gray-500 mb-8 max-w-xs">{t('supermarket_not_found_description', "We couldn't find the store you're looking for. It might have been removed or the link is broken.")}</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-black dark:bg-white text-white dark:text-black px-8 py-3.5 rounded-2xl font-semibold transition-transform active:scale-95 shadow-soft"
                >
                    {t('go_back_home')}
                </button>
            </div>
        );
    }

    const userGeoOk = location && hasValidLatLon(location.latitude, location.longitude);
    const resolvedStoreCoordinates = resolveCoordinates(supermarket);
    const storeGeoOk = !!resolvedStoreCoordinates;
    const embedSrc = extractEmbedSrc(supermarket.embedHtml);
    const hasEmbed = !!embedSrc;

    const formatDistance = (value) => {
        if (!Number.isFinite(value)) return null;
        const formatter = new Intl.NumberFormat(i18n?.language || undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
        return formatter.format(value);
    };

    const resolveDistanceKm = (market) => {
        const marketCoordinates = resolveCoordinates(market);
        if (userGeoOk && marketCoordinates) {
            const computed = Number(calculateDistance(location.latitude, location.longitude, marketCoordinates.latitude, marketCoordinates.longitude));
            return Number.isFinite(computed) ? computed : null;
        }
        return null;
    };

    const distanceValue = resolveDistanceKm(supermarket);
    const distanceLabel = distanceValue !== null ? formatDistance(distanceValue) : null;

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
        <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0A0A0B] pb-safe">
            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="flex items-center">
                    <BackButton label={t('go_back', 'Go Back')} onClick={() => navigate(-1)} />
                </div>
            </div>

            {locationError && (
                <div className="max-w-4xl mx-auto px-4 mb-4">
                    <div className="rounded-3xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t('route_location_limited')}</p>
                            <p className="text-xs text-amber-800/90 dark:text-amber-100/80">{locationError}</p>
                        </div>
                        <button
                            type="button"
                            onClick={retryLocation}
                            disabled={locationLoading}
                            className="shrink-0 inline-flex items-center justify-center rounded-2xl bg-amber-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-opacity disabled:opacity-60"
                        >
                            {t('try_again')}
                        </button>
                    </div>
                </div>
            )}

            {/* Profile Content */}
            <div className="max-w-4xl mx-auto px-3 sm:px-6 mt-3 sm:mt-6 relative z-10">
                <div className="relative bg-white dark:bg-[#121214] rounded-2xl sm:rounded-[2.5rem] shadow-soft p-4 sm:p-6 md:p-8 border border-gray-100 dark:border-white/5 transition-colors">
                    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2">
                        <button
                            type="button"
                            onClick={handleShareClick}
                            className="tap-target h-11 w-11 bg-gray-50 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300 transition-all active:scale-90"
                            aria-label={t('share_supermarket', 'Share supermarket')}
                            title={t('share_supermarket', 'Share supermarket')}
                        >
                            <Share2 size={18} />
                        </button>
                        <FavoriteHeartButton
                            pressed={isSupermarketFavorite(supermarket.$id)}
                            onClick={handleFavoriteClick}
                            ariaLabel={
                                isSupermarketFavorite(supermarket.$id)
                                    ? t('remove_supermarket_favorite', 'Remove supermarket from favorites')
                                    : t('add_supermarket_favorite', 'Add supermarket to favorites')
                            }
                        />
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-3 sm:gap-6 md:gap-8">
                        {/* Logo / Icon */}
                        <div className="w-20 h-20 sm:w-28 sm:h-32 md:w-32 md:h-32 bg-white dark:bg-[#1C1C1E] rounded-[1.4rem] sm:rounded-[2.2rem] shadow-2xl p-2.5 sm:p-4 flex items-center justify-center flex-shrink-0 border border-gray-50 dark:border-white/5 overflow-hidden ring-4 sm:ring-8 ring-white dark:ring-[#121214]">
                            {supermarket.icon || supermarket.logoUrl ? (
                                <img src={supermarket.icon || supermarket.logoUrl} alt={supermarket.name} className="w-full h-full object-contain" />
                            ) : (
                                <ShoppingBag className="text-gray-300 w-8 h-8 sm:w-12 sm:h-12" />
                            )}
                        </div>

                        {/* Store Info Header */}
                        <div className="flex-1 w-full space-y-3 sm:space-y-4">
                            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                                {supermarket.isVerified && (
                                    <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-500 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-100 dark:border-brand-500/20">
                                        {t('verified_partner', 'Verified Partner')}
                                    </span>
                                )}
                                {distanceLabel && (
                                    <span className="bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[11px] font-medium px-2.5 py-1 rounded-full">
                                        {t('distance_away', { distance: distanceLabel, defaultValue: '{{distance}} km away' })}
                                    </span>
                                )}
                            </div>
                            
                            <div className="space-y-1 relative">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                                        {supermarket.name}
                                    </h1>
                                    
                                    {/* Branch Selector Hook */}
                                    {(branches.length > 0) && (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                                className="tap-target h-11 w-11 mt-1 p-2 bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all active:scale-95"
                                                title={t('switch_branch', 'Switch Branch')}
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
                                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t('branches', 'Branches')}</p>
                                                        </div>
                                                        <div
                                                            className="w-full px-4 py-3 flex items-start gap-3 bg-gray-50/80 dark:bg-white/5 text-left border-b border-gray-100 dark:border-white/5"
                                                            aria-current="true"
                                                        >
                                                            <MapPin size={16} className="mt-0.5 text-brand-600 dark:text-brand-500" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-bold text-brand-600 dark:text-brand-500 uppercase tracking-wider mb-0.5">{t('current', 'Current')}</p>
                                                                <p className="text-[13px] sm:text-[14px] font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                                    {supermarket.branchName ? `${supermarket.name} — ${supermarket.branchName}` : supermarket.address || t('this_branch', 'This branch')}
                                                                </p>
                                                                {distanceLabel && (
                                                                    <p className="text-[11px] sm:text-[12px] text-gray-500">{t('distance_away', { distance: distanceLabel, defaultValue: '{{distance}} km away' })}</p>
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
                                                                    <p className="text-[13px] sm:text-[14px] font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                                        {branch.branchName ? `${branch.name || supermarket.name} — ${branch.branchName}` : branch.address || t('branch', 'Branch')}
                                                                    </p>
                                                                    {resolveDistanceKm(branch) !== null && (
                                                                        <p className="text-[11px] sm:text-[12px] text-gray-500">{t('distance_away', { distance: formatDistance(resolveDistanceKm(branch)), defaultValue: '{{distance}} km away' })}</p>
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
                                <p className="text-sm sm:text-[15px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 ml-0.5">
                                    <MapPin size={14} className="text-gray-400" />
                                    {supermarket.address}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Action Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 mt-5 sm:mt-10 pt-5 sm:pt-8 border-t border-gray-50 dark:border-white/5">
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                            <p className="text-[9px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">{t('products', 'Products')}</p>
                            <p className="text-base sm:text-xl font-bold dark:text-white">{products.length}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                            <p className="text-[9px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">{t('rating', 'Rating')}</p>
                            {ratingValue !== null && ratingValue !== undefined ? (
                                <div className="flex flex-col gap-0.5 min-w-0 sm:flex-row sm:items-center sm:gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <StarRating value={ratingValue} size={14} />
                                        <p className="text-base sm:text-xl font-bold dark:text-white shrink-0">{ratingValue}</p>
                                    </div>
                                    {reviewsCount !== null && reviewsCount !== undefined && (
                                        <span className="text-[10px] text-gray-400 font-medium truncate">({reviewsCount})</span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs sm:text-sm font-semibold text-gray-400 pt-1">{t('no_ratings_yet', 'No ratings yet')}</p>
                            )}
                        </div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                            <p className="text-[9px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">{t('status', 'Status')}</p>
                            <div className="flex items-center gap-1.5 pt-1">
                                {isOpen ? (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <p className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-500">{t('open_now', 'Open Now')}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <p className="text-xs sm:text-sm font-semibold text-red-600 dark:text-red-500">{t('closed', 'Closed')}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                            <p className="text-[9px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">{t('last_updated')}</p>
                            <p className="text-[11px] sm:text-sm font-semibold dark:text-white pt-1 leading-snug">
                                {lastUpdateValue ? formatLastUpdate(lastUpdateValue) : t('no_updates_yet', 'No updates yet')}
                            </p>
                        </div>
                    </div>

                    {/* Operational Details */}
                    <div className="mt-8 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex gap-2">
                                    <div className="flex items-center gap-2">


                                        {locationLoading && !location && (
                                            <button
                                                type="button"
                                                disabled
                                                className="tap-target inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold opacity-75 bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-white/5 cursor-not-allowed"
                                            >
                                                <svg className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400" viewBox="0 0 24 24">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" className="opacity-25" />
                                                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                                                </svg>
                                                {t('loading')}
                                            </button>
                                        )}
                                    </div>
                                {user && (
                                <button
                                    onClick={handleReportClick}
                                    className="tap-target inline-flex items-center gap-2 h-11 px-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all border border-red-100 dark:border-red-500/20"
                                    title={t('report_issue', 'Report an issue')}
                                >
                                    <AlertTriangle size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">{t('report', 'Report')}</span>
                                </button>
                                )}
                            </div>
                            
                            <div className="flex gap-4">
                                {supermarket.phone && (
                                    <a href={`tel:${supermarket.phone}`} className="tap-target h-11 w-11 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                        <Phone size={20} />
                                    </a>
                                )}
                                {supermarket.website && (
                                    <a href={supermarket.website} target="_blank" rel="noopener noreferrer" className="tap-target h-11 w-11 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                        <Globe size={20} />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="mt-8 sm:mt-12 space-y-8 sm:space-y-12">
                    {/* Map Section */}
                    <section className="space-y-4 sm:space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl sm:text-2xl font-bold dark:text-white tracking-tight">{t('location', 'Location')}</h2>
                            {location && hasValidLatLon(location.latitude, location.longitude) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRoute((current) => {
                                            if (current) {
                                                setRouteOrigin(null);
                                                return false;
                                            }

                                            setRouteOrigin({
                                                latitude: location.latitude,
                                                longitude: location.longitude,
                                            });
                                            return true;
                                        });
                                    }}
                                    className={`tap-target inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all border border-gray-100 dark:border-white/5 shadow-soft hover:shadow-soft-lg ${
                                        showRoute 
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' 
                                            : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white'
                                    }`}
                                >
                                    {showRoute ? t('hide_preview', 'Hide Preview') : t('preview_route')}
                                </button>
                            )}
                        </div>
                        <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-soft border border-gray-100 dark:border-white/5 h-52 sm:h-64 relative group">
                            {hasEmbed && !showRoute ? (
                                <div className="relative rounded-2xl overflow-hidden shadow-inner border border-gray-100 dark:border-gray-700" style={{ height: '100%' }}>
                                    <div className="bg-gray-50 dark:bg-gray-900 map-dark-invert" style={{ width: '100%', height: '100%' }}>
                                        <iframe
                                            src={embedSrc}
                                            title={t('map_location', 'Map location')}
                                            style={{ width: '100%', height: '100%', border: 0 }}
                                            loading="lazy"
                                            allowFullScreen
                                            sandbox="allow-scripts allow-same-origin allow-popups"
                                            referrerPolicy="no-referrer-when-downgrade"
                                        />
                                    </div>
                                </div>
                            ) : storeGeoOk ? (
                                <StoreMap 
                                    supermarkets={[supermarket]} 
                                    center={[resolvedStoreCoordinates.latitude, resolvedStoreCoordinates.longitude]} 
                                    zoom={15}
                                    height="100%"
                                    directionsFrom={showRoute ? routeOrigin : null}
                                    directionsTo={showRoute ? { latitude: resolvedStoreCoordinates.latitude, longitude: resolvedStoreCoordinates.longitude } : null}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1C1C1E] px-6 text-center">
                                    <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('location_not_available', 'Location not available')}</p>
                                    {supermarket.address && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{supermarket.address}</p>
                                    )}
                                </div>
                            )}
                            <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5 rounded-2xl sm:rounded-[2.5rem]"></div>
                        </div>
                    </section>

                    {/* Available Products Section */}
                    <section className="space-y-4 sm:space-y-6">
                        <div className="flex items-center justify-between px-2 gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold dark:text-white tracking-tight">{t('available_items', 'Available Items')}</h2>
                            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                                <TrendingDown size={16} className="sm:w-[18px] sm:h-[18px] text-green-500" />
                                <span className="text-xs sm:text-sm font-medium text-gray-500">{t('live_prices', 'Live prices')}</span>
                            </div>
                        </div>

                        {products.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                                    const productReportName = price.products?.name || t('product', 'Product');
                                    const categoryFallback =
                                        price.products?.category ||
                                        getRelationshipAttribute(price.products?.categoryId, 'categoryName') ||
                                        getRelationshipAttribute(price.products?.categoryId, 'name') ||
                                        t('other', 'Other');
                                    const productBrand =
                                        price.products?.brand || price.products?.brands || '';

                                    return (
                                    <Link 
                                        key={price.$id} 
                                        to={`/price-comparison/${productKey}`}
                                        className="group relative block overflow-hidden rounded-2xl sm:rounded-3xl border border-transparent bg-white p-3 sm:p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gray-100 hover:shadow-soft-lg dark:bg-gray-800 dark:hover:border-gray-700"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                                            <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-gray-900 sm:h-24 sm:w-24 md:h-28 md:w-28">
                                                {(price.products?.image || price.products?.imageUrl || price.products?.image_url) ? (
                                                    <img 
                                                        src={price.products.image || price.products.imageUrl || price.products.image_url} 
                                                        alt={price.products.name} 
                                                        className="h-[3.5rem] w-[3.5rem] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110 dark:mix-blend-normal sm:h-20 sm:w-20 md:h-24 md:w-24" 
                                                    />
                                                ) : (
                                                    <Package className="h-7 w-7 text-gray-300 sm:h-8 sm:w-8" />
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col py-0.5 sm:py-1">
                                                <div className="mb-auto">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                            <h3 className="truncate text-sm font-semibold leading-tight text-gray-900 transition-colors group-hover:text-brand-600 dark:text-white sm:text-base md:text-lg">
                                                                {price.products?.name || t('unknown_product', 'Unknown Product')}
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
                                                            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-sm transition-all hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
                                                            title={t('report_issue', 'Report an issue')}
                                                            aria-label={t('report_issue', 'Report an issue')}
                                                        >
                                                            <AlertTriangle size={16} className="sm:w-[18px] sm:h-[18px]" />
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
                                                <div className="mt-3 sm:mt-4 flex flex-wrap items-end justify-between gap-2">
                                                    <div className="flex flex-wrap items-baseline gap-2">
                                                        <span className="text-lg sm:text-xl font-bold leading-none text-gray-900 dark:text-white">
                                                            {getCurrencySymbol()} {convert(price.price)}
                                                        </span>
                                                        {price.isOnSale && (
                                                            <>
                                                                <span className="text-sm font-medium text-gray-400 line-through decoration-red-500/30">
                                                                    {getCurrencySymbol()} {convert(price.originalPrice)}
                                                                </span>
                                                                <span className="text-[10px] font-bold rounded-full bg-green-500 px-1.5 py-0.5 text-white ring-2 ring-white dark:ring-gray-800">{t('sale', 'SALE')}</span>
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
                                <h3 className="text-xl font-semibold dark:text-white mb-2">{t('no_data_yet')}</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">{t('no_data_yet_subtitle')}</p>
                                <button className="tap-target bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-semibold active:scale-95 transition-all">
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
