import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import useProductStore from '../stores/productStore';
import AddPriceModal from '../components/AddPriceModal';
import BackButton from '../components/BackButton';
import { FiPackage } from 'react-icons/fi';
import { getAppwriteConfig } from '../lib/appwrite';

const { endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID } = getAppwriteConfig();
const PRODUCT_IMAGES_BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_PRODUCT_IMAGES || 'product-images';
const PRODUCT_PLACEHOLDER_ID = import.meta.env.VITE_APPWRITE_PRODUCT_PLACEHOLDER_ID || '';

const ProductDetails = () => {
    const { barcode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { product, loading, error, fetchProductByBarcode } = useProductStore();
    const [isAddPriceOpen, setIsAddPriceOpen] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        if (barcode) {
            fetchProductByBarcode(barcode);
        }
        
        // Only redirect to price comparison when we arrived from the scanner flow
        if (location.state?.fromScan) {
            navigate(`/price-comparison/${barcode}?fromScan=1`, { replace: true, state: { fromScan: true } });
        }
    }, [barcode, navigate, location.state, fetchProductByBarcode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 pb-safe">
                <div className="bg-white px-6 pt-10 pb-8 rounded-b-[3rem] shadow-sm mb-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-48 h-48 bg-gray-100 rounded-3xl mb-6 animate-pulse" />
                        <div className="h-6 w-52 bg-gray-100 rounded-full animate-pulse" />
                        <div className="h-4 w-32 bg-gray-100 rounded-full mt-3 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 pb-safe">
                <div className="bg-white px-6 pt-10 pb-8 rounded-b-[3rem] shadow-sm mb-6">
                    <div className="max-w-4xl mx-auto flex items-center">
                        <BackButton label="Go Back" className="-ml-2" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-3xl mb-6 flex items-center justify-center">
                            <FiPackage className="text-gray-300 text-4xl" />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 mb-2">
                            {error ? 'Could not load product' : 'Product not found'}
                        </h1>
                        <p className="text-gray-500 font-medium mb-6">
                            {error || 'Try searching again or scan the barcode.'}
                        </p>
                        <button
                            onClick={() => navigate('/scan')}
                            className="px-6 py-3 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                        >
                            Scan a product
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const fallbackImageUrl = PRODUCT_PLACEHOLDER_ID
        ? `${APPWRITE_ENDPOINT}/storage/buckets/${PRODUCT_IMAGES_BUCKET}/files/${PRODUCT_PLACEHOLDER_ID}/view?project=${APPWRITE_PROJECT_ID}`
        : '';
    const imageSrc = imageFailed ? '' : (product.imageUrl || product.image || fallbackImageUrl);

    return (
        <div className="min-h-screen bg-gray-50 pb-safe">
            {/* Header Info */}
            <div className="bg-white px-6 pt-10 pb-8 rounded-b-[3rem] shadow-sm mb-6">
                <div className="max-w-4xl mx-auto flex items-center">
                    <BackButton label="Go Back" className="-ml-2" />
                </div>
                <div className="flex flex-col items-center text-center">
                    <div className="w-48 h-48 bg-gray-50 rounded-3xl p-6 mb-6 flex items-center justify-center border border-gray-100">
                        {imageSrc ? (
                            <img 
                                src={imageSrc}
                                alt={product.name}
                                className="w-full h-full object-contain"
                                onError={() => setImageFailed(true)}
                                loading="lazy"
                            />
                        ) : (
                            <FiPackage className="text-gray-300 text-6xl" />
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 mb-2">{product.name}</h1>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-bold uppercase tracking-wider">
                            {product.brand || 'No Brand'}
                        </span>
                        <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-full text-xs font-medium uppercase tracking-wider">
                            {barcode}
                        </span>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-nav bg-white/80 backdrop-blur-md border-t border-gray-100 flex gap-3 z-50">
                <button
                    onClick={() => navigate(-1)}
                    className="px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={() => setIsAddPriceOpen(true)}
                    className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 active:scale-95 transition-all"
                >
                    Add Current Price
                </button>
            </div>

            <AddPriceModal 
                isOpen={isAddPriceOpen}
                onClose={() => setIsAddPriceOpen(false)}
                product={product}
            />
        </div>
    );
};

export default ProductDetails;
