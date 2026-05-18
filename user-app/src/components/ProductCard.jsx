import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingBag, FiGlobe, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import useCurrencyStore from '../stores/currencyStore';
import useAuthStore from '../stores/authStore';
import ReportModal from '../components/ReportModal';
import CategoryIconLabel from '../components/CategoryIconLabel';

const ProductCard = ({ product, prices = [] }) => {
    const { t } = useTranslation();
    const { convert } = useCurrencyStore();
    const user = useAuthStore((state) => state.user);
    const [isReportOpen, setIsReportOpen] = useState(false);
    
    // Get the lowest price for this product
    const lowestPrice = prices.length > 0
        ? prices.reduce((min, p) => p.price < min.price ? p : min, prices[0])
        : null;

    // Use normalized data if available, otherwise fallback
    const categoryName = product.category || 
        (Array.isArray(product.categoryId)
            ? product.categoryId[0]?.categoryName
            : product.categoryId?.categoryName || 'Other');

    const imageUrl = product.imageUrl || product.image || product.image_url || product.image_front_url;
    const productKey = product.barcode || product.code || product.$id || product.id || '';
    const [imageFailed, setImageFailed] = useState(false);

    // Freshness indicator logic using actual updatedAt from the cheapest price or product
    const getFreshnessText = () => {
        const dateToUse = lowestPrice?.updatedAt || product.updatedAt || product.$createdAt;
        if (!dateToUse) return t('recently_updated', 'Recently updated');

        const parsed = new Date(dateToUse);
        if (Number.isNaN(parsed.getTime())) return t('recently_updated', 'Recently updated');

        const formatted = parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
        return `${t('updated', 'Updated')} ${formatted}`;
    };

    const freshnessText = getFreshnessText();

    return (
        <div className="relative group">
            <Link
                to={`/price-comparison/${productKey}`}
                className="group block bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-soft hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 overflow-hidden"
            >
                <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                {/* Product Image Wrapper */}
                <div className="relative w-[4.75rem] h-[4.75rem] sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gray-50 dark:bg-gray-900 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {imageUrl && !imageFailed ? (
                        <img
                            src={imageUrl}
                            alt={product.name}
                            className="w-[3.75rem] h-[3.75rem] sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain mix-blend-multiply dark:mix-blend-normal transform group-hover:scale-110 transition-transform duration-500"
                            onError={() => setImageFailed(true)}
                            loading="lazy"
                        />
                    ) : (
                        <FiPackage className="text-gray-300 text-2xl sm:text-3xl" />
                    )}

                    {/* Global Badge */}
                    {product.is_global && (
                        <div className="absolute top-1 right-1 bg-accent-500 text-white p-1 rounded-full shadow-lg z-10" title="Global Database">
                            <FiGlobe size={10} />
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0 flex flex-col h-full py-1">
                    <div className="mb-auto">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base md:text-lg truncate group-hover:text-brand-600 transition-colors leading-tight">
                                    {product.name}
                                </h3>
                                {product.is_global && (
                                    <span className="text-[10px] text-accent-500 font-bold uppercase tracking-tighter mt-0.5">Global DB</span>
                                )}
                            </div>
                            {user && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsReportOpen(true);
                                }}
                                className="tap-target shrink-0 flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-sm transition-all hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
                                title="Report Issue"
                                aria-label="Report issue"
                            >
                                <FiAlertTriangle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-1 mt-1.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                <CategoryIconLabel categoryId={product.categoryId} fallbackName={categoryName} />
                                {product.brand && (
                                    <>
                                        <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300 shrink-0" aria-hidden />
                                        <span className="text-xs text-gray-400 font-medium truncate max-w-[40%] sm:max-w-none">{product.brand}</span>
                                    </>
                                )}
                            </div>
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1 uppercase tracking-tight">
                                <FiClock size={10} /> {freshnessText}
                            </span>
                        </div>
                    </div>

                    {/* Footer / Price Section */}
                    <div className="flex items-end justify-between mt-3 sm:mt-4 gap-2">
                        {lowestPrice ? (
                            <div className="flex flex-col min-w-0">
                                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-0.5">{t('starting_from')}</span>
                                <div className="flex items-baseline gap-1">
                                        <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-none">
                                        {convert(lowestPrice.price, 'TRY')}
                                    </span>
                                    <span className="text-xs sm:text-sm font-medium text-gray-400">TRY</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs font-medium text-gray-400">
                                {t('price')} scanning...
                            </div>
                        )}
                        
                        {prices.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-brand-600 dark:text-brand-500 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-brand-100 dark:border-brand-800/30 shrink-0">
                                <FiShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span>{prices.length} {prices.length === 1 ? t('supermarket') : t('supermarket') + 's'}</span>
                            </div>
                        )}
                    </div>
                </div>
                </div>
            </Link>

            <ReportModal
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                targetName={product.name}
                targetType="product"
                targetId={product.$id || product.barcode || productKey}
            />
        </div>
    );
};

export default ProductCard;
