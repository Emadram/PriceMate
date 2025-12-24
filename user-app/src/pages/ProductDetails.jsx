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

    // ... (keep existing loading/error/null checks)

    // ... (render existing components)

    // Add this updated bottom bar and modal
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* ... (keep existing product details structure) ... */}

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
