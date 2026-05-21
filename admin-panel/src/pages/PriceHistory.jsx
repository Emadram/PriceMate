import { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiClock, FiRefreshCw } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import usePriceHistoryStore from '../stores/priceHistoryStore';
import useProductsStore from '../stores/productsStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import { client, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';

const PriceHistory = () => {
    const { history, loading, fetchHistory, addHistory, updateHistory, deleteHistory, syncFromPrices } = usePriceHistoryStore();
    const { products, fetchProducts } = useProductsStore();
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isFresh, setIsFresh] = useState(false);

    const [formData, setFormData] = useState({
        priceId: '',
        price: '',
        productId: '',
        supermarketId: '',
        timestamp: new Date().toISOString().slice(0, 16),
        isPromotional: false,
        priceChangeReason: ''
    });

    const refreshData = useCallback(async () => {
        await Promise.all([
            fetchHistory(),
            fetchProducts(),
            fetchSupermarkets()
        ]);
        setLastUpdated(new Date().toISOString());
    }, [fetchHistory, fetchProducts, fetchSupermarkets]);

    useEffect(() => {
        const t = setTimeout(() => refreshData(), 0);
        return () => clearTimeout(t);
    }, [refreshData]);

    useEffect(() => {
        if (!lastUpdated) return;
        const t0 = setTimeout(() => setIsFresh(true), 0);
        const timer = setTimeout(() => setIsFresh(false), 1200);
        return () => { clearTimeout(t0); clearTimeout(timer); };
    }, [lastUpdated]);

    useEffect(() => {
        const channels = [
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRICE_HISTORY}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRODUCTS}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.SUPERMARKETS}.documents`
        ];

        const unsubscribe = client.subscribe(channels, () => {
            setTimeout(() => refreshData(), 0);
        });

        return () => unsubscribe();
    }, [refreshData]);

    const getProductName = (id) => {
        const match = products.find((item) => item.$id === id);
        return match?.name || 'Unknown Product';
    };

    const getSupermarketName = (id) => {
        const match = supermarkets.find((item) => item.$id === id);
        return match?.name || 'Unknown Store';
    };

    const filteredHistory = history.filter((item) => {
        const productName = getProductName(item.productId).toLowerCase();
        const storeName = getSupermarketName(item.supermarketId).toLowerCase();
        const reason = (item.priceChangeReason || '').toLowerCase();
        return (
            productName.includes(searchTerm.toLowerCase()) ||
            storeName.includes(searchTerm.toLowerCase()) ||
            reason.includes(searchTerm.toLowerCase())
        );
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            timestamp: new Date(formData.timestamp).toISOString(),
        };

        const success = editing
            ? await updateHistory(editing.$id, payload)
            : await addHistory(payload);

        if (success) {
            setShowModal(false);
            setEditing(null);
            setFormData({
                priceId: '',
                price: '',
                productId: '',
                supermarketId: '',
                timestamp: new Date().toISOString().slice(0, 16),
                isPromotional: false,
                priceChangeReason: ''
            });
        } else {
            alert('Failed to save price history. Check console for details.');
        }
    };

    const handleEdit = (item) => {
        setEditing(item);
        setFormData({
            priceId: item.priceId || '',
            price: item.price ?? '',
            productId: item.productId || '',
            supermarketId: item.supermarketId || '',
            timestamp: item.timestamp
                ? new Date(item.timestamp).toISOString().slice(0, 16)
                : new Date().toISOString().slice(0, 16),
            isPromotional: !!item.isPromotional,
            priceChangeReason: item.priceChangeReason || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this history entry?')) {
            await deleteHistory(id);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        const result = await syncFromPrices(200);
        setSyncing(false);

        if (!result?.success) {
            alert('Failed to sync prices into history. Check console for details.');
            return;
        }

        alert(`Synced ${result.createdCount} prices into history.`);
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10 p-6 flex justify-between items-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Price History</h1>
                        <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live
                        </span>
                        <span className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest transition-colors ${isFresh ? 'text-green-600' : 'text-gray-400'}`}>
                            Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </span>
                        <div className="relative group max-w-md w-full ml-4 hidden md:block">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search product, store or reason..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={syncing || loading}
                        className="bg-gray-900 hover:bg-black text-white px-5 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-gray-900/20 active:scale-95 text-[11px] font-black uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <FiRefreshCw size={18} className={`stroke-[2.5] ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Prices'}
                    </button>
                    <button
                        onClick={() => {
                            setEditing(null);
                            setFormData({
                                priceId: '',
                                price: '',
                                productId: '',
                                supermarketId: '',
                                timestamp: new Date().toISOString().slice(0, 16),
                                isPromotional: false,
                                priceChangeReason: ''
                            });
                            setShowModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                    >
                        <FiPlus size={20} className="stroke-[3]" /> Add Entry
                    </button>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                                <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Product</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Store</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Price</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Timestamp</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Reason</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Promo</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {filteredHistory.map((item) => (
                                        <tr key={item.$id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="text-sm font-black text-gray-900 dark:text-white">
                                                    {getProductName(item.productId)}
                                                </div>
                                                <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                                    ID: {item.productId?.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="text-sm font-black text-gray-900 dark:text-white">
                                                    {getSupermarketName(item.supermarketId)}
                                                </div>
                                                <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                                    ID: {item.supermarketId?.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className="text-sm font-black text-gray-900 dark:text-white">{item.price}</span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 text-xs font-bold text-gray-500">
                                                    <FiClock size={12} />
                                                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 max-w-xs">
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 truncate block">
                                                    {item.priceChangeReason || 'No reason'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                    item.isPromotional
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'
                                                }`}>
                                                    {item.isPromotional ? 'Promo' : 'Standard'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50"
                                                    >
                                                        <FiEdit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.$id)}
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
                    )}
                </main>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                                {editing ? 'Edit History' : 'Add History'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl">
                                <FiX size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Product</label>
                                    <select
                                        value={formData.productId}
                                        onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Product</option>
                                        {products.map((product) => (
                                            <option key={product.$id} value={product.$id}>{product.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Supermarket</label>
                                    <select
                                        value={formData.supermarketId}
                                        onChange={(e) => setFormData({ ...formData, supermarketId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Supermarket</option>
                                        {supermarkets.map((market) => (
                                            <option key={market.$id} value={market.$id}>{market.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Timestamp</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.timestamp}
                                        onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Price ID</label>
                                    <input
                                        type="text"
                                        value={formData.priceId}
                                        onChange={(e) => setFormData({ ...formData, priceId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Promotional</label>
                                    <select
                                        value={formData.isPromotional ? 'yes' : 'no'}
                                        onChange={(e) => setFormData({ ...formData, isPromotional: e.target.value === 'yes' })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    >
                                        <option value="no">Standard</option>
                                        <option value="yes">Promotional</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Price Change Reason</label>
                                <input
                                    type="text"
                                    value={formData.priceChangeReason}
                                    onChange={(e) => setFormData({ ...formData, priceChangeReason: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                    placeholder="Optional reason"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                >
                                    {editing ? 'Update Entry' : 'Create Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceHistory;
