import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiStar, FiShoppingBag, FiPackage, FiChevronRight, FiHeart, FiClock } from 'react-icons/fi';
import { db, Query } from '../lib/appwrite';
import { fetchAllPrices, normalizeProduct } from '../utils/productUtils';
import ProductCard from '../components/ProductCard';
import useFavoritesStore from '../stores/favoritesStore';
import BackButton from '../components/BackButton';
import { ProductCardSkeleton } from '../components/SkeletonLoaders';

const Favorites = () => {
    const location = useLocation();
    const [products, setProducts] = useState([]);
    const [supermarkets, setSupermarkets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('products');
    const { favoriteProducts, favoriteSupermarkets } = useFavoritesStore();

    const fetchFavorites = useCallback(async () => {
        setLoading(true);
        try {
            const promises = [];

            if (favoriteProducts && favoriteProducts.length > 0) {
                promises.push(
                    db.products
                        .list([
                            Query.equal('$id', favoriteProducts),
                            Query.select(['*', 'categoryId.*']),
                        ])
                        .then((res) => res.documents)
                );
                promises.push(fetchAllPrices());
            } else {
                promises.push(Promise.resolve([]));
                promises.push(Promise.resolve([]));
            }

            if (favoriteSupermarkets && favoriteSupermarkets.length > 0) {
                promises.push(
                    db.supermarkets
                        .list([Query.equal('$id', favoriteSupermarkets)])
                        .then((res) => res.documents)
                );
            } else {
                promises.push(Promise.resolve([]));
            }

            const [productsData, allPrices, supermarketsData] = await Promise.all(promises);

            const normalizedProducts = productsData.map((p) => normalizeProduct(p, allPrices));

            setProducts(normalizedProducts);
            setSupermarkets(supermarketsData);
        } catch (error) {
            console.error('Error fetching favorites:', error);
        }
        setLoading(false);
    }, [favoriteProducts, favoriteSupermarkets]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchFavorites();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [fetchFavorites]);

    const productCount = favoriteProducts?.length ?? 0;
    const marketCount = favoriteSupermarkets?.length ?? 0;
    const hasAny = productCount > 0 || marketCount > 0;
    const totalCount = productCount + marketCount;

    const backTarget = (location.state && location.state.from && location.state.from !== '/favorites')
        ? location.state.from
        : '/';

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black transition-colors pb-safe">
            <header className="pt-safe bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-white/5 px-3 sm:px-4 py-3 sm:py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                    <BackButton to={backTarget} />
                    <h1 className="text-base sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 min-w-0">
                        <FiStar className="text-yellow-500 shrink-0" />
                        <span className="truncate">Favorites</span>
                    </h1>
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-400">
                        <FiClock size={10} /> {totalCount}
                    </span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-3 sm:p-6 space-y-5 sm:space-y-8">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : !hasAny ? (
                    <div className="text-center py-16 sm:py-24 bg-white dark:bg-[#121214] rounded-[2rem] sm:rounded-[3rem] shadow-soft border border-gray-100/50 dark:border-white/5 px-5">
                        <div className="flex justify-center mb-5 sm:mb-6">
                            <div className="p-5 sm:p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-[2rem] sm:rounded-[2.5rem]">
                                <FiStar size={42} className="text-yellow-500" />
                            </div>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-2">No Favorites Yet</h3>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-8 font-medium">
                            Save products and stores to quickly compare prices later.
                        </p>
                        <Link
                            to="/"
                            className="tap-target inline-flex items-center justify-center px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-black/10 dark:shadow-white/5"
                        >
                            Start Exploring
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4.6rem)] md:static z-40 -mx-1 px-1">
                            <div className="flex p-1 rounded-2xl bg-gray-200/60 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={() => setActiveTab('products')}
                                className={`tap-target min-h-11 flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                                    activeTab === 'products'
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                            >
                                <FiPackage className={activeTab === 'products' ? 'text-red-500' : ''} size={16} />
                                Products
                                <span
                                    className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] ${
                                        activeTab === 'products'
                                            ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                    }`}
                                >
                                    {productCount}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('supermarkets')}
                                className={`tap-target min-h-11 flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                                    activeTab === 'supermarkets'
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                            >
                                <FiShoppingBag className={activeTab === 'supermarkets' ? 'text-brand-600 dark:text-brand-500' : ''} size={16} />
                                Supermarkets
                                <span
                                    className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] ${
                                        activeTab === 'supermarkets'
                                            ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-500'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                    }`}
                                >
                                    {marketCount}
                                </span>
                            </button>
                            </div>
                        </div>

                        <div className="md:hidden flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 px-4 py-3 shadow-sm">
                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-400">Saved</p>
                                <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {activeTab === 'products' ? 'Products' : 'Supermarkets'}
                                </p>
                            </div>
                            <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-gray-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                {activeTab === 'products' ? productCount : marketCount}
                            </div>
                        </div>

                        {activeTab === 'products' &&
                            (products.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-8 px-0 sm:px-1">
                                    {products.map((product) => (
                                        <ProductCard key={product.$id} product={product} prices={product.prices} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-14 bg-white dark:bg-[#121214] rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-white/10 px-5">
                                    <FiPackage className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={40} />
                                    <p className="font-bold text-gray-900 dark:text-white mb-1">No saved products</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Heart a product on its price comparison page.</p>
                                    <Link
                                        to="/"
                                        className="tap-target inline-flex items-center justify-center px-3 py-2 rounded-full text-sm font-black text-brand-600 dark:text-brand-500 uppercase tracking-widest"
                                    >
                                        Browse products
                                    </Link>
                                </div>
                            ))}

                        {activeTab === 'supermarkets' &&
                            (supermarkets.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 px-0 sm:px-1">
                                    {supermarkets.map((market) => (
                                        <Link
                                            key={market.$id}
                                            to={`/supermarket/${market.$id}`}
                                            className="group bg-white dark:bg-[#121214] p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-soft hover:shadow-soft-lg transition-all border border-gray-100/50 dark:border-white/5 active:scale-[0.98] flex items-center gap-2.5 sm:gap-4"
                                        >
                                            <div className="w-12 h-12 sm:w-16 sm:h-20 md:w-20 md:h-20 bg-gray-50 dark:bg-[#1C1C1E] rounded-2xl sm:rounded-3xl flex items-center justify-center overflow-hidden p-2 sm:p-3 group-hover:scale-105 transition-transform shrink-0">
                                                {market.icon || market.logoUrl ? (
                                                    <img
                                                        src={market.icon || market.logoUrl}
                                                        className="w-full h-full object-contain"
                                                        alt={market.name}
                                                    />
                                                ) : (
                                                    <FiShoppingBag className="text-gray-400 text-xl sm:text-2xl" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white text-[13px] sm:text-base md:text-lg truncate mb-0.5 sm:mb-1">{market.name}</h3>
                                                <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 truncate">{market.address}</p>
                                                <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
                                                    <span className="text-[9px] sm:text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                                                        Open
                                                    </span>
                                                </div>
                                            </div>
                                            <FiChevronRight className="text-gray-300 group-hover:translate-x-1 transition-transform shrink-0 text-sm sm:text-base" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-white dark:bg-[#121214] rounded-[2.5rem] border border-gray-100 dark:border-white/10">
                                    <FiShoppingBag className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={40} />
                                    <p className="font-bold text-gray-900 dark:text-white mb-1">No saved stores</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        Save a supermarket from its profile page.
                                    </p>
                                    <Link
                                        to="/"
                                        className="text-sm font-black text-brand-600 dark:text-brand-500 uppercase tracking-widest"
                                    >
                                        Find stores
                                    </Link>
                                </div>
                            ))}
                    </>
                )}
            </main>
        </div>
    );
};

export default Favorites;
