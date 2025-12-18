import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { FiSearch, FiCamera, FiTrendingUp } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import { fetchProducts, fetchAllPrices, getPricesForProduct, fetchCategories } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';

const Home = () => {
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [products, allPrices, allCategories] = await Promise.all([
                fetchProducts(6),
                fetchAllPrices(),
                fetchCategories()
            ]);

            setFeaturedProducts(products);
            setPrices(allPrices);
            setCategories(allCategories);
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim() || selectedCategory) {
            let url = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
            if (selectedCategory) {
                url += `&category=${selectedCategory}`;
            }
            navigate(url);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <form onSubmit={handleSearch} className="relative mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for products..."
                            className="w-full pl-6 pr-14 py-4 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition shadow-inner"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition shadow-md"
                            aria-label="Search"
                        >
                            <FiSearch size={20} />
                        </button>
                    </form>

                    {/* Category Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedCategory
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            All Categories
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.$id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.$id === selectedCategory ? null : cat.$id)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.$id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {cat.categoryName}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={() => navigate('/scan')}
                        className="bg-blue-600 rounded-2xl shadow-lg p-6 text-white hover:bg-blue-700 transition transform hover:scale-105"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                <FiCamera size={28} />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="text-xl font-bold">Scan Barcode</h3>
                                <p className="text-white/80 text-sm">Compare prices instantly</p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Featured Products */}
                <div className="mt-8">
                    <div className="flex items-center gap-2 mb-4">
                        <FiTrendingUp className="text-blue-600 dark:text-blue-400 text-xl" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                            Featured Products
                        </h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="text-gray-600 dark:text-gray-400">Loading products...</div>
                        </div>
                    ) : featuredProducts.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
                            <p className="text-gray-600 dark:text-gray-400">
                                No products available yet
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {featuredProducts.map((product) => (
                                <ProductCard
                                    key={product.$id}
                                    product={product}
                                    prices={getPricesForProduct(prices, product.$id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Home;
