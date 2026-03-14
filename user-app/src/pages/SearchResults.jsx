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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => navigate('/')}
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded-full text-gray-700 dark:text-gray-200 shadow-sm transition-all"
                                title="Back to Home"
                            >
                                <FiArrowLeft size={16} />
                            </button>
                            <h1 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-gray-800 dark:text-white whitespace-nowrap hidden sm:block">
                                {t('results')}
                            </h1>
                        </div>

                        <form onSubmit={handleSearch} className="flex-1 flex flex-col sm:flex-row gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder={t('search_placeholder')}
                                    className="w-full pl-4 pr-10 py-1.5 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition text-[11px] font-bold"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <FiSearch size={14} />
                                </div>
                            </div>
                            <div className="flex gap-2 h-[34px]">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="px-3 py-1 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition text-[10px] font-black uppercase tracking-widest min-w-[100px] appearance-none"
                                >
                                    <option value="">{t('categories')}</option>
                                    {categories.map((cat) => (
                                        <option key={cat.$id} value={cat.$id}>
                                            {cat.categoryName}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-5 py-1 rounded-xl hover:bg-black transition shadow-sm font-black text-[10px] uppercase tracking-widest"
                                >
                                    {t('search')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Current Search: <span className="text-blue-600 dark:text-blue-400 font-medium">{query ? `"${query}"` : 'All Products'}</span>
                            {categoryIdFromUrl && <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">Filtered by Category</span>}
                        </p>
                    </div>
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
