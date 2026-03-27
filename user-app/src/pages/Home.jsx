import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import { FiSearch, FiCamera, FiTrendingUp, FiCpu, FiChevronRight, FiPackage } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import { fetchProducts, fetchAllPrices, getPricesForProduct, fetchCategories } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import AIChatBox from '../components/AIChatBox';

const Home = () => {
    const { t } = useTranslation();
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
                fetchProducts(12), // Get 12 featured products
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-10">
                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl md:rounded-[2rem] blur opacity-10 md:opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] shadow-xl md:shadow-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700">
                        <form onSubmit={handleSearch} className="flex flex-col gap-3 md:gap-4">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search_placeholder')}
                                    className="w-full pl-12 md:pl-14 pr-12 py-4 md:py-5 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl md:rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition shadow-inner font-bold text-sm md:text-base"
                                />
                                <div className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-blue-500">
                                    <FiSearch size={20} className="md:size-[22px] stroke-[2.5]" />
                                </div>
                                <div className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAIChatOpen(true)}
                                        className="p-2 md:p-2.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg md:rounded-xl transition-all border border-indigo-100 dark:border-indigo-900/50 shadow-sm hover:scale-105 active:scale-95"
                                        title="AI Shopping Assistant"
                                    >
                                        <FiCpu size={18} className="md:size-[20px] stroke-[2]" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-row gap-2 h-auto">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="flex-1 md:flex-none px-3 md:px-6 py-3 md:py-4 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl md:rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition shadow-inner font-black uppercase tracking-widest text-[9px] md:text-[10px] cursor-pointer appearance-none md:min-w-[160px] text-center"
                                >
                                    <option value="">Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.$id} value={cat.$id}>
                                            {cat.categoryName}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl transition-all duration-300 shadow-[0_10px_20px_rgba(37,99,235,0.2)] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-[9px] md:text-[10px] flex-shrink-0 active:scale-95"
                                >
                                    {t('search')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Quick Actions - Mobile Optimized */}
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    <button
                        onClick={() => navigate('/scan')}
                        className="group relative bg-black dark:bg-blue-600 rounded-3xl md:rounded-[2.5rem] shadow-xl md:shadow-2xl p-0.5 md:p-1 overflow-hidden transition-transform active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="relative flex items-center gap-4 md:gap-6 p-5 md:p-8 rounded-[1.8rem] md:rounded-[2.4rem]">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl group-hover:rotate-6 transition-transform duration-500">
                                <FiCamera size={24} className="md:size-[32px] text-white" />
                            </div>
                            <div className="text-left flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/20 text-white text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{t('instant')}</span>
                                </div>
                                <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight leading-tight">{t('scan_barcode')}</h3>
                                <p className="text-white/60 text-[10px] md:text-sm font-bold mt-0.5 md:mt-1 uppercase tracking-widest">{t('compare_live_prices')}</p>
                            </div>
                            <div className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 group-hover:duration-500">
                                <FiChevronRight size={28} className="md:size-[32px] text-white" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Featured Products */}
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                                    <FiTrendingUp className="text-white" />
                                </div>
                                {t('trends')}
                            </h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">{t('personalized_deals')}</p>
                        </div>
                        <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                            {t('view_all')}
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2, 4].map(i => (
                                <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-[2rem] animate-pulse"></div>
                            ))}
                        </div>
                    ) : featuredProducts.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl p-16 text-center border-2 border-dashed border-gray-100 dark:border-gray-700">
                            <FiPackage size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-400 font-black uppercase tracking-widest">{t('no_products')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
