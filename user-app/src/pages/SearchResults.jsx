import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiFilter } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { fetchProducts, fetchPricesForProducts, searchProducts, fetchCategories, normalizeProduct } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/SkeletonLoaders';
import BackButton from '../components/BackButton';
import Navbar from '../components/Navbar';

const SearchResults = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const categoryIdFromUrl = searchParams.get('category') || '';

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);

    // Search form states
    const [searchInput, setSearchInput] = useState(query);
    const [selectedCategory, setSelectedCategory] = useState(categoryIdFromUrl);
    const [sortBy, setSortBy] = useState('relevance');

    useEffect(() => {
        loadInitialData();
    }, [query, categoryIdFromUrl, sortBy]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Fetch categories if not already fetched
            const [searchResults, allCategories] = await Promise.all([
                searchProducts(query, categoryIdFromUrl, 40, sortBy),
                categories.length === 0 ? fetchCategories() : Promise.resolve(categories)
            ]);

            // Now fetch prices ONLY for these products
            // Filter out global products as they won't have local IDs for batch price fetching
            const localProductIds = searchResults
                .filter(p => !p.is_global && p.$id)
                .map(p => p.$id);
            
            const batchPrices = localProductIds.length > 0 
                ? await fetchPricesForProducts(localProductIds)
                : [];

            // Normalize results
            let normalizedResults = searchResults.map(p => 
                normalizeProduct(p, batchPrices)
            );

            // Client-side price sorting (since prices are in a different collection)
            if (sortBy === 'price-asc') {
                normalizedResults.sort((a, b) => (a.cheapestPrice || Infinity) - (b.cheapestPrice || Infinity));
            } else if (sortBy === 'price-desc') {
                normalizedResults.sort((a, b) => (b.cheapestPrice || 0) - (a.cheapestPrice || 0));
            }

            setProducts(normalizedResults);
            if (categories.length === 0) setCategories(allCategories);

            // Sync local input with URL
            setSearchInput(query);
            setSelectedCategory(categoryIdFromUrl);
        } catch (error) {
            console.error('Data loading error:', error);
        }
        setLoading(false);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchInput.trim() || selectedCategory) {
            let url = `/search?q=${encodeURIComponent(searchInput.trim())}`;
            if (selectedCategory) {
                url += `&category=${encodeURIComponent(selectedCategory)}`;
            }
            navigate(url);
        }
    };


    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 md:pb-8">
            <Navbar />
            
            {/* Extended Header for Search Context */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 md:sticky md:top-16 z-30">
                <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                        <div className="flex items-center justify-between md:justify-start gap-4 flex-shrink-0">
                            <BackButton to="/" label="Back to Home" />
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                                {t('results')}
                            </h1>
                            <div className="md:hidden">
                                {products.length > 0 && (
                                    <span className="bg-brand-600/10 text-brand-600 dark:text-brand-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                                        {products.length} Items
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
                                    className="w-full pl-5 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 transition text-sm font-bold shadow-inner"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-accent-500 group-focus-within:scale-110 transition-transform">
                                    <FiSearch size={18} className="stroke-[2.5]" />
                                </div>
                            </div>
                            <div className="flex gap-2 h-auto">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="flex-1 md:flex-none px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 transition text-[10px] font-black uppercase tracking-widest min-w-[120px] appearance-none text-center shadow-inner"
                                >
                                    <option value="">ALL CATEGORIES</option>
                                    {categories.map((cat) => (
                                        <option key={cat.$id} value={cat.$id}>
                                            {cat.categoryName || cat.name || 'Category'}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="bg-brand-600 text-white px-6 md:px-8 py-3 rounded-xl hover:bg-black transition shadow-lg shadow-brand-500/20 font-black text-[10px] uppercase tracking-widest active:scale-95"
                                >
                                    {t('search')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-6 md:py-8">
                <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Browsing</p>
                        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                            {query ? `Results for "${query}"` : 'All Available Products'}
                            {categoryIdFromUrl && <span className="ml-3 text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Filtered</span>}
                        </h2>
                    </div>
                    
                    {!loading && products.length > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                                    <FiFilter size={14} />
                                </div>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-white dark:bg-gray-800 border-0 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 shadow-soft appearance-none focus:ring-2 focus:ring-brand-500 cursor-pointer min-w-[140px]"
                                >
                                    <option value="relevance">Sort: Relevance</option>
                                    <option value="price-asc">Price: Low to High</option>
                                    <option value="price-desc">Price: High to Low</option>
                                    <option value="name">Name: A to Z</option>
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                    <FiArrowLeft className="rotate-[270deg]" size={10} />
                                </div>
                            </div>
                            <div className="hidden md:block text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Found</p>
                                <p className="text-sm font-bold text-brand-600 dark:text-brand-500">{products.length} items</p>
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {[...Array(6)].map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <FiSearch className="text-gray-400 text-6xl mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 uppercase tracking-tight">
                            {t('no_results')}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
                            {t('try_different_search')}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => navigate('/search')}
                                className="bg-brand-600 text-white px-8 py-2 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-black transition-colors"
                            >
                                Clear filters
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="bg-gray-100 text-gray-700 px-8 py-2 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-colors"
                            >
                                {t('go_back_home')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
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
