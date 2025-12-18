import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiStar, FiPackage, FiArrowLeft } from 'react-icons/fi';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { Query } from 'appwrite';
import useAuthStore from '../stores/authStore';

const Favorites = () => {
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFavorites();
    }, []);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            // Fetch user's favorite products
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                [Query.limit(10)] // Adjust based on your favorites logic
            );
            setFavorites(response.documents);
        } catch (error) {
            console.error('Error fetching favorites:', error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <header className="bg-white dark:bg-gray-800 shadow p-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button onClick={() => navigate('/profile')} className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <FiArrowLeft /> Back
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiStar className="text-yellow-500" /> My Favorites
                    </h1>
                    <div className="w-16"></div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                {loading ? (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
                ) : favorites.length > 0 ? (
                    <div className="space-y-3">
                        {favorites.map((product) => (
                            <Link
                                key={product.$id}
                                to={`/price-comparison/${product.barcode}`}
                                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center gap-4 hover:shadow-lg transition"
                            >
                                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded" />
                                    ) : (
                                        <FiPackage className="text-gray-400 text-2xl" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-800 dark:text-white">{product.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{product.category}</p>
                                </div>
                                <FiStar className="text-yellow-500 text-2xl" />
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="flex justify-center mb-4">
                            <FiStar className="text-yellow-500 text-6xl" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">No favorites yet</p>
                        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
                            Start exploring products
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Favorites;
