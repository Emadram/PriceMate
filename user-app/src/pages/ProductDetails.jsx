import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useProductStore from '../stores/productStore';

const ProductDetails = () => {
    const { barcode } = useParams();
    const navigate = useNavigate();
    const { product, prices, loading, error, fetchProductByBarcode } = useProductStore();

    useEffect(() => {
        // Redirect to the new price comparison page
        navigate(`/price-comparison/${barcode}`);
    }, [barcode, navigate]);

    if (loading) return <div className="p-4 text-center">Loading product details...</div>;

    if (error) return (
        <div className="p-4 text-center">
            <div className="text-red-500 mb-4">{error}</div>
            <button
                onClick={() => navigate('/')}
                className="text-blue-600 underline"
            >
                Go Home
            </button>
        </div>
    );

    if (!product) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white shadow-sm">
                <div className="h-64 w-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-gray-400 text-4xl">📷</span>
                    )}
                </div>
                <div className="p-4">
                    <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
                    <p className="text-gray-500 text-sm mt-1">{product.category}</p>
                    <p className="text-gray-400 text-xs mt-2 font-mono">Barcode: {product.barcode}</p>
                </div>
            </div>

            <div className="p-4">
                <h2 className="text-lg font-semibold mb-3 text-gray-700">Price Comparison</h2>
                <div className="space-y-3">
                    {prices.length > 0 ? (
                        prices.map((price) => (
                            <div key={price.$id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                                <div>
                                    <h3 className="font-medium text-gray-800">
                                        {/* We need to fetch supermarket name, but for now showing ID or placeholder */}
                                        Supermarket {price.supermarket_id.substring(0, 5)}...
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {new Date(price.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-xl font-bold text-green-600">
                                    {price.price.toFixed(2)} {price.currency || 'TRY'}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-500 py-4 bg-white rounded-lg">
                            No prices found for this product yet.
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-2">
                <button
                    onClick={() => navigate('/')}
                    className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                    Back
                </button>
                <button
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-lg"
                >
                    Add Price
                </button>
            </div>
        </div>
    );
};

export default ProductDetails;
