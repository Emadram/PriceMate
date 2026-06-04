import { useCallback, useEffect, useState } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiEdit2, FiX, FiSearch, FiFilter, FiArrowLeft, FiShoppingBag } from 'react-icons/fi';
import SortIcon from '../components/SortIcon';
import usePricesStore from '../stores/pricesStore';
import useProductsStore from '../stores/productsStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import useAdminAuthStore from '../stores/adminAuthStore';
import Sidebar from '../components/Sidebar';
import { DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import useDebouncedRealtimeRefresh from '../hooks/useDebouncedRealtimeRefresh';

const Prices = () => {
    const { 
        prices, 
        loading, 
        total, 
        page, 
        limit, 
        fetchPrices, 
        addPrice, 
        updatePrice, 
        deletePrice 
    } = usePricesStore();
    const { productOptions, fetchProductOptions } = useProductsStore();
    const catalogProducts = productOptions;
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();
    const adminUser = useAdminAuthStore((state) => state.user);

    const [showModal, setShowModal] = useState(false);
    const [editingPrice, setEditingPrice] = useState(null);
    const [formData, setFormData] = useState({
        price: '',
        currency: 'TRY',
        products: '',
        supermarkets: '',
        stockStatus: 'in_stock',
        userId: ''
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterProduct, setFilterProduct] = useState('');
    const [filterSupermarket, setFilterSupermarket] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [lastUpdated, setLastUpdated] = useState(null);
    const isFresh = useFreshIndicator(lastUpdated);

    const refreshData = useCallback(async () => {
        await Promise.all([
            fetchPrices(page),
            fetchProductOptions(),
            fetchSupermarkets(),
        ]);
        setLastUpdated(new Date().toISOString());
    }, [fetchPrices, fetchProductOptions, fetchSupermarkets, page]);

    const refreshPricesOnly = useCallback(async () => {
        await fetchPrices(page);
        setLastUpdated(new Date().toISOString());
    }, [fetchPrices, page]);

    const refreshReferenceData = useCallback(async () => {
        await Promise.all([fetchProductOptions(), fetchSupermarkets()]);
    }, [fetchProductOptions, fetchSupermarkets]);

    useEffect(() => {
        const t = setTimeout(() => refreshData(), 0);
        return () => clearTimeout(t);
    }, [refreshData]);

    // `isFresh` indicator handled by useFreshIndicator to avoid rapid flicker

    useDebouncedRealtimeRefresh(
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRICES}.documents`,
        refreshPricesOnly
    );
    useDebouncedRealtimeRefresh(
        [
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRODUCTS}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.SUPERMARKETS}.documents`,
        ],
        refreshReferenceData
    );

    const handlePageChange = (newPage) => {
        fetchPrices(newPage);
        setLastUpdated(new Date().toISOString());
    };

    useEffect(() => {
        if (adminUser) {
            const t = setTimeout(() => setFormData(prev => ({ ...prev, userId: adminUser.$id })), 0);
            return () => clearTimeout(t);
        }
    }, [adminUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = editingPrice
            ? await updatePrice(editingPrice.$id, formData)
            : await addPrice(formData);

        if (success) {
            setShowModal(false);
            setEditingPrice(null);
            setFormData({
                price: '',
                currency: 'TRY',
                products: '',
                supermarkets: '',
                stockStatus: 'in_stock',
                userId: adminUser?.$id || ''
            });
        } else {
            alert('Failed to add price. Check console for details.');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this price?')) {
            await deletePrice(id);
        }
    };

    const handleEdit = (price) => {
        const productId = price.products && typeof price.products === 'object' ? price.products.$id : '';
        const supermarketId = price.supermarkets && typeof price.supermarkets === 'object' ? price.supermarkets.$id : '';
        const displayCurrency = price.currency === 'TL' ? 'TRY' : (price.currency || 'TRY');

        setEditingPrice(price);
        setFormData({
            price: price.price ?? '',
            currency: displayCurrency,
            products: productId,
            supermarkets: supermarketId,
            stockStatus: price.stockStatus || 'in_stock',
            userId: adminUser?.$id || price.userId || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingPrice(null);
        setFormData({
            price: '',
            currency: 'TRY',
            products: '',
            supermarkets: '',
            stockStatus: 'in_stock',
            userId: adminUser?.$id || ''
        });
    };

    const formatCurrencyLabel = (value) => {
        if (!value) return 'TRY';
        return value === 'TL' ? 'TRY' : value;
    };

    const getProductName = (price) => {
        if (price.products && typeof price.products === 'object') {
            return price.products.name || 'Unknown Product';
        }
        return 'Unknown Product';
    };

    const getSupermarketName = (price) => {
        if (price.supermarkets && typeof price.supermarkets === 'object') {
            return price.supermarkets.name || 'Unknown Store';
        }
        return 'Unknown Store';
    };

    const filteredPricesBySearch = prices.filter(price => {
        const searchLower = searchTerm.toLowerCase();
        return (
            getProductName(price).toLowerCase().includes(searchLower) ||
            getSupermarketName(price).toLowerCase().includes(searchLower) ||
            price.price?.toString().includes(searchLower) ||
            price.stockStatus?.toLowerCase().includes(searchLower)
        );
    });

    const filteredPrices = filteredPricesBySearch.filter(price => {
        const matchesProduct = filterProduct ? (price.products?.$id === filterProduct) : true;
        const matchesSupermarket = filterSupermarket ? (price.supermarkets?.$id === filterSupermarket) : true;
        return matchesProduct && matchesSupermarket;
    });

    const sortedPrices = [...filteredPrices];
    if (sortConfig.key) {
        sortedPrices.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'product') {
                aValue = getProductName(a);
                bValue = getProductName(b);
            } else if (sortConfig.key === 'supermarket') {
                aValue = getSupermarketName(a);
                bValue = getSupermarketName(b);
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // SortIcon hoisted to ../components/SortIcon

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <div className="flex-1 overflow-x-hidden flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Prices / Stock</h1>
                        <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live
                        </span>
                        <span className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest transition-colors ${isFresh ? 'text-green-600' : 'text-gray-400'}`}>
                            Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </span>
                        <div className="relative group max-w-md w-full ml-4 hidden md:block">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-300 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by product, store or tag..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-brand-600/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                    >
                        <FiPlus size={20} className="stroke-[3]" />
                        <span className="hidden sm:inline">Add Valuation</span>
                    </button>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                    <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-100 dark:border-gray-700 p-8 rounded-[2.5rem] shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                                <FiFilter className="text-brand-600 dark:text-brand-300" />
                                Asset Selection
                            </label>
                            <div className="relative group">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-300 transition-colors z-10" />
                                <select
                                    value={filterProduct}
                                    onChange={(e) => setFilterProduct(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer hover:bg-white dark:hover:bg-gray-900"
                                >
                                    <option value="">All products</option>
                                    {catalogProducts.map(p => (
                                        <option key={p.$id} value={p.$id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                                <FiShoppingBag className="text-brand-600 dark:text-brand-300" />
                                Marketplace Node
                            </label>
                            <div className="relative group">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-300 transition-colors z-10" />
                                <select
                                    value={filterSupermarket}
                                    onChange={(e) => setFilterSupermarket(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer hover:bg-white dark:hover:bg-gray-900"
                                >
                                    <option value="">All Market Nodes</option>
                                    {supermarkets.map(s => (
                                        <option key={s.$id} value={s.$id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Syncing Price Matrix...</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                        <tr>
                                            <th
                                                className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                                                onClick={() => requestSort('product')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Product <SortIcon columnKey="product" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                                </div>
                                            </th>
                                            <th
                                                className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                                                onClick={() => requestSort('supermarket')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Store Node <SortIcon columnKey="supermarket" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                                </div>
                                            </th>
                                            <th
                                                className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                                                onClick={() => requestSort('price')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Last Trade <SortIcon columnKey="price" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                                </div>
                                            </th>
                                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em]">Provenance</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em]">Status</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {sortedPrices.map((price) => (
                                            <tr key={price.$id} className="hover:bg-brand-50/40 dark:hover:bg-brand-900/10 transition-colors group">
                                                <td className="px-8 py-6 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{getProductName(price)}</span>
                                                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Asset Reference</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-widest">
                                                    <div className="flex items-center gap-2">
                                                        <FiShoppingBag className="text-brand-600 dark:text-brand-300 opacity-50" />
                                                        {getSupermarketName(price)}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap">
                                                    <div className="text-base font-black text-green-600 dark:text-green-400">
                                                        {price.price} <span className="text-[10px] font-black opacity-70 uppercase tracking-widest ml-1">{formatCurrencyLabel(price.currency)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap">
                                                    <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
                                                        {new Date(price.$updatedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap">
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                        price.stockStatus === 'in_stock' 
                                                            ? 'bg-green-100/50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800'
                                                            : price.stockStatus === 'low_stock'
                                                            ? 'bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                                                            : 'bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800'
                                                    }`}>
                                                        {price.stockStatus?.replace('_', ' ') || 'unknown'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEdit(price)}
                                                            className="p-3 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-brand-100 dark:hover:border-brand-800/50"
                                                        >
                                                            <FiEdit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(price.$id)}
                                                            className="p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-red-100 dark:hover:border-red-800/50"
                                                        >
                                                            <FiTrash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!loading && total > 0 && (
                        <div className="flex items-center justify-between mt-8 px-8">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                Page {page} of {Math.ceil(total / limit)} ({total} total)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 1}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        page === 1 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-brand-600 hover:text-white shadow-sm border border-gray-100 dark:border-gray-700'
                                    }`}
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page * limit >= total}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        page * limit >= total 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-brand-600 hover:text-white shadow-sm border border-gray-100 dark:border-gray-700'
                                    }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                                {editingPrice ? 'Sync Valuation' : 'New Valuation Node'}
                            </h2>
                            <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl">
                                <FiX size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Asset Reference</label>
                                <select
                                    value={formData.products}
                                    onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">Select Asset</option>
                                    {catalogProducts.map((product) => (
                                        <option key={product.$id} value={product.$id}>
                                            {product.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Marketplace Node</label>
                                <select
                                    value={formData.supermarkets}
                                    onChange={(e) => setFormData({ ...formData, supermarkets: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">Select Store</option>
                                    {supermarkets.map((sm) => (
                                        <option key={sm.$id} value={sm.$id}>
                                            {sm.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unit Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Currency</label>
                                    <input
                                        type="text"
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all text-center uppercase"
                                        placeholder="TRY"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock status</label>
                                <select
                                    value={formData.stockStatus || 'in_stock'}
                                    onChange={(e) => setFormData({ ...formData, stockStatus: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer uppercase tracking-widest"
                                >
                                    <option value="in_stock">In Stock / High Availability</option>
                                    <option value="low_stock">Low Stock / Warning</option>
                                    <option value="out_of_stock">None / Critical</option>
                                </select>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-brand-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20 active:scale-95"
                                >
                                    {editingPrice ? 'Commit Sync' : 'Initialize Node'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Prices;
