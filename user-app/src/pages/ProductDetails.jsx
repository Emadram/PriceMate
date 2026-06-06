import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import useProductStore from '../stores/productStore';
import BackButton from '../components/BackButton';
import RefreshControl from '../components/RefreshControl';
import { FiPackage, FiCamera } from 'react-icons/fi';
import { getAppwriteConfig } from '../lib/appwrite';
import { useTranslation } from 'react-i18next';
import { refreshPageCache } from '../utils/invalidateFreshData';

const { endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID } = getAppwriteConfig();
const PRODUCT_IMAGES_BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_PRODUCT_IMAGES || 'product-images';
const PRODUCT_PLACEHOLDER_ID = import.meta.env.VITE_APPWRITE_PRODUCT_PLACEHOLDER_ID || '';

const ProductDetails = () => {
    const { t } = useTranslation();
    const { barcode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { product, loading, error, fetchProductByBarcode } = useProductStore();
    const [imageFailed, setImageFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const tapFeedback = () => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
        }
    };

    useEffect(() => {
        if (location.state?.fromScan) {
            navigate(`/price-comparison/${barcode}?fromScan=1`, { replace: true, state: { fromScan: true } });
            return;
        }

        if (barcode) {
            fetchProductByBarcode(barcode);
        }
    }, [barcode, navigate, location.state, fetchProductByBarcode]);

    const handleRefresh = useCallback(async () => {
        if (!barcode) return;
        setRefreshing(true);
        try {
            refreshPageCache({
                priceScope: 'product',
                barcode,
                productId: product?.$id,
            });
            await fetchProductByBarcode(barcode, { force: true });
        } finally {
            setRefreshing(false);
        }
    }, [barcode, fetchProductByBarcode, product?.$id]);

    if (loading && !product) {
        return (
            <div className="min-h-screen bg-gray-50 pb-safe pt-safe">
                <RefreshControl onRefresh={handleRefresh} externalRefreshing={refreshing} />
                <div className="bg-white px-4 sm:px-6 pt-6 sm:pt-10 pb-6 sm:pb-8 rounded-b-[2.25rem] sm:rounded-b-[3rem] shadow-sm mb-5 sm:mb-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-36 h-36 sm:w-48 sm:h-48 bg-gray-100 rounded-3xl mb-5 sm:mb-6 animate-pulse" />
                        <div className="h-5 sm:h-6 w-44 sm:w-52 bg-gray-100 rounded-full animate-pulse" />
                        <div className="h-4 w-28 sm:w-32 bg-gray-100 rounded-full mt-3 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 pb-safe pt-safe">
                <RefreshControl onRefresh={handleRefresh} externalRefreshing={refreshing} />
                <div className="bg-white px-4 sm:px-6 pt-6 sm:pt-10 pb-6 sm:pb-8 rounded-b-[2.25rem] sm:rounded-b-[3rem] shadow-sm mb-5 sm:mb-6">
                    <div className="max-w-4xl mx-auto flex items-center">
                        <BackButton label={t('go_back', 'Go Back')} className="-ml-2" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-3xl mb-5 sm:mb-6 flex items-center justify-center">
                            <FiPackage className="text-gray-300 text-3xl sm:text-4xl" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">
                            {error ? t('failed_to_load_product') : t('product_not_found')}
                        </h1>
                        <p className="text-sm sm:text-base text-gray-500 font-medium mb-6">
                            {error || t('try_search_or_scan', 'Try searching again or scan the barcode.')}
                        </p>
                        <button
                            onClick={() => {
                                tapFeedback();
                                navigate('/scan');
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                        >
                            <FiCamera size={16} /> {t('scan_product', 'Scan a product')}
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
        <div className="min-h-screen bg-gray-50 pb-safe-nav pt-safe">
            <RefreshControl onRefresh={handleRefresh} externalRefreshing={refreshing || loading} />
            <div className="bg-white px-4 sm:px-6 pt-6 sm:pt-10 pb-6 sm:pb-8 rounded-b-[2.25rem] sm:rounded-b-[3rem] shadow-sm mb-5 sm:mb-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
                    <BackButton label={t('go_back', 'Go Back')} className="-ml-2" />
                    <RefreshControl
                        onRefresh={handleRefresh}
                        externalRefreshing={refreshing || loading}
                        enablePullToRefresh={false}
                        showDesktopButton
                    />
                </div>
                <div className="flex flex-col items-center text-center">
                    <div className="w-36 h-36 sm:w-48 sm:h-48 bg-gray-50 rounded-3xl p-5 sm:p-6 mb-5 sm:mb-6 flex items-center justify-center border border-gray-100">
                        {imageSrc ? (
                            <img 
                                src={imageSrc}
                                alt={product.name}
                                className="w-full h-full object-contain"
                                onError={() => setImageFailed(true)}
                                loading="lazy"
                            />
                        ) : (
                            <FiPackage className="text-gray-300 text-5xl sm:text-6xl" />
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 leading-tight px-2">{product.name}</h1>
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-4 px-2">
                        <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-bold uppercase tracking-wider">
                            {product.brand || t('no_brand', 'No Brand')}
                        </span>
                        <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-full text-xs font-medium uppercase tracking-wider">
                            {barcode}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            tapFeedback();
                            navigate(`/price-comparison/${barcode}`);
                        }}
                        className="mt-2 px-6 py-3 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 active:scale-95 transition-all"
                    >
                        {t('open_price_comparison')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
