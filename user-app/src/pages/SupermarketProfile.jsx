import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiShoppingBag, FiPackage, FiMapPin, FiPhone, FiMail, FiMessageSquare, FiStar, FiArrowLeft, FiGlobe, FiClock, FiHome, FiAlertTriangle, FiTrendingDown } from 'react-icons/fi';
import { fetchSupermarketById, fetchPricesBySupermarket } from '../utils/productUtils';
import ReportModal from '../components/ReportModal';
import useFavoritesStore from '../stores/favoritesStore';
import useAuthStore from '../stores/authStore';

const SupermarketProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [supermarket, setSupermarket] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const { isSupermarketFavorite, toggleSupermarketFavorite } = useFavoritesStore();
    const user = useAuthStore((state) => state.user);

    const handleFavoriteClick = () => {
        if (!user) {
            alert('Please login to favorite supermarkets');
            return;
        }
        toggleSupermarketFavorite(supermarket.$id);
    };

    const handleReportClick = () => {
        if (!user) {
            alert('Please login to report issues');
            return;
        }
        setIsReportModalOpen(true);
    };

    useEffect(() => {
        loadSupermarketData();
    }, [id]);

    const loadSupermarketData = async () => {
        setLoading(true);
        try {
            const supermarketData = await fetchSupermarketById(id);
            if (supermarketData) {
                setSupermarket(supermarketData);
                const productsData = await fetchPricesBySupermarket(id);
                setProducts(productsData);
            }
        } catch (error) {
            console.error('Error loading supermarket data:', error);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!supermarket) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex flex-col items-center justify-center">
                <FiShoppingBag className="text-gray-400 text-6xl mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Supermarket Not Found</h2>
                <button
                    onClick={() => navigate('/')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header Image / Banner */}
            <div className="h-64 relative overflow-hidden">
                {supermarket.bannerUrl ? (
                    <img
                        src={supermarket.bannerUrl}
                        alt={supermarket.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-blue-600"></div>
                )}
                <div className="absolute inset-0 bg-black/30"></div>
                <div className="absolute top-4 left-4 flex gap-3 z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-white/20 backdrop-blur-sm p-2 rounded-full text-white hover:bg-white/30 transition"
                        title="Go Back"
                    >
                        <FiArrowLeft size={24} />
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-white/20 backdrop-blur-sm p-2 rounded-full text-white hover:bg-white/30 transition"
                        title="Go Home"
                    >
                        <FiHome size={24} />
                    </button>
                </div>
            </div>

            {/* Profile Info */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        {/* Logo */}
                        <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 flex items-center justify-center flex-shrink-0 border border-gray-100 dark:border-gray-700">
                            {supermarket.icon || supermarket.logoUrl ? (
                                <img src={supermarket.icon || supermarket.logoUrl} alt={supermarket.name} className="w-full h-full object-contain" />
                            ) : (
                                <FiShoppingBag className="text-gray-400 text-5xl" />
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 w-full">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                                        {supermarket.name}
                                    </h1>
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                        <FiMapPin className="flex-shrink-0" />
                                        <span>{supermarket.address}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    {user && (
                                        <button
                                            onClick={handleFavoriteClick}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shadow-sm font-medium ${isSupermarketFavorite(supermarket.$id)
                                                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                        >
                                            <FiStar className={isSupermarketFavorite(supermarket.$id) ? 'fill-current' : ''} />
                                            {isSupermarketFavorite(supermarket.$id) ? 'Favorited' : 'Favorite'}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleReportClick}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition font-medium border border-red-200 dark:border-red-800"
                                    >
                                        <FiAlertTriangle /> Report
                                    </button>
                                </div>
                            </div>

                            {/* Stats & Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t dark:border-gray-700 pt-4">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Products</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{products.length}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Rating</p>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">4.8</span>
                                        <FiStar className="text-yellow-400 fill-current" />
                                    </div>
                                </div>
                                <div className="col-span-2 md:col-span-2 flex flex-col gap-1">
                                    {supermarket.phoneNumber && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <FiPhone className="text-blue-500" /> {supermarket.phoneNumber}
                                        </div>
                                    )}
                                    {supermarket.email && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <FiMail className="text-blue-500" /> {supermarket.email}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Products Section */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <FiPackage className="text-blue-600" /> Available Products
                    </h2>

                    {products.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                            <FiPackage className="text-gray-400 text-6xl mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Products Listed</h3>
                            <p className="text-gray-500 dark:text-gray-400">This supermarket hasn't listed any products yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {products.map((product) => (
                                <Link
                                    key={product.priceId}
                                    to={`/price-comparison/${product.barcode}?supermarketId=${supermarket.$id}`}
                                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col"
                                >
                                    <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm">
                                            {Array.isArray(product.categoryId) ? product.categoryId[0]?.categoryName : product.categoryId?.categoryName}
                                        </div>

                                        {product.isLowest && (
                                            <div className="absolute bottom-2 left-2 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-lg flex items-center gap-1">
                                                <FiTrendingDown className="text-sm" />
                                                Best Price
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate group-hover:text-blue-600 transition-colors">
                                            {product.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
                                            {product.description}
                                        </p>

                                        <div className="pt-3 border-t dark:border-gray-700">
                                            <div className="flex items-end justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Price at {supermarket.name}</span>
                                                    <span className={`text-xl font-bold leading-none ${product.isLowest ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                                        {product.price.toFixed(2)} <span className="text-sm font-normal text-gray-500">{product.currency}</span>
                                                    </span>
                                                </div>

                                                {/* Price Difference Indicator logic can stay or be removed based on preference, but for now we focus on the specific price */}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Report Modal */}
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                supermarketName={supermarket.name}
            />
        </div>
    );
};

export default SupermarketProfile;
