import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiFilter } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { fetchPricesForProducts, searchProducts, fetchCategories, normalizeProduct } from '../utils/productUtils';
import { getCacheEntry, swrGetOrFetch } from '../utils/swrCache';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/SkeletonLoaders';
import BackButton from '../components/BackButton';

const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const SearchResults = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const categoryIdFromUrl = searchParams.get('category') || '';

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [categories, setCategories] = useState([]);

    // Search form states
    const [searchInput, setSearchInput] = useState(query);
    const [selectedCategory, setSelectedCategory] = useState(categoryIdFromUrl);
    const [sortBy, setSortBy] = useState('relevance');

    const prevProductIds = useRef('');
    const prevPrices = useRef([]);
    const requestSeq = useRef(0);

    // Debounce search input changes to automatically update URL
    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchInput !== query || selectedCategory !== categoryIdFromUrl) {
                let url = `/search?q=${encodeURIComponent(searchInput.trim())}`;
                if (selectedCategory) {
                    url += `&category=${encodeURIComponent(selectedCategory)}`;
                }
                navigate(url, { replace: true });
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [searchInput, selectedCategory, query, categoryIdFromUrl, navigate]);

    const loadInitialData = useCallback(async () => {
        const seq = ++requestSeq.current;
        const key = `search:${encodeURIComponent(query)}:${encodeURIComponent(categoryIdFromUrl)}:${encodeURIComponent(sortBy)}`;

        const fetcher = async () => {
            // Fetch categories if not already fetched
            const [searchResults, allCategories] = await Promise.all([
                searchProducts(query, categoryIdFromUrl, 40, sortBy),
                categories.length === 0 ? fetchCategories() : Promise.resolve(categories)
            ]);

            const categoryMap = new Map((allCategories || []).map((cat) => [cat.$id, cat]));
            const enrichedResults = searchResults.map((product) => {
                if (!product) return product;
                const rawCategory = product.categoryId;
                const categoryId = typeof rawCategory === 'string'
                    ? rawCategory
                    : rawCategory?.$id;
                const categoryDoc = categoryMap.get(categoryId);
                return categoryDoc ? { ...product, categoryId: categoryDoc } : product;
            });

            // Now fetch prices ONLY for these products
            // Filter out global products as they won't have local IDs for batch price fetching
            const localProductIds = enrichedResults
                .filter(p => !p.is_global && p.$id)
                .map(p => p.$id);
            
            const currentIdsStr = localProductIds.join(',');
            
            // Only fetch prices if we have products to fetch for
            // (productUtils.js already guards this with cache, but doing it cleanly here)
            const shouldFetchPrices = localProductIds.length > 0 && currentIdsStr !== prevProductIds.current;
            const batchPrices = shouldFetchPrices
                ? await fetchPricesForProducts(localProductIds)
                : prevPrices.current;

            if (shouldFetchPrices) {
                prevPrices.current = batchPrices;
                prevProductIds.current = currentIdsStr;
            }

            if (localProductIds.length === 0) {
                prevPrices.current = [];
                prevProductIds.current = '';
            }

            // Normalize results
            let normalizedResults = enrichedResults.map(p => 
                normalizeProduct(p, batchPrices)
            );

            // Client-side price sorting (since prices are in a different collection)
            if (sortBy === 'price-asc') {
                normalizedResults.sort((a, b) => (a.cheapestPrice || Infinity) - (b.cheapestPrice || Infinity));
            } else if (sortBy === 'price-desc') {
                normalizedResults.sort((a, b) => (b.cheapestPrice || 0) - (a.cheapestPrice || 0));
            }

            return {
                products: normalizedResults,
                categories: allCategories || [],
                query,
                categoryIdFromUrl,
            };
        };

        const applyData = (payload, { isRefresh } = {}) => {
            if (seq !== requestSeq.current) return;
            if (!payload) return;

            setProducts(Array.isArray(payload.products) ? payload.products : []);
            if (Array.isArray(payload.categories) && payload.categories.length > 0) {
                setCategories(payload.categories);
            }

            // Sync local input with URL
            setSearchInput(payload.query ?? query);
            setSelectedCategory(payload.categoryIdFromUrl ?? categoryIdFromUrl);

            setLoading(false);
            setRefreshing(!!isRefresh);
        };

        // Try to show cached immediately (if present)
        try {
            const { data, fromCache, refreshing: willRefresh } = await swrGetOrFetch(key, {
                ttlMs: SEARCH_CACHE_TTL_MS,
                fetcher,
                onUpdate: (next) => applyData(next, { isRefresh: false }),
            });

            if (fromCache && data) {
                applyData(data, { isRefresh: willRefresh });
            } else {
                setLoading(true);
                setRefreshing(false);
                const entry = getCacheEntry(key);
                const awaited = entry?.promise ? await entry.promise : await fetcher();
                applyData(awaited, { isRefresh: false });
            }
        } catch (error) {
            if (seq !== requestSeq.current) return;
            console.error('Data loading error:', error);
            setLoading(false);
            setRefreshing(false);
        }
    }, [query, categoryIdFromUrl, sortBy, categories]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadInitialData();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [loadInitialData]);

    const handleSearch = (e) => {
        e.preventDefault();
        let url = `/search?q=${encodeURIComponent(searchInput.trim())}`;
        if (selectedCategory) {
            url += `&category=${encodeURIComponent(selectedCategory)}`;
        }
        navigate(url);
    };


    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-safe md:pb-8">
            {/* Extended Header for Search Context */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 md:sticky md:top-16 z-30">
                <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 md:py-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                        <div className="flex items-center justify-between md:justify-start gap-3 md:gap-4 flex-shrink-0">
                            <BackButton to="/" label={t('go_back_home')} />
                            <h1 className="text-base sm:text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                                {t('results')}
                            </h1>
                            <div className="md:hidden">
                                {products.length > 0 && (
                                    <span className="bg-brand-600/10 text-brand-600 dark:text-brand-500 text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                                        {t('items_count', { count: products.length, defaultValue: '{{count}} Items' })}
                                    </span>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleSearch} className="flex-1 flex flex-col sm:flex-row gap-2 md:gap-3">
                            <div className="flex-1 relative group">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder={t('search_placeholder')}
                                    className="w-full min-h-11 pl-4 pr-11 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 transition text-sm font-bold shadow-inner"
                                />
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-accent-500 group-focus-within:scale-110 transition-transform">
                                    <FiSearch size={18} className="stroke-[2.5]" />
                                </div>
                            </div>
                            <div className="flex gap-2 h-auto">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="flex-1 md:flex-none min-h-11 px-3 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 transition text-[9px] font-black uppercase tracking-widest min-w-[120px] appearance-none text-center shadow-inner"
                                >
                                    <option value="">{t('all_categories', 'ALL CATEGORIES')}</option>
                                    {categories.map((cat) => (
                                        <option key={cat.$id} value={cat.$id}>
                                            {cat.categoryName || cat.name || t('category', 'Category')}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="tap-target min-h-11 bg-brand-600 text-white px-5 md:px-8 py-3 rounded-2xl hover:bg-black transition shadow-lg shadow-brand-500/20 font-black text-[9px] uppercase tracking-widest active:scale-95"
                                >
                                    {t('search')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-6 md:py-8">
                <div className="mb-4 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.28em]">{t('browsing', 'Browsing')}</p>
                        <h2 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                            {query ? t('results_for_query', { query, defaultValue: 'Results for "{{query}}"' }) : t('all_available_products', 'All Available Products')}
                            {categoryIdFromUrl && <span className="ml-2 text-[9px] bg-brand-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black align-middle">{t('filtered', 'Filtered')}</span>}
                        </h2>
                    </div>
                    
                    {!loading && products.length > 0 && (
                        <>
                        <div className="hidden md:flex items-center gap-3">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                                    <FiFilter size={14} />
                                </div>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="min-h-11 pl-9 pr-8 py-2 bg-white dark:bg-gray-800 border-0 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 shadow-soft appearance-none focus:ring-2 focus:ring-brand-500 cursor-pointer min-w-[140px]"
                                >
                                    <option value="relevance">{t('sort_relevance', 'Sort: Relevance')}</option>
                                    <option value="price-asc">{t('sort_price_low_high', 'Price: Low to High')}</option>
                                    <option value="price-desc">{t('sort_price_high_low', 'Price: High to Low')}</option>
                                    <option value="name">{t('sort_name_az', 'Name: A to Z')}</option>
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                    <FiArrowLeft className="rotate-[270deg]" size={10} />
                                </div>
                            </div>
                            <div className="hidden md:block text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('found', 'Found')}</p>
                                <div className="flex items-center justify-end gap-2">
                                    <p className="text-sm font-bold text-brand-600 dark:text-brand-500">{t('items_count_lower', { count: products.length, defaultValue: '{{count}} items' })}</p>
                                    {refreshing && (
                                        <span className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-400">
                                            {t('updating', 'Updating')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="md:hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-2 shadow-sm">
                            <div className="flex items-center justify-between gap-2 px-1 pb-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-400">{t('sort', 'Sort')}</span>
                                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-brand-600/70 dark:text-brand-500/70">{t('items_count_lower', { count: products.length, defaultValue: '{{count}} items' })}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    ['relevance', t('relevance', 'Relevance')],
                                    ['price-asc', t('low_to_high', 'Low to High')],
                                    ['price-desc', t('high_to_low', 'High to Low')],
                                    ['name', t('a_to_z', 'A to Z')],
                                ].map(([value, label]) => {
                                    const active = sortBy === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setSortBy(value)}
                                            className={`tap-target min-h-11 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                                                active
                                                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                                                    : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        </>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {[...Array(6)].map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-soft p-8 sm:p-12 text-center border border-gray-100 dark:border-gray-700">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                            <FiSearch className="text-gray-400 text-3xl" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2 uppercase tracking-tight">
                            {t('no_results')}
                        </h2>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 font-medium">
                            {t('try_different_search')}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => navigate('/search')}
                                className="tap-target bg-brand-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-black transition-colors"
                            >
                                {t('clear_filters', 'Clear filters')}
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="tap-target bg-gray-100 text-gray-700 px-8 py-3 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-colors"
                            >
                                {t('go_back_home')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`transition-opacity duration-200 ${refreshing ? 'opacity-70' : 'opacity-100'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {products.map((product) => (
                                <ProductCard
                                    key={product.$id}
                                    product={product}
                                    prices={product.prices}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SearchResults;
