import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiChevronRight, FiPackage, FiZap, FiBell, FiInfo, FiAlertTriangle, FiClock, FiSearch } from 'react-icons/fi';
import useAnnouncementStore from '../stores/announcementStore';
import useCategoriesStore from '../stores/categoriesStore';
import useNavHistoryStore from '../stores/navHistoryStore';
import useFavoritesStore from '../stores/favoritesStore';
import { fetchProducts, fetchPricesForProducts, normalizeProduct } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/SkeletonLoaders';
import MarketsSection from '../components/MarketsSection';

const Home = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    // Stores
    const { categories, fetchCategories, getIconForCategory, loading: categoriesLoading } = useCategoriesStore();
    const fetchActiveAnnouncements = useAnnouncementStore(state => state.fetchActiveAnnouncements);
    const favoriteProductIds = useFavoritesStore((state) => state.favoriteProducts);

    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [marketInsights, setMarketInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigationStack = useNavHistoryStore((state) => state.stack);
    const [webSearch, setWebSearch] = useState('');

    const tapFeedback = () => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
        }
    };

    const recentRoute = navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null;

    const getRecentRouteLabel = (route) => {
        if (!route) return 'Scan';
        if (route.startsWith('/price-comparison/')) return 'Price comparison';
        if (route.startsWith('/product/')) return 'Product details';
        if (route.startsWith('/supermarket/')) return 'Store page';
        if (route.startsWith('/search')) return 'Search';
        if (route.startsWith('/favorites')) return 'Favorites';
        if (route.startsWith('/profile')) return 'Profile';
        if (route.startsWith('/scan')) return 'Scan';
        return 'Recent page';
    };

    const getRecentRouteAction = (route) => {
        if (!route) return '/scan';
        return route;
    };

    const openRecentRoute = () => {
        tapFeedback();
        navigate(getRecentRouteAction(recentRoute));
    };

    const getGreetingKey = () => {
        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const hour = Number(
                new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    hour12: false,
                    timeZone,
                }).format(new Date())
            );

            if (hour >= 5 && hour < 12) return 'home_greeting_morning';
            if (hour >= 12 && hour < 17) return 'home_greeting_afternoon';
            if (hour >= 17 && hour < 22) return 'home_greeting_evening';
            return 'home_greeting_night';
        } catch {
            return 'home_greeting_day';
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch products and categories (Announcements handled by store)
            const [products, fetchedAnnouncements] = await Promise.all([
                fetchProducts(12),
                fetchActiveAnnouncements(5),
                fetchCategories()
            ]);

            if (!products) throw new Error('Failed to fetch products');

            // Map store announcements to marketInsights format
            const safeAnnouncements = Array.isArray(fetchedAnnouncements) ? fetchedAnnouncements : [];
            const announcementInsights = safeAnnouncements.map((ann) => {
                let icon = <FiBell className="text-accent-500" />;
                if (ann.category === 'offer') icon = <FiZap className="text-yellow-500" />;
                if (ann.category === 'alert') icon = <FiAlertTriangle className="text-red-500" />;
                if (ann.category === 'info') icon = <FiInfo className="text-sky-500" />;
                
                return {
                    id: ann.$id,
                    text: ann.text,
                    icon: icon
                };
            });

            // Batch fetch prices for these products
            const productIds = products.map(p => p.$id);
            const batchPrices = await fetchPricesForProducts(productIds);

            // Announcements are backend-only (no dynamic price insights)
            setMarketInsights(announcementInsights);

            // Normalize
            const normalizedProducts = products.map((p) => normalizeProduct(p, batchPrices));

            const favoriteCategoryIds = new Set(
                normalizedProducts
                    .filter((product) => favoriteProductIds.includes(product.$id))
                    .flatMap((product) => {
                        const categoryId = product.categoryId;
                        if (Array.isArray(categoryId)) {
                            return categoryId.map((item) => item?.$id).filter(Boolean);
                        }
                        return categoryId?.$id ? [categoryId.$id] : [];
                    })
            );

            const scoreProduct = (product) => {
                let score = 0;

                if (favoriteProductIds.includes(product.$id)) {
                    score += 100;
                }

                const productCategoryId = Array.isArray(product.categoryId)
                    ? product.categoryId[0]?.$id
                    : product.categoryId?.$id;

                if (productCategoryId && favoriteCategoryIds.has(productCategoryId)) {
                    score += 20;
                }

                const priceCount = Array.isArray(product.prices) ? product.prices.length : 0;
                score += Math.min(priceCount, 5);

                return score;
            };

            const personalizedProducts = [...normalizedProducts].sort((a, b) => {
                const scoreDiff = scoreProduct(b) - scoreProduct(a);
                if (scoreDiff !== 0) return scoreDiff;
                return String(a.name || a.productName || '').localeCompare(String(b.name || b.productName || ''), undefined, { sensitivity: 'base' });
            });

            setFeaturedProducts(personalizedProducts.slice(0, 4));
        } catch (error) {
            console.error('Error loading data:', error);
            setError('Failed to load products. Please check your connection.');
        }
        setLoading(false);
    }, [fetchActiveAnnouncements, fetchCategories, favoriteProductIds]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const greetingKey = getGreetingKey();

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-gray-950 pb-safe md:pb-12 text-gray-900 dark:text-gray-100 selection:bg-brand-500/30 transition-colors">
            <main className="max-w-5xl mx-auto px-4 pt-2 md:pt-8 space-y-5 sm:space-y-8 md:space-y-12 animate-in fade-in duration-700">
                {/* Header Section */}
                <header className="px-1 md:px-0 space-y-2.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="animate-in slide-in-from-left-4 duration-700">
                            <h1 className="text-[1.7rem] sm:text-2xl md:text-4xl font-black tracking-tight leading-tight">
                                {t('find_best_prices', 'Find the best prices')}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-[13px] sm:text-sm md:text-lg mt-1">
                                {t(greetingKey, 'Good morning')} — {t('home_ready_to_save', 'Ready to find the best deals today?')}
                            </p>
                        </div>
                    </div>

                    {/* Web-only search (desktop) */}
                    <div className="hidden md:block">
                        <div className="relative max-w-2xl">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={webSearch}
                                onChange={(e) => setWebSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const q = webSearch.trim();
                                        if (!q) return;
                                        navigate(`/search?q=${encodeURIComponent(q)}`);
                                    }
                                }}
                                placeholder={t('search_placeholder', 'Search products...')}
                                className="w-full min-h-12 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 pl-12 pr-4 text-gray-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                        </div>
                    </div>

                    {/* Live Market Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-in slide-in-from-bottom-2 duration-1000">
                        {marketInsights.map((insight) => (
                            <div
                                key={insight.id}
                                className="bg-white dark:bg-gray-900 transition-all border border-gray-100 dark:border-gray-800 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-5 sm:py-4 shadow-soft flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-default hover:border-brand-100 dark:hover:border-brand-900/30"
                            >
                                <div className="text-sm sm:text-lg shrink-0">{insight.icon}</div>
                                <span className="text-[11px] sm:text-sm font-semibold tracking-tight line-clamp-2 min-w-0">
                                    {insight.text}
                                </span>
                            </div>
                        ))}
                        {marketInsights.length === 0 && (
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-5 sm:py-4 shadow-soft flex items-center gap-2.5 sm:gap-3 min-w-0">
                                <FiBell className="text-gray-400 shrink-0" />
                                <span className="text-[11px] sm:text-sm font-medium text-gray-400 tracking-tight min-w-0">
                                    Checking for updates...
                                </span>
                            </div>
                        )}
                    </div>
                </header>


                {/* Mobile Quick Access */}
                <section className="md:hidden space-y-3 animate-in slide-in-from-bottom-6 duration-700 delay-200">
                    <div className="rounded-[1.75rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-soft p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Recent</p>
                                <h3 className="mt-1 text-base font-black tracking-tight text-gray-900 dark:text-white">Page you were on</h3>
                            </div>
                            <div className="h-10 w-10 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-500">
                                <FiClock size={18} />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={openRecentRoute}
                            className="w-full rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-left transition active:scale-[0.98] active:shadow-sm"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600/70 dark:text-brand-400/80">Recently</p>
                                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white truncate">
                                        {getRecentRouteLabel(recentRoute)}
                                    </p>
                                </div>
                                <FiChevronRight className="shrink-0 text-gray-400" size={18} />
                            </div>
                        </button>
                    </div>
                </section>

                {/* Categories Grid - Apple Style */}
                <section className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold tracking-tight">{t('popular_categories', 'Popular Categories')}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('browse_by_type', 'BROWSE BY TYPE')}</p>
                        </div>
                        <button 
                            onClick={() => navigate('/search')}
                            className="tap-target flex items-center gap-1 text-xs font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-900/20 px-3 py-2 rounded-full transition-all"
                        >
                            {t('view_all', 'View All')}
                            <FiChevronRight size={14} />
                        </button>
                    </div>
                    
                    <div className="flex overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 pb-2 snap-x">
                        {loading || categoriesLoading
                            ? [...Array(6)].map((_, i) => <div key={i} className="flex-shrink-0 w-[6.75rem] h-[6.75rem] sm:w-auto sm:h-auto bg-gray-200 dark:bg-gray-800 rounded-2xl sm:rounded-3xl animate-pulse" />)
                            : categories.slice(0, 11).map((cat) => {
                                const categoryLabel = cat.categoryName || cat.name || 'Category';

                                return (
                                    <button 
                                        key={cat.$id}
                                        onClick={() => navigate(`/search?category=${cat.$id}`)}
                                        className="flex-shrink-0 w-[6.75rem] h-[6.75rem] sm:w-auto sm:aspect-square sm:min-h-0 sm:h-auto flex flex-col items-center justify-center p-4 sm:p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[1.5rem] sm:rounded-[2rem] shadow-soft hover:shadow-xl hover:translate-y-[-4px] transition-all group snap-center"
                                    >
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl sm:text-2xl text-brand-600 group-hover:scale-110 transition-transform">
                                            {getIconForCategory(cat)}
                                        </div>
                                        <span className="mt-2.5 sm:mt-4 text-[11px] sm:text-[13px] font-bold tracking-tight text-gray-900 dark:text-gray-100 text-center line-clamp-2 sm:line-clamp-1">
                                            {categoryLabel}
                                        </span>
                                    </button>
                                );
                            })}

                        {!loading && categories.length > 11 && (
                            <button 
                                onClick={() => navigate('/search')}
                                className="flex-shrink-0 w-[6.75rem] h-[6.75rem] sm:w-auto sm:aspect-square sm:min-h-0 sm:h-auto flex flex-col items-center justify-center p-4 sm:p-6 bg-brand-600 dark:bg-brand-800 border border-brand-500 dark:border-brand-700 rounded-[1.5rem] sm:rounded-[2rem] shadow-soft dark:shadow-brand-900/40 hover:shadow-xl hover:translate-y-[-4px] transition-all group snap-center"
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center text-xl sm:text-2xl text-white group-hover:scale-110 transition-transform">
                                    <FiChevronRight />
                                </div>
                                <span className="mt-2.5 sm:mt-4 text-[11px] sm:text-[13px] font-bold tracking-tight text-white text-center">{t('view_all', 'View All')}</span>
                            </button>
                        )}
                    </div>
                </section>

                {/* Scanner CTA removed per user preference */}

                {/* Featured Products */}
                <section className="space-y-5 sm:space-y-6 md:space-y-8 animate-in slide-in-from-bottom-10 duration-700 delay-500">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex flex-col min-w-0 pr-2">
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                {t('featured_products', 'Featured Picks')}
                            </h2>
                            <p className="text-sm font-semibold text-gray-400 mt-1 uppercase tracking-widest leading-none">
                                {t('personalized_deals', 'DEALS PICKED FOR YOU')}
                            </p>
                        </div>
                        <button 
                            onClick={() => navigate('/search')}
                            className="tap-target flex items-center gap-1 text-sm font-bold text-brand-600 hover:text-brand-700 px-5 py-3 bg-brand-50 dark:bg-brand-900/20 rounded-full transition-all"
                        >
                            {t('view_all')}
                            <FiChevronRight size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-8 px-1">
                            {[...Array(4)].map((_, i) => (
                                <ProductCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft p-20 text-center border border-gray-100 dark:border-gray-800">
                            <FiAlertTriangle size={56} className="mx-auto text-red-100 dark:text-red-900/30 mb-6" />
                            <p className="text-gray-900 dark:text-white font-bold text-lg mb-4">{error}</p>
                            <button 
                                onClick={loadData}
                                className="px-8 py-3 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-brand-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : featuredProducts.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft p-20 text-center border border-gray-100 dark:border-gray-800">
                            <FiPackage size={56} className="mx-auto text-gray-200 mb-6" />
                            <p className="text-gray-400 font-bold text-lg">{t('no_products')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-8 px-1 pb-10">
                            {featuredProducts.slice(0, 4).map((product) => (
                                <ProductCard
                                    key={product.$id}
                                    product={product}
                                    prices={product.prices}
                                />
                            ))}
                        </div>
                    )}
                </section>
                
                <MarketsSection />
            </main>
        </div>
    );
};

export default Home;
