import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingBag, FiTag } from 'react-icons/fi';

const ProductCard = ({ product, prices = [] }) => {
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
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden block"
        >
            <div className="p-4">
                <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {product.imageUrl ? (
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <FiPackage className="text-gray-400 text-2xl" />
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white text-lg mb-1 truncate">
                            {product.name}
                        </h3>

                        {/* Category */}
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <FiTag className="text-xs" />
                            <span className="truncate">{categoryName}</span>
                        </div>

                        {/* Price Section */}
                        {lowestPrice ? (
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">From</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {lowestPrice.price}
                                        </span>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {lowestPrice.currency || 'EGP'}
                                        </span>
                                    </div>
                                </div>
                                {prices.length > 1 && (
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                            <FiShoppingBag className="text-xs" />
                                            <span>{prices.length} stores</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded text-xs text-gray-600 dark:text-gray-400 text-center">
                                No prices available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default ProductCard;
