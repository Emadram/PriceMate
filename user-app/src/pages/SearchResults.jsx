import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch } from 'react-icons/fi';
import { fetchProducts, fetchAllPrices, getPricesForProduct, searchProducts } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';

    const [products, setProducts] = useState([]);
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (query) {
            performSearch();
        }
    }, [query]);

    const performSearch = async () => {
        setLoading(true);
        try {
            console.log('Searching for:', query);

            // Use server-side search utility and fetch prices
            const [searchResults, allPrices] = await Promise.all([
                searchProducts(query),
                fetchAllPrices()
            ]);

            console.log('Products found:', searchResults.length);
            setProducts(searchResults);
            setPrices(allPrices);

        } catch (error) {
            console.error('Search error:', error);
        }
        setLoading(false);
    };


    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2 mb-3"
                    >
                        <FiArrowLeft /> Back to Home
                    </button>
                    <div className="flex items-center gap-3">
                        <FiSearch className="text-gray-400 text-xl" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                                Search Results
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                "{query}"
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="text-gray-600 dark:text-gray-400">Searching...</div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <FiSearch className="text-gray-400 text-6xl mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                            No products found
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Try searching with a different keyword
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                        >
                            Go Back Home
                        </button>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Found {products.length} {products.length === 1 ? 'product' : 'products'}
                        </p>
                        <div className="space-y-3">
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
