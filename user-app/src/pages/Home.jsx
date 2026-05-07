import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import { FiSearch, FiCamera, FiChevronRight, FiPackage, FiZap, FiBell, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import useAnnouncementStore from '../stores/announcementStore';
import useCategoriesStore from '../stores/categoriesStore';
import { fetchProducts, fetchPricesForProducts, normalizeProduct } from '../utils/productUtils';
import { db, Query } from '../lib/appwrite';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton, CategorySkeleton } from '../components/SkeletonLoaders';

const Home = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    
    // Stores
    const { categories, fetchCategories, getIconForCategory, loading: categoriesLoading } = useCategoriesStore();
    const activeAnnouncements = useAnnouncementStore(state => state.announcements);
    const fetchActiveAnnouncements = useAnnouncementStore(state => state.fetchActiveAnnouncements);

    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [marketInsights, setMarketInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
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
            const announcementInsights = (fetchedAnnouncements || activeAnnouncements).map((ann) => {
                let icon = <FiBell className="text-blue-500" />;
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
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim() || selectedCategory) {
            let url = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
            if (selectedCategory) {
                url += `&category=${encodeURIComponent(selectedCategory)}`;
            }
            navigate(url);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-gray-950 pb-20 md:pb-12 text-gray-900 dark:text-gray-100 selection:bg-blue-500/30">
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 pt-4 md:pt-12 space-y-8 sm:space-y-10 md:space-y-12 animate-in fade-in duration-700">
                {/* Header Section */}
                <header className="px-1 md:px-0 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="animate-in slide-in-from-left-4 duration-700">
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                {t('find_best_prices', 'Find the best prices')}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 font-medium md:text-lg mt-1">
                                {t('ready_to_save', 'Ready to find the best deals today?')}
                            </p>
                        </div>
                    </div>

                        {/* Live Market Overview */}
                    <div className="relative -mx-4 px-4 overflow-x-auto no-scrollbar flex items-stretch gap-3 sm:gap-4 animate-in slide-in-from-bottom-2 duration-1000 pb-2 snap-x">
                        {marketInsights.map((insight) => (
                            <div 
                                key={insight.id} 
                                className="flex-shrink-0 bg-white dark:bg-gray-900 transition-all border border-gray-100 dark:border-gray-800 rounded-xl sm:rounded-2xl px-3.5 py-3 sm:px-5 sm:py-4 shadow-soft flex items-center gap-2.5 sm:gap-3 max-w-[min(100%,18.5rem)] sm:max-w-none sm:min-w-[220px] md:min-w-[260px] cursor-default hover:border-blue-100 dark:hover:border-blue-900/30 snap-center"
                            >
                                <div className="text-base sm:text-lg shrink-0">{insight.icon}</div>
                                <span className="text-xs sm:text-sm font-semibold tracking-tight line-clamp-2">{insight.text}</span>
                            </div>
                        ))}
                        {marketInsights.length === 0 && (
                            <div className="flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl sm:rounded-2xl px-3.5 py-3 sm:px-5 sm:py-4 shadow-soft flex items-center gap-2.5 sm:gap-3 max-w-[min(100%,18.5rem)] sm:min-w-[220px]">
                                <FiBell className="text-gray-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-medium text-gray-400 tracking-tight">Checking for updates...</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Search Bar - Stripe Inspired Softness */}
                <section className="relative group animate-in slide-in-from-bottom-6 duration-700 delay-150">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                    <div className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-soft border border-gray-200/50 dark:border-gray-800/50 p-2 md:p-3 overflow-hidden">
                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
                            <div className="flex-1 relative w-full">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search_placeholder')}
                                    className="w-full pl-14 pr-12 py-5 bg-transparent border-0 rounded-3xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 font-semibold text-lg"
                                />
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                                    <FiSearch size={22} className="stroke-[2.5]" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto p-2 md:p-0">
                                <button
                                    type="submit"
                                    className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/25 font-bold tracking-tight text-base active:scale-95"
                                >
                                    {t('search')}
                                </button>
                            </div>
                        </form>
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
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full transition-all"
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
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl sm:text-2xl text-blue-600 group-hover:scale-110 transition-transform">
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
                                className="flex-shrink-0 w-[6.75rem] h-[6.75rem] sm:w-auto sm:aspect-square sm:min-h-0 sm:h-auto flex flex-col items-center justify-center p-4 sm:p-6 bg-blue-600 border border-blue-500 rounded-[1.5rem] sm:rounded-[2rem] shadow-soft hover:shadow-xl hover:translate-y-[-4px] transition-all group snap-center"
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center text-xl sm:text-2xl text-white group-hover:scale-110 transition-transform">
                                    <FiChevronRight />
                                </div>
                                <span className="mt-2.5 sm:mt-4 text-[11px] sm:text-[13px] font-bold tracking-tight text-white text-center">{t('view_all', 'View All')}</span>
                            </button>
                        )}
                    </div>
                </section>

                {/* Scanner CTA */}
                <section className="animate-in slide-in-from-bottom-10 duration-700 delay-450">
                    <button
                        onClick={() => navigate('/scan')}
                        className="w-full group relative bg-black dark:bg-blue-600 rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-12 overflow-hidden shadow-2xl transition-all active:scale-[0.99]"
                    >
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-400 opacity-20 blur-3xl rounded-full transition-transform group-hover:translate-x-12"></div>
                        <div className="relative flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:items-center md:gap-8 text-left">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-2xl group-hover:rotate-6 transition-transform">
                                <FiCamera className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-xl sm:text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">
                                    {t('scan_barcode')}
                                </h3>
                                <p className="text-blue-100/60 text-sm md:text-lg font-medium mt-2">
                                    {t('compare_live_prices', 'Instant price comparison at your fingertips')}
                                </p>
                            </div>
                            <div className="hidden md:block">
                                <div className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all">
                                    <FiChevronRight size={32} />
                                </div>
                            </div>
                            <div className="md:hidden mt-2">
                                <span className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full">
                                    {t('start_scanning', 'Start Scanning')}
                                </span>
                            </div>
                        </div>
                    </button>
                </section>

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
                            className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-full transition-all"
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
                                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-colors"
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
            </main>
        </div>
    );
};

export default Home;
