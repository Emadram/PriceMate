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
    const [supermarkets, setSupermarkets] = useState([]);
    const favorites = useFavoritesStore((state) => state.favorites); // Rename this if needed, or check store definition. Store has favoriteProducts and favoriteSupermarkets
    const { favoriteProducts, favoriteSupermarkets } = useFavoritesStore();

    useEffect(() => {
        fetchFavorites();
    }, [favoriteProducts, favoriteSupermarkets]);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            const promises = [];

            // Fetch Products if any
            if (favoriteProducts.length > 0) {
                promises.push(
                    databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.PRODUCTS,
                        [
                            Query.equal('$id', favoriteProducts),
                            Query.select(['*', 'categoryId.*'])
                        ]
                    ).then(res => res.documents)
                );
                promises.push(fetchAllPrices());
            } else {
                promises.push(Promise.resolve([])); // Products placeholder
                promises.push(Promise.resolve([])); // Prices placeholder
            }

            // Fetch Supermarkets if any
            if (favoriteSupermarkets.length > 0) {
                promises.push(
                    databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.SUPERMARKETS,
                        [Query.equal('$id', favoriteSupermarkets)]
                    ).then(res => res.documents)
                );
            } else {
                promises.push(Promise.resolve([]));
            }

            const [productsData, allPrices, supermarketsData] = await Promise.all(promises);

            setProducts(productsData);
            setPrices(allPrices);
            setSupermarkets(supermarketsData);

        } catch (error) {
            console.error('Error fetching favorites:', error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <header className="bg-white dark:bg-gray-800 shadow p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button onClick={() => navigate('/profile')} className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <FiArrowLeft /> Back
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiStar className="text-yellow-500" /> My Favorites
                    </h1>
                    <div className="w-16"></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 space-y-8">
                {loading ? (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
                ) : (
                    <>
                        {/* Favorite Supermarkets Section */}
                        {supermarkets.length > 0 && (
                            <section>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">🏪</span> Favorite Supermarkets
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {supermarkets.map((market) => (
                                        <Link
                                            key={market.$id}
                                            to={`/supermarket/${market.$id}`}
                                            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm hover:shadow-md transition flex items-center gap-4 border border-gray-100 dark:border-gray-700"
                                        >
                                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-4xl">
                                                {market.logoUrl ? <img src={market.logoUrl} className="w-full h-full object-contain" alt={market.name} /> : '🛒'}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white">{market.name}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{market.address}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Favorite Products Section */}
                        {products.length > 0 && (
                            <section>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">📦</span> Favorite Products
                                </h2>
                                <div className="space-y-3">
                                    {products.map((product) => (
                                        <ProductCard
                                            key={product.$id}
                                            product={product}
                                            prices={getPricesForProduct(prices, product.$id)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {products.length === 0 && supermarkets.length === 0 && (
                            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                                <div className="flex justify-center mb-4">
                                    <FiStar className="text-yellow-500 text-6xl" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400">No favorites yet</p>
                                <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
                                    Start exploring
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default Favorites;
