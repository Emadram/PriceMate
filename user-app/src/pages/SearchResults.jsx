import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { fetchProducts, fetchAllPrices, getPricesForProduct, searchProducts, fetchCategories } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';

const SearchResults = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const categoryIdFromUrl = searchParams.get('category') || '';

    const [products, setProducts] = useState([]);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);

    // Search form states
    const [searchInput, setSearchInput] = useState(query);
    const [selectedCategory, setSelectedCategory] = useState(categoryIdFromUrl);

    useEffect(() => {
        loadInitialData();
    }, [query, categoryIdFromUrl]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Fetch categories if not already fetched
            const [searchResults, allPrices, allCategories] = await Promise.all([
                searchProducts(query, categoryIdFromUrl),
                fetchAllPrices(),
                categories.length === 0 ? fetchCategories() : Promise.resolve(categories)
            ]);

            setProducts(searchResults);
            setPrices(allPrices);
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
                            <button
                                onClick={() => navigate('/')}
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2.5 rounded-xl text-gray-700 dark:text-gray-200 shadow-sm transition-all active:scale-95"
                                title="Back to Home"
                            >
                                <FiArrowLeft size={18} />
                            </button>
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                                {t('results')}
                            </h1>
                            <div className="md:hidden">
                                {products.length > 0 && (
                                    <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
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
                                    className="w-full pl-5 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition text-sm font-bold shadow-inner"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 group-focus-within:scale-110 transition-transform">
                                    <FiSearch size={18} className="stroke-[2.5]" />
                                </div>
                            </div>
                            <div className="flex gap-2 h-auto">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="flex-1 md:flex-none px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition text-[10px] font-black uppercase tracking-widest min-w-[120px] appearance-none text-center shadow-inner"
                                >
                                    <option value="">ALL CATEGORIES</option>
                                    {categories.map((cat) => (
                                        <option key={cat.$id} value={cat.$id}>
                                            {cat.categoryName}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-xl hover:bg-black transition shadow-lg shadow-blue-500/20 font-black text-[10px] uppercase tracking-widest active:scale-95"
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
                            {categoryIdFromUrl && <span className="ml-3 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Filtered</span>}
                        </h2>
                    </div>
                    {!loading && products.length > 0 && (
                        <div className="hidden md:block text-right">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Found</p>
                             <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{products.length} items matched</p>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <div className="text-gray-600 dark:text-gray-400">Refreshing results...</div>
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
                        <button
                            onClick={() => navigate('/')}
                            className="bg-blue-600 text-white px-8 py-2 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-black transition-colors"
                        >
                            {t('go_back_home')}
                        </button>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Found {products.length} {products.length === 1 ? 'product' : 'products'}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {products.map((product) => (
                                <ProductCard
                                    key={product.$id}
                                    product={product}
                                    prices={getPricesForProduct(prices, product.$id)}
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
