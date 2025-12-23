import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiStar, FiArrowLeft } from 'react-icons/fi';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../lib/appwrite';
import { fetchAllPrices, getPricesForProduct } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import useFavoritesStore from '../stores/favoritesStore';

const Favorites = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const favorites = useFavoritesStore((state) => state.favorites);

    useEffect(() => {
        fetchFavorites();
    }, [favorites]);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            if (favorites.length === 0) {
                setProducts([]);
                setPrices([]);
                setLoading(false);
                return;
            }

            // Fetch favorite products AND their prices
            const [productsResponse, allPrices] = await Promise.all([
                databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.PRODUCTS,
                    [
                        Query.equal('$id', favorites),
                        Query.select(['*', 'categoryId.*'])
                    ]
                ),
                fetchAllPrices()
            ]);

            setProducts(productsResponse.documents);
            setPrices(allPrices);
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
                ) : products.length > 0 ? (
                    <div className="space-y-3">
                        {products.map((product) => (
                            <ProductCard
                                key={product.$id}
                                product={product}
                                prices={getPricesForProduct(prices, product.$id)}
                            />
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
