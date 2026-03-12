import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { FiSearch, FiCamera, FiTrendingUp, FiCpu } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import { fetchProducts, fetchAllPrices, getPricesForProduct, fetchCategories } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import AIChatBox from '../components/AIChatBox';

const Home = () => {
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch products, prices, and categories
            const [products, allPrices, allCategories] = await Promise.all([
                fetchProducts(6), // Get 6 featured products
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
                url += `&category=${encodeURIComponent(selectedCategory)}`;
            }
            navigate(url);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for products..."
                                className="w-full pl-6 pr-12 py-4 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition shadow-inner"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAIChatOpen(true)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-100 dark:border-blue-900/50"
                                    title="AI Shopping Assistant"
                                >
                                    <FiCpu size={20} />
                                </button>
                                <div className="text-gray-400">
                                    <FiSearch size={20} />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-4 py-4 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition shadow-inner min-w-[140px] cursor-pointer appearance-none"
                            >
                                <option value="">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat.$id} value={cat.$id}>
                                        {cat.categoryName}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition shadow-md font-bold flex-shrink-0"
                            >
                                Search
                            </button>
                        </div>
                    </form>
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

                <AIChatBox isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
            </main>
        </div>
    );
};

export default Home;
