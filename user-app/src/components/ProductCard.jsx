import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingBag, FiTag, FiTrendingDown, FiNavigation, FiChevronRight } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import useCurrencyStore from '../stores/currencyStore';

const ProductCard = ({ product, prices = [] }) => {
    const { t } = useTranslation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
    
    // Get the lowest price for this product
    const lowestPrice = prices.length > 0
        ? prices.reduce((min, p) => p.price < min.price ? p : min, prices[0])
        : null;

    // Get category name
    const categoryName = Array.isArray(product.categoryId)
        ? product.categoryId[0]?.categoryName
        : product.categoryId?.categoryName || 'Uncategorized';

    return (
        <Link
            to={`/price-comparison/${product.barcode}`}
            className="group relative bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(8,112,184,0.1)] hover:-translate-y-1 transition-all duration-500 border border-gray-100 dark:border-gray-700/50 hover:border-blue-500/20 block overflow-hidden"
        >
            <div className="flex items-center gap-4">
                {/* Product Image Wrapper */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-50/50 dark:bg-gray-900/50 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-700/30 group-hover:scale-105 transition-transform duration-700 ease-out">
                    {product.imageUrl ? (
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-xl"
                        />
                    ) : (
                        <FiPackage className="text-gray-300 text-2xl" />
                    )}
                    
                    {/* Floating Badge for Price Drop (Simulated) */}
                    {lowestPrice && (
                        <div className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 uppercase tracking-tighter">
                            <FiTrendingDown size={8} /> -12%
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white text-[10px] sm:text-[11px] truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors leading-tight">
                                {product.name}
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:translate-x-1 transition-all flex-shrink-0 shadow-sm">
                                <FiChevronRight size={10} />
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[8px] bg-gray-100 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-black uppercase tracking-[0.1em] flex items-center gap-1 border border-gray-200/50 dark:border-gray-600/30">
                                <FiTag size={8} className="text-blue-500/70" /> {categoryName}
                            </span>
                        </div>
                    </div>

                    {/* Footer / Price Section */}
                    {lowestPrice ? (
                        <div className="flex items-end justify-between mt-3">
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-green-600 dark:text-green-400 uppercase tracking-[0.2em] mb-0.5">{t('starting_from')}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-black text-gray-900 dark:text-white leading-none tracking-tight">
                                        {convert(lowestPrice.price, 'TRY')}
                                    </span>
                                    <span className="text-[10px] font-black text-gray-400 mb-0.5">{getCurrencySymbol()}</span>
                                </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-1">
                                <span className="flex items-center gap-1 text-[8px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 px-2 py-1 rounded-xl border border-blue-100 dark:border-blue-800/30 shadow-sm uppercase tracking-wider">
                                    <FiShoppingBag size={8} className="mb-0.5" /> {prices.length} {prices.length === 1 ? t('supermarket') : t('supermarket') + 's'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 bg-gray-50/50 dark:bg-gray-900/30 border border-dashed border-gray-200 dark:border-gray-700/30 py-2 rounded-xl text-[8px] font-black text-gray-400 text-center uppercase tracking-[0.15em]">
                            {t('price')} scanning...
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default ProductCard;
