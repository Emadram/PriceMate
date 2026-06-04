import { useCallback, useEffect, useState } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiClock, FiRefreshCw, FiDownload } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import usePriceHistoryStore from '../stores/priceHistoryStore';
import useProductsStore from '../stores/productsStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import { DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import useDebouncedRealtimeRefresh from '../hooks/useDebouncedRealtimeRefresh';
import {
    isOpeProxyConfigured,
    fetchOpeStores,
    fetchOpeHistoricalPrices,
    probeOpeHistoricalMatches,
} from '../utils/openPriceEngineClient';
import { normalizeOpeHistoricalResponse } from '../utils/openPriceEngineNormalize';
import { buildProductNameVariants } from '../utils/openPriceEngineMatch';

const OPE_DEFAULT_SUPERMARKET_ID = import.meta.env.VITE_OPE_IMPORT_SUPERMARKET_ID || '';

const buildDefaultOpeForm = (supermarketId = '') => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    return {
        productId: '',
        productname: '',
        store: '',
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        currency: 'Default',
        supermarketId,
        priceChangeReason: 'Open Price Engine import',
    };
};

const PriceHistory = () => {
    const {
        history,
        loading,
        page,
        pageSize,
        total,
        setPage,
        fetchHistoryPage,
        addHistory,
        updateHistory,
        deleteHistory,
        backfillFromPrices,
        importHistoryBatch,
    } = usePriceHistoryStore();
    const { products, productOptions, fetchProductOptions, updateProductOpeMapping } = useProductsStore();
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();
    const catalogProducts = productOptions.length > 0 ? productOptions : products;

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [backfilling, setBackfilling] = useState(false);
    const [backfillProgress, setBackfillProgress] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const isFresh = useFreshIndicator(lastUpdated);

    const [formData, setFormData] = useState({
        priceId: '',
        price: '',
        productId: '',
        supermarketId: '',
        timestamp: new Date().toISOString().slice(0, 16),
        isPromotional: false,
        priceChangeReason: ''
    });

    const [showOpeModal, setShowOpeModal] = useState(false);
    const [opeForm, setOpeForm] = useState(() => buildDefaultOpeForm(OPE_DEFAULT_SUPERMARKET_ID));
    const [opeStores, setOpeStores] = useState([]);
    const [opeStoresLoading, setOpeStoresLoading] = useState(false);
    const [opeStoresError, setOpeStoresError] = useState('');
    const [opePreview, setOpePreview] = useState([]);
    const [opeFetchError, setOpeFetchError] = useState('');
    const [opeFetching, setOpeFetching] = useState(false);
    const [opeImporting, setOpeImporting] = useState(false);
    const [opeImportProgress, setOpeImportProgress] = useState(null);
    const [opeProbeResults, setOpeProbeResults] = useState([]);
    const [opeProbing, setOpeProbing] = useState(false);
    const [opeProbeError, setOpeProbeError] = useState('');

    const refreshData = useCallback(async () => {
        await Promise.all([
            fetchHistoryPage(page, pageSize),
            fetchProductOptions(),
            fetchSupermarkets(),
        ]);
        setLastUpdated(new Date().toISOString());
    }, [fetchHistoryPage, fetchProductOptions, fetchSupermarkets, page, pageSize]);

    useEffect(() => {
        const t = setTimeout(() => refreshData(), 0);
        return () => clearTimeout(t);
    }, [refreshData]);

    useEffect(() => {
        if (!showOpeModal || !isOpeProxyConfigured()) return undefined;

        let cancelled = false;
        const loadStores = async () => {
            setOpeStoresLoading(true);
            setOpeStoresError('');
            try {
                const stores = await fetchOpeStores();
                if (!cancelled) {
                    setOpeStores(stores);
                    if (stores.length > 0) {
                        setOpeForm((prev) => ({
                            ...prev,
                            store: prev.store || stores[0],
                        }));
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setOpeStoresError(err?.message || 'Failed to load OPE stores.');
                }
            } finally {
                if (!cancelled) setOpeStoresLoading(false);
            }
        };

        loadStores();
        return () => {
            cancelled = true;
        };
    }, [showOpeModal]);

    const handleOpeProductChange = (productId) => {
        const product = catalogProducts.find((p) => p.$id === productId);
        setOpeForm((prev) => ({
            ...prev,
            productId,
            productname: product?.opeProductName || product?.name || prev.productname,
            store: product?.opeStore || prev.store,
        }));
    };

    const handleOpeProbe = async () => {
        const query = String(opeForm.productname || '').trim();
        if (!query) {
            setOpeProbeError('Enter a product name to search OPE catalogs (e.g. coca cola).');
            return;
        }
        setOpeProbing(true);
        setOpeProbeError('');
        setOpeProbeResults([]);
        try {
            const { candidates } = await probeOpeHistoricalMatches({
                productQuery: query,
                start_date: opeForm.start_date,
                end_date: opeForm.end_date,
                currency: opeForm.currency,
                stores: opeStores.length ? opeStores : undefined,
            });
            setOpeProbeResults(candidates);
            if (candidates.length === 0) {
                setOpeProbeError(
                    'No OPE store had historical prices for this query. Try a shorter name (e.g. "cola") or different dates.'
                );
            }
        } catch (err) {
            setOpeProbeError(err?.message || 'OPE probe failed.');
        } finally {
            setOpeProbing(false);
        }
    };

    const applyOpeCandidate = (candidate) => {
        setOpeForm((prev) => ({
            ...prev,
            store: candidate.store,
            productname: candidate.productname,
            currency: 'Default',
        }));
        setOpeProbeError('');
        setOpeFetchError('');
    };

    const openOpeModal = () => {
        const defaultStore =
            OPE_DEFAULT_SUPERMARKET_ID || supermarkets[0]?.$id || '';
        setOpeForm(buildDefaultOpeForm(defaultStore));
        setOpePreview([]);
        setOpeFetchError('');
        setOpeStoresError('');
        setOpeProbeResults([]);
        setOpeProbeError('');
        setShowOpeModal(true);
    };

    const handleOpeFetch = async (e) => {
        e.preventDefault();
        setOpeFetchError('');
        setOpeFetching(true);
        setOpePreview([]);

        try {
            if (!isOpeProxyConfigured()) {
                throw new Error('VITE_APPWRITE_FUNCTION_OFF_PROXY is not configured.');
            }
            const data = await fetchOpeHistoricalPrices({
                store: opeForm.store,
                productname: opeForm.productname,
                start_date: opeForm.start_date,
                end_date: opeForm.end_date,
                currency: opeForm.currency,
                productnameVariants: buildProductNameVariants(opeForm.productname),
            });
            const normalized = normalizeOpeHistoricalResponse(data);
            if (normalized.length === 0) {
                setOpeFetchError('No price points returned for this query. Try another store, product name, or date range.');
            }
            setOpePreview(normalized);
        } catch (err) {
            setOpeFetchError(err?.message || 'Failed to fetch prices.');
        } finally {
            setOpeFetching(false);
        }
    };

    const handleOpeImport = async () => {
        if (opePreview.length === 0) return;
        if (!opeForm.productId || !opeForm.supermarketId) {
            alert('Select a PriceMate product and storage supermarket before importing.');
            return;
        }

        setOpeImporting(true);
        setOpeImportProgress({
            phase: 'creating',
            processed: 0,
            total: opePreview.length,
            created: 0,
            skipped: 0,
            failed: 0,
        });

        const result = await importHistoryBatch(
            opePreview,
            {
                productId: opeForm.productId,
                supermarketId: opeForm.supermarketId,
                priceChangeReason: opeForm.priceChangeReason,
                opeStore: opeForm.store,
            },
            (progress) => setOpeImportProgress(progress)
        );

        setOpeImporting(false);
        setOpeImportProgress(null);

        if (!result?.success) {
            alert(`Import failed: ${result?.errors?.[0] || 'Check console for details.'}`);
            return;
        }

        if (opeForm.productId && opeForm.store && opeForm.productname) {
            try {
                await updateProductOpeMapping(opeForm.productId, {
                    opeStore: opeForm.store,
                    opeProductName: opeForm.productname,
                    opeLastImportAt: new Date().toISOString(),
                });
            } catch (err) {
                console.warn('Could not save OPE mapping on product:', err?.message || err);
            }
        }

        alert(
            [
                `Created: ${result.createdCount}`,
                `Skipped (duplicates/invalid): ${result.skipped}`,
                `Failed: ${result.failed}`,
            ].join('\n')
        );
        setShowOpeModal(false);
    };

    const opeImportPercent =
        opeImportProgress?.total > 0
            ? Math.min(100, Math.round((opeImportProgress.processed / opeImportProgress.total) * 100))
            : 0;

    // `isFresh` indicator handled by useFreshIndicator to avoid rapid flicker

    const priceHistoryChannels = [
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRICE_HISTORY}.documents`,
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRODUCTS}.documents`,
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.SUPERMARKETS}.documents`,
    ];
    useDebouncedRealtimeRefresh(priceHistoryChannels, refreshData);

    const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

    const goToPage = (nextPage) => {
        const clamped = Math.min(Math.max(1, nextPage), totalPages);
        setPage(clamped);
        fetchHistoryPage(clamped, pageSize);
    };

    const getProductName = (id) => {
        const match = catalogProducts.find((item) => item.$id === id);
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

    const handleBackfill = async () => {
        setBackfilling(true);
        setBackfillProgress({
            phase: 'starting',
            processed: 0,
            total: 0,
            created: 0,
            skipped: 0,
            failed: 0,
        });

        const result = await backfillFromPrices((progress) => {
            setBackfillProgress(progress);
        });

        setBackfilling(false);
        setBackfillProgress(null);

        if (!result?.success) {
            const detail = result?.errors?.[0] || 'Check console for details.';
            alert(`Backfill failed: ${detail}`);
            return;
        }

        const lines = [
            `Created: ${result.createdCount}`,
            `Skipped: ${result.skipped} (${result.skippedExisting} already in history, ${result.skippedInvalid} invalid/missing relations)`,
            `Failed: ${result.failed}`,
            `Prices scanned: ${result.totalPrices}`,
        ];
        if (result.errors?.length) {
            lines.push(`Errors: ${result.errors.join('; ')}`);
        }
        alert(lines.join('\n'));
    };

    const backfillPercent =
        backfillProgress?.total > 0
            ? Math.min(100, Math.round((backfillProgress.processed / backfillProgress.total) * 100))
            : backfillProgress?.phase === 'loading_existing' || backfillProgress?.phase === 'loading_prices'
              ? null
              : 0;

    const backfillPhaseLabel = (() => {
        if (!backfillProgress) return '';
        if (backfillProgress.phase === 'loading_existing') return 'Loading existing history…';
        if (backfillProgress.phase === 'loading_prices') return 'Loading all prices…';
        if (backfillProgress.phase === 'creating') return 'Writing history…';
        return 'Starting…';
    })();

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
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-300 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search product, store or reason..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleBackfill}
                        disabled={backfilling || loading}
                        className="bg-gray-900 hover:bg-black text-white px-5 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-gray-900/20 active:scale-95 text-[11px] font-black uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <FiRefreshCw size={18} className={`stroke-[2.5] ${backfilling ? 'animate-spin' : ''}`} />
                        {backfilling ? 'Backfilling…' : 'Backfill from prices'}
                    </button>
                    <button
                        type="button"
                        onClick={openOpeModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-[11px] font-black uppercase tracking-widest"
                    >
                        <FiDownload size={18} className="stroke-[2.5]" />
                        Import from OPE
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
                        className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-brand-600/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                    >
                        <FiPlus size={20} className="stroke-[3]" /> Add Entry
                    </button>
                </header>

                {backfilling && backfillProgress && (
                    <div className="px-6 pb-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <div className="max-w-7xl mx-auto space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                                <span>{backfillPhaseLabel}</span>
                                <span>
                                    {backfillProgress.phase === 'creating'
                                        ? `${backfillProgress.processed} / ${backfillProgress.total} · created ${backfillProgress.created} · skipped ${backfillProgress.skipped} · failed ${backfillProgress.failed}`
                                        : backfillProgress.skipped > 0
                                          ? `skipped ${backfillProgress.skipped} (prep)`
                                          : ''}
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
                                <div
                                    className="h-full bg-brand-600 transition-all duration-300 ease-out"
                                    style={{
                                        width: backfillPercent != null ? `${backfillPercent}%` : '30%',
                                        opacity: backfillPercent != null ? 1 : 0.5,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
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
                                        <tr key={item.$id} className="hover:bg-brand-50/40 dark:hover:bg-brand-900/10 transition-colors group">
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
                                                        className="p-3 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-brand-100 dark:hover:border-brand-800/50"
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
                            <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 dark:border-gray-700">
                                <span className="text-xs font-bold text-gray-500">
                                    Page {page} of {totalPages} · {total} total records
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={page <= 1 || loading}
                                        onClick={() => goToPage(page - 1)}
                                        className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border border-gray-200 dark:border-gray-600 disabled:opacity-40"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        disabled={page >= totalPages || loading}
                                        onClick={() => goToPage(page + 1)}
                                        className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border border-gray-200 dark:border-gray-600 disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {showOpeModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000] overflow-y-auto">
                    <div
                        className={`bg-white dark:bg-gray-800 rounded-[2.5rem] w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200 my-8 ${
                            opePreview.length > 0 ? 'max-w-3xl' : 'max-w-lg'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                                Import from Open Price Engine
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowOpeModal(false)}
                                className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {!isOpeProxyConfigured() && (
                            <div className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-5 py-4 text-sm font-bold text-amber-800 dark:text-amber-200">
                                Set <code className="text-xs">VITE_APPWRITE_FUNCTION_OFF_PROXY</code>, redeploy{' '}
                                <code className="text-xs">off-proxy</code> with{' '}
                                <code className="text-xs">OPENPRICEENGINE_API_KEY</code>, and grant{' '}
                                <strong>Execute access → Users</strong> on that function (then redeploy).
                            </div>
                        )}

                        {(opeStoresError || opeFetchError || opeProbeError) && (
                            <div className="mb-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-5 py-4 text-sm font-bold text-red-700 dark:text-red-300">
                                {opeFetchError || opeProbeError || opeStoresError}
                            </div>
                        )}

                        <form onSubmit={handleOpeFetch} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                    PriceMate product
                                </label>
                                <select
                                    value={opeForm.productId}
                                    onChange={(e) => handleOpeProductChange(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">Select product</option>
                                    {catalogProducts.map((product) => (
                                        <option key={product.$id} value={product.$id}>
                                            {product.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                    Product name for OPE
                                </label>
                                <input
                                    type="text"
                                    value={opeForm.productname}
                                    onChange={(e) => setOpeForm({ ...opeForm, productname: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold"
                                    placeholder="e.g. coca cola"
                                    required
                                />
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleOpeProbe}
                                        disabled={opeProbing || !isOpeProxyConfigured()}
                                        className="rounded-2xl bg-brand-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-700 disabled:opacity-50"
                                    >
                                        {opeProbing ? 'Searching OPE…' : 'Find OPE matches'}
                                    </button>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                        Scans stores for the best historical match (any store with data).
                                    </span>
                                </div>
                            </div>

                            {opeProbeResults.length > 0 && (
                                <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/20 overflow-hidden">
                                    <p className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-700 dark:text-brand-300 border-b border-brand-100 dark:border-brand-800">
                                        OPE matches (by data points)
                                    </p>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="text-[10px] uppercase text-gray-500">
                                                <tr>
                                                    <th className="px-4 py-2">Store</th>
                                                    <th className="px-4 py-2">Product</th>
                                                    <th className="px-4 py-2">Points</th>
                                                    <th className="px-4 py-2" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {opeProbeResults.map((row) => (
                                                    <tr
                                                        key={`${row.store}-${row.productname}`}
                                                        className="border-t border-brand-100/80 dark:border-brand-800/80"
                                                    >
                                                        <td className="px-4 py-2 font-bold">{row.store}</td>
                                                        <td className="px-4 py-2">{row.productname}</td>
                                                        <td className="px-4 py-2 font-mono">{row.pointCount}</td>
                                                        <td className="px-4 py-2 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => applyOpeCandidate(row)}
                                                                className="text-xs font-black text-brand-600 dark:text-brand-400 hover:underline"
                                                            >
                                                                Use
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                    OPE store
                                </label>
                                <select
                                    value={opeForm.store}
                                    onChange={(e) => setOpeForm({ ...opeForm, store: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    required
                                    disabled={opeStoresLoading}
                                >
                                    <option value="">
                                        {opeStoresLoading ? 'Loading stores…' : 'Select OPE store'}
                                    </option>
                                    {opeStores.map((store) => (
                                        <option key={store} value={store}>
                                            {store}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                        Start date
                                    </label>
                                    <input
                                        type="date"
                                        value={opeForm.start_date}
                                        onChange={(e) => setOpeForm({ ...opeForm, start_date: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                        End date
                                    </label>
                                    <input
                                        type="date"
                                        value={opeForm.end_date}
                                        onChange={(e) => setOpeForm({ ...opeForm, end_date: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                        Currency (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={opeForm.currency}
                                        onChange={(e) => setOpeForm({ ...opeForm, currency: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white"
                                        placeholder="Default (recommended for Jumbo/EU)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                        Storage store (internal only)
                                    </label>
                                    <select
                                        value={opeForm.supermarketId}
                                        onChange={(e) => setOpeForm({ ...opeForm, supermarketId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select supermarket</option>
                                        {supermarkets.map((market) => (
                                            <option key={market.$id} value={market.$id}>
                                                {market.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                    Price change reason
                                </label>
                                <input
                                    type="text"
                                    value={opeForm.priceChangeReason}
                                    onChange={(e) => setOpeForm({ ...opeForm, priceChangeReason: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={opeFetching || opeImporting || !isOpeProxyConfigured()}
                                className="w-full bg-brand-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-700 transition-all disabled:opacity-60"
                            >
                                {opeFetching ? 'Fetching…' : 'Fetch prices'}
                            </button>
                        </form>

                        {opePreview.length > 0 && (
                            <div className="mt-8 space-y-4">
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                                    Preview ({opePreview.length} points)
                                </p>
                                <div className="max-h-64 overflow-y-auto rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-400">
                                                    Date
                                                </th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-400">
                                                    Price
                                                </th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-400">
                                                    OPE store label
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                            {opePreview.map((row) => (
                                                <tr key={`${row.timestamp}-${row.price}`}>
                                                    <td className="px-4 py-2 font-bold text-gray-700 dark:text-gray-200">
                                                        {new Date(row.timestamp).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-2 font-bold">{row.price}</td>
                                                    <td className="px-4 py-2 text-gray-500">{row.rawStore || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {opeImporting && opeImportProgress && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[11px] font-bold text-gray-600 dark:text-gray-300">
                                            <span>Importing…</span>
                                            <span>
                                                {opeImportProgress.processed} / {opeImportProgress.total} · created{' '}
                                                {opeImportProgress.created} · failed {opeImportProgress.failed}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-600 transition-all duration-300"
                                                style={{ width: `${opeImportPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowOpeModal(false)}
                                        className="flex-1 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleOpeImport}
                                        disabled={opeImporting || opeFetching}
                                        className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                        {opeImporting
                                            ? 'Importing…'
                                            : `Import ${opePreview.length} entries`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Product</option>
                                        {catalogProducts.map((product) => (
                                            <option key={product.$id} value={product.$id}>{product.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Supermarket</label>
                                    <select
                                        value={formData.supermarketId}
                                        onChange={(e) => setFormData({ ...formData, supermarketId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
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
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Timestamp</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.timestamp}
                                        onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
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
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Promotional</label>
                                    <select
                                        value={formData.isPromotional ? 'yes' : 'no'}
                                        onChange={(e) => setFormData({ ...formData, isPromotional: e.target.value === 'yes' })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
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
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                    placeholder="Optional reason"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-brand-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20 active:scale-95"
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
