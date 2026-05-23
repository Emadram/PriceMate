import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiCamera, FiChevronRight, FiPackage, FiZap, FiBell, FiInfo, FiAlertTriangle, FiHeart, FiMessageSquare, FiClock } from 'react-icons/fi';
import useAnnouncementStore from '../stores/announcementStore';
import useCategoriesStore from '../stores/categoriesStore';
import useNavHistoryStore from '../stores/navHistoryStore';
import { fetchProducts, fetchPricesForProducts, normalizeProduct } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/SkeletonLoaders';
import MarketsSection from '../components/MarketsSection';

const Home = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Stores
    const { categories, fetchCategories, getIconForCategory, loading: categoriesLoading } = useCategoriesStore();
    const fetchActiveAnnouncements = useAnnouncementStore(state => state.fetchActiveAnnouncements);

    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [marketInsights, setMarketInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigationStack = useNavHistoryStore((state) => state.stack);

    const tapFeedback = () => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
        }
    };

    const recentRoute = navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null;

    const getRecentRouteLabel = (route) => {
        if (!route) return 'Start with a scan';
        if (route.startsWith('/price-comparison/')) return 'Continue price comparison';
        if (route.startsWith('/product/')) return 'Continue product details';
        if (route.startsWith('/supermarket/')) return 'Continue store page';
        if (route.startsWith('/search')) return 'Continue browsing';
        if (route.startsWith('/favorites')) return 'Open favorites';
        if (route.startsWith('/profile')) return 'Back to profile';
        if (route.startsWith('/scan')) return 'Continue scanning';
        return 'Continue where you left off';
    };

    const getRecentRouteAction = (route) => {
        if (!route) return '/scan';
        return route;
    };

    const openRecentRoute = () => {
        tapFeedback();
        navigate(getRecentRouteAction(recentRoute));
    };

    const openScan = () => {
        tapFeedback();
        navigate('/scan');
    };

    const openSearch = () => {
        tapFeedback();
        navigate('/search');
    };

    const openFavorites = () => {
        tapFeedback();
        navigate('/favorites');
    };

    const openAI = () => {
        tapFeedback();
        document.querySelector('[aria-label="Open AI Assistant"]')?.click();
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
            const normalizedProducts = products.map(p => 
                normalizeProduct(p, batchPrices)
            );

            setFeaturedProducts(normalizedProducts);
        } catch (error) {
            console.error('Error loading data:', error);
            setError('Failed to load products. Please check your connection.');
        }
        setLoading(false);
    }, [fetchActiveAnnouncements, fetchCategories]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            const url = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
            navigate(url);
        }
    };

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
                                {t('ready_to_save', 'Ready to find the best deals today?')}
                            </p>
                        </div>
                    </div>

                        {/* Live Market Overview */}
                    <div className="relative -mx-4 px-4 overflow-x-auto no-scrollbar flex items-stretch gap-3 sm:gap-4 animate-in slide-in-from-bottom-2 duration-1000 pb-2 snap-x">
                        {marketInsights.map((insight) => (
                            <div 
                                key={insight.id} 
                                className="flex-shrink-0 bg-white dark:bg-gray-900 transition-all border border-gray-100 dark:border-gray-800 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-5 sm:py-4 shadow-soft flex items-center gap-2.5 sm:gap-3 max-w-[min(100%,18.5rem)] sm:max-w-none sm:min-w-[220px] md:min-w-[260px] cursor-default hover:border-brand-100 dark:hover:border-brand-900/30 snap-center"
                            >
                                <div className="text-sm sm:text-lg shrink-0">{insight.icon}</div>
                                <span className="text-[11px] sm:text-sm font-semibold tracking-tight line-clamp-2">{insight.text}</span>
                            </div>
                        ))}
                        {marketInsights.length === 0 && (
                            <div className="flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-5 sm:py-4 shadow-soft flex items-center gap-2.5 sm:gap-3 max-w-[min(100%,18.5rem)] sm:min-w-[220px]">
                                <FiBell className="text-gray-400 shrink-0" />
                                <span className="text-[11px] sm:text-sm font-medium text-gray-400 tracking-tight">Checking for updates...</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Search Bar - Stripe Inspired Softness */}
                <section className="relative group animate-in slide-in-from-bottom-6 duration-700 delay-150">
                    <div className="absolute -inset-2 bg-gradient-to-r from-brand-500/10 to-accent-500/10 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                    <div className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-soft border border-gray-200/50 dark:border-gray-800/50 p-2 md:p-3 overflow-hidden">
                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
                            <div className="flex-1 relative w-full">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search_placeholder')}
                                    className="w-full pl-12 pr-11 py-4.5 sm:py-5 bg-transparent border-0 rounded-3xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 font-semibold text-base sm:text-lg"
                                />
                                <div className="absolute left-4.5 sm:left-5 top-1/2 -translate-y-1/2 text-gray-400">
                                    <FiSearch size={20} className="stroke-[2.5]" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto p-2 md:p-0">
                                <button
                                    type="submit"
                                    className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600 text-white px-8 py-3.5 sm:py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-brand-500/25 dark:shadow-brand-900/40 font-bold tracking-tight text-sm sm:text-base active:scale-95"
                                >
                                    {t('search')}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                {/* Mobile Quick Access */}
                <section className="md:hidden space-y-3 animate-in slide-in-from-bottom-6 duration-700 delay-200">
                    <div className="rounded-[1.75rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-soft p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Quick Access</p>
                                <h3 className="mt-1 text-base font-black tracking-tight text-gray-900 dark:text-white">Your last step</h3>
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
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600/70 dark:text-brand-400/80">Recent</p>
                                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white truncate">
                                        {getRecentRouteLabel(recentRoute)}
                                    </p>
                                </div>
                                <FiChevronRight className="shrink-0 text-gray-400" size={18} />
                            </div>
                        </button>

                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={openScan}
                                className="tap-target min-h-14 rounded-2xl bg-brand-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg shadow-brand-500/20 active:scale-[0.96] transition-transform"
                            >
                                <span className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                                    <FiCamera size={18} />
                                </span>
                                <span className="flex-1 text-left min-w-0">
                                    <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Scan</span>
                                    <span className="block text-sm font-black leading-none mt-1">Now</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={openSearch}
                                className="tap-target min-h-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm active:scale-[0.96] transition-transform"
                            >
                                <span className="h-9 w-9 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0 text-brand-600 dark:text-brand-500">
                                    <FiSearch size={18} />
                                </span>
                                <span className="flex-1 text-left min-w-0">
                                    <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Search</span>
                                    <span className="block text-sm font-black leading-none mt-1 text-gray-900 dark:text-white">Products</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={openFavorites}
                                className="tap-target min-h-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm active:scale-[0.96] transition-transform"
                            >
                                <span className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 text-red-500">
                                    <FiHeart size={18} />
                                </span>
                                <span className="flex-1 text-left min-w-0">
                                    <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Saved</span>
                                    <span className="block text-sm font-black leading-none mt-1 text-gray-900 dark:text-white">Favorites</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={openAI}
                                className="tap-target min-h-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm active:scale-[0.96] transition-transform"
                            >
                                <span className="h-9 w-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0 text-brand-600 dark:text-brand-500">
                                    <FiMessageSquare size={18} />
                                </span>
                                <span className="flex-1 text-left min-w-0">
                                    <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">AI</span>
                                    <span className="block text-sm font-black leading-none mt-1 text-gray-900 dark:text-white">Assistant</span>
                                </span>
                            </button>
                        </div>
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
                            {featuredProducts.map((product) => (
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
