import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiDatabase, FiAlertTriangle } from 'react-icons/fi';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';
import { Query } from 'appwrite';

const DataInspector = () => {
    const navigate = useNavigate();
    const [prices, setPrices] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch prices with full data
            const pricesResponse = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRICES,
                [
                    Query.limit(10),
                    Query.select(['*', 'products.$id', 'products.name', 'supermarkets.$id', 'supermarkets.name'])
                ]
            );

            // Fetch products
            const productsResponse = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                [Query.limit(10)]
            );

            setPrices(pricesResponse.documents);
            setProducts(productsResponse.documents);

            console.log('Raw price data:', pricesResponse.documents);
            console.log('Products:', productsResponse.documents);
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <button
                onClick={() => navigate('/debug')}
                className="text-blue-600 mb-4 flex items-center gap-2"
            >
                <FiArrowLeft /> Back to Debug
            </button>

            <h1 className="text-2xl font-bold mb-4">Data Inspector</h1>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="space-y-6">
                    {/* Prices Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <FiDatabase /> Prices ({prices.length})
                        </h2>
                        {prices.length === 0 ? (
                            <p className="text-gray-500">No prices found</p>
                        ) : (
                            <div className="space-y-4">
                                {prices.map((price) => (
                                    <div key={price.$id} className="border rounded p-4">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><strong>Price:</strong> {price.price}</div>
                                            <div><strong>Currency:</strong> {price.currency || 'N/A'}</div>
                                            <div className="col-span-2">
                                                <strong>Product Link:</strong>{' '}
                                                {price.products ? (
                                                    <span className="text-green-600">
                                                        ✅ {typeof price.products === 'object' ? price.products.name || price.products.$id : price.products}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600">❌ NO PRODUCT LINK</span>
                                                )}
                                            </div>
                                            <div className="col-span-2">
                                                <strong>Supermarket Link:</strong>{' '}
                                                {price.supermarkets ? (
                                                    <span className="text-green-600">
                                                        ✅ {typeof price.supermarkets === 'object' ? price.supermarkets.name || price.supermarkets.$id : price.supermarkets}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600">❌ NO SUPERMARKET LINK</span>
                                                )}
                                            </div>
                                            <div className="col-span-2 mt-2">
                                                <details className="text-xs">
                                                    <summary className="cursor-pointer text-blue-600">View Raw Data</summary>
                                                    <pre className="bg-gray-100 dark:bg-gray-900 p-2 mt-2 overflow-auto">
                                                        {JSON.stringify(price, null, 2)}
                                                    </pre>
                                                </details>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Products Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-bold mb-4">Products ({products.length})</h2>
                        {products.map((product) => (
                            <div key={product.$id} className="border rounded p-3 mb-2">
                                <strong>{product.name}</strong> (ID: {product.$id})
                            </div>
                        ))}
                    </div>

                    {/* Issue Alert */}
                    {prices.some(p => !p.products || !p.supermarkets) && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-6">
                            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-2">
                                <FiAlertTriangle /> Issue Found!
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300 mb-4">
                                Some prices are missing product or supermarket relationships.
                            </p>
                            <div className="bg-white dark:bg-gray-800 rounded p-4">
                                <p className="font-bold mb-2">How to fix:</p>
                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                    <li>Go to Admin Panel: <code className="bg-gray-200 px-2 py-1 rounded">http://localhost:5174/prices</code></li>
                                    <li>Delete the broken price(s)</li>
                                    <li>Add new prices with BOTH product AND supermarket selected</li>
                                    <li>Return here to verify the fix</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataInspector;
