import { useCallback, useEffect, useRef, useState } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { Link } from 'react-router-dom';
import { FiPackage, FiEdit2, FiTrash2, FiPlus, FiChevronUp, FiChevronDown, FiX, FiSearch, FiFilter } from 'react-icons/fi';
import SortIcon from '../components/SortIcon';
import useProductsStore from '../stores/productsStore';
import useCategoriesStore from '../stores/categoriesStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import Sidebar from '../components/Sidebar';
import { client, DATABASE_ID, COLLECTIONS, functions } from '../lib/appwrite';

const OFF_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const OFF_PROXY_FUNCTION_ID = import.meta.env.VITE_APPWRITE_FUNCTION_OFF_PROXY || '';
const NUTRITION_META_MARKER = '\n\n[PriceMate Nutrition]\n';

const stripNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    return markerIndex >= 0 ? text.slice(0, markerIndex).trimEnd() : text.trimEnd();
};

const extractNutritionMeta = (value) => {
    const text = String(value || '');
    const markerIndex = text.indexOf(NUTRITION_META_MARKER);
    if (markerIndex < 0) return null;
    const jsonText = text.slice(markerIndex + NUTRITION_META_MARKER.length).trim();
    if (!jsonText) return null;
    try {
        return JSON.parse(jsonText);
    } catch {
        return null;
    }
};

const Products = () => {
    const { 
        products, 
        loading, 
        total, 
        page, 
        limit, 
        fetchProducts, 
        deleteProduct, 
        uploadProductImage 
    } = useProductsStore();
    const { categories, fetchCategories } = useCategoriesStore();
    const { supermarkets: _supermarkets, fetchSupermarkets } = useSupermarketsStore();

    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [offLookup, setOffLookup] = useState({ loading: false, error: '', results: [] });
    const offAbortRef = useRef(null);
    const [useOffImage, setUseOffImage] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        brand: '',
        barcode: '',
        imageUrl: '',
        description: '',
        stockQuantity: 0,
        categoryId: '',
        supermarkets: '',
        sugarsPer100g: '',
        sodiumMgPer100g: '',
        ingredientsText: '',
        nutritionSource: '',
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [lastUpdated, setLastUpdated] = useState(null);
    const isFresh = useFreshIndicator(lastUpdated);
    const resetOffLookup = () => setOffLookup({ loading: false, error: '', results: [] });

    const sleep = useCallback((ms) => new Promise((resolve) => setTimeout(resolve, ms)), []);

    const parseRetryAfterMs = useCallback((value) => {
        if (!value) return null;
        const seconds = Number(value);
        if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
        const dateMs = Date.parse(value);
        if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
        return null;
    }, []);

    const fetchWithBackoff = useCallback(async (url, options = {}, config = {}) => {
        const {
            retries = 2,
            baseDelayMs = 400,
            maxDelayMs = 2000,
        } = config;
        const signal = options?.signal;

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            if (signal?.aborted) return null;
            try {
                const response = await fetch(url, options);
                if (response.ok || !OFF_RETRY_STATUSES.has(response.status) || attempt === retries) {
                    return response;
                }

                const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
                const backoffMs = retryAfterMs ?? Math.min(
                    baseDelayMs * (2 ** attempt) * (0.75 + Math.random() * 0.5),
                    maxDelayMs
                );
                await sleep(backoffMs);
            } catch {
                if (signal?.aborted) return null;
                if (attempt === retries) return null;
                const backoffMs = Math.min(
                    baseDelayMs * (2 ** attempt) * (0.75 + Math.random() * 0.5),
                    maxDelayMs
                );
                await sleep(backoffMs);
            }
        }

        return null;
    }, [parseRetryAfterMs, sleep]);

    const callOffProxy = useCallback(async (payload) => {
        if (!OFF_PROXY_FUNCTION_ID) return null;
        try {
            const execution = await functions.createExecution(
                OFF_PROXY_FUNCTION_ID,
                JSON.stringify(payload),
                false
            );
            if (!execution?.response) return null;
            return JSON.parse(execution.response);
        } catch (error) {
            console.error('OFF proxy error:', error);
            return { ok: false, status: 0, error: 'Proxy error' };
        }
    }, []);

    const normalizeOffResult = (product) => {
        if (!product) return null;
        const barcode = String(product.code || '').trim();
        if (!barcode) return null;
        const name =
            product.product_name ||
            product.product_name_en ||
            product.product_name_tr ||
            product.generic_name ||
            '';
        if (!name) return null;
        const brand = (product.brands || '').split(',')[0]?.trim() || '';
        // Prefer front image variants, then selected_images display variants, then generic image fields
        const imageUrl = (
            product.image_front_url ||
            product.image_front_small_url ||
            product.image_small_url ||
            product.image_url ||
            // some OFF payloads include nested selected_images with language keys
            (product.selected_images && product.selected_images.front && (
                product.selected_images.front.display?.en ||
                product.selected_images.front.display?.fr ||
                product.selected_images.front.display?.tr ||
                Object.values(product.selected_images.front.display || {})[0]
            )) ||
            ''
        );
        const description =
            product.generic_name ||
            product.generic_name_en ||
            product.generic_name_tr ||
            product.categories ||
            '';
        // Extract some nutrition info if available
        const nutriments = product.nutriments || {};
        const parseNumber = (v) => {
            if (v === undefined || v === null || String(v).trim() === '') return null;
            const n = parseFloat(String(v).replace(',', '.'));
            return Number.isFinite(n) ? n : null;
        };

        const sugarsPer100g = parseNumber(nutriments.sugars_100g ?? nutriments.sugars_value ?? nutriments.sugars);
        const sodiumValue = parseNumber(nutriments.sodium_100g ?? nutriments.sodium_value ?? nutriments.sodium);
        const sodiumUnit = String(nutriments.sodium_unit || '').toLowerCase();
        let sodiumMgPer100g = null;
        if (sodiumValue !== null) {
            sodiumMgPer100g = sodiumUnit === 'mg' ? sodiumValue : sodiumValue * 1000;
        }

        // Fallback: some OFF records provide `salt_100g` instead of sodium. Convert salt (g) to sodium (mg).
        const saltValue = parseNumber(nutriments.salt_100g ?? nutriments.salt_value ?? nutriments.salt);
        const saltUnit = String(nutriments.salt_unit || '').toLowerCase();
        let saltGPer100g = null;
        if (saltValue !== null) {
            // if unit is mg, convert to g
            saltGPer100g = saltUnit === 'mg' ? saltValue / 1000 : saltValue;
        }

        if (sodiumMgPer100g === null && saltGPer100g !== null) {
            // Approximate conversion: 1g salt (NaCl) ≈ 0.3934g sodium => sodium (mg) = salt_g * 1000 * 0.3934
            // Many implementations approximate by dividing salt by 2.5 then *1000 (salt/2.5*1000) — keep compat with other helpers
            sodiumMgPer100g = (saltGPer100g / 2.5) * 1000;
        }

        const ingredientsText = product.ingredients_text || product.ingredients_text_en || product.ingredients_text_tr || '';

        return {
            barcode,
            name,
            brand,
            imageUrl,
            description: String(description || '').trim(),
            sugarsPer100g: sugarsPer100g ?? '',
            sodiumMgPer100g: sodiumMgPer100g ?? '',
            ingredientsText: ingredientsText || '',
            nutritionSource: 'OpenFoodFacts'
        };
    };

    const handleOffLookup = useCallback(async () => {
        const nameQuery = String(formData.name || '').trim();
        const rawBarcode = String(formData.barcode || '').trim();
        const barcodeOnly = rawBarcode.replace(/\s+/g, '');

        if (offAbortRef.current) {
            offAbortRef.current.abort();
        }
        const controller = new AbortController();
        offAbortRef.current = controller;

        // Prefer direct product lookup when a barcode is provided
        if (barcodeOnly.length >= 6 && /^\d+$/.test(barcodeOnly)) {
            setOffLookup({ loading: true, error: '', results: [] });
            try {
                let productData = null;
                if (OFF_PROXY_FUNCTION_ID) {
                    const proxyResult = await callOffProxy({ kind: 'product', barcode: barcodeOnly });
                    if (proxyResult && proxyResult.ok && proxyResult.data && proxyResult.data.product) {
                        productData = proxyResult.data.product;
                    }
                }

                if (!productData) {
                    const resp = await fetchWithBackoff(
                        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcodeOnly)}.json`,
                        { signal: controller.signal }
                    );
                    if (!resp || !resp.ok) {
                        setOffLookup({ loading: false, error: 'No product found for barcode.', results: [] });
                        return;
                    }
                    const json = await resp.json();
                    productData = json?.product || null;
                }

                const result = normalizeOffResult(productData);
                setOffLookup({ loading: false, error: result ? '' : 'No barcode matches found.', results: result ? [result] : [] });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('OFF barcode lookup failed:', err);
                setOffLookup({ loading: false, error: 'Barcode lookup failed. Try again.', results: [] });
                return;
            }
        }

        // Fallback: search by name
        const query = nameQuery;
        if (query.length < 3) {
            setOffLookup({ loading: false, error: 'Enter at least 3 characters.', results: [] });
            return;
        }

        if (offAbortRef.current) {
            offAbortRef.current.abort();
        }

        const searchController = new AbortController();
        offAbortRef.current = searchController;
        setOffLookup({ loading: true, error: '', results: [] });

        try {
            let data = null;

            if (OFF_PROXY_FUNCTION_ID) {
                const proxyResult = await callOffProxy({ kind: 'search', query, pageSize: 5 });
                if (!proxyResult) {
                    setOffLookup({ loading: false, error: 'Open Food Facts proxy failed.', results: [] });
                    return;
                }
                if (!proxyResult.ok) {
                    const statusNote = proxyResult.status ? ` (${proxyResult.status})` : '';
                    setOffLookup({ loading: false, error: `Open Food Facts proxy error${statusNote}.`, results: [] });
                    return;
                }
                data = proxyResult.data;
            } else {
                const response = await fetchWithBackoff(
                    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`,
                        { signal: searchController.signal }
                );

                if (!response) {
                    setOffLookup({ loading: false, error: 'Open Food Facts is temporarily unavailable.', results: [] });
                    return;
                }

                if (!response.ok) {
                    throw new Error(`Open Food Facts lookup failed (${response.status}).`);
                }

                data = await response.json();
            }
            const products = Array.isArray(data?.products) ? data.products : [];
            const results = products
                .map(normalizeOffResult)
                .filter(Boolean);

            setOffLookup({
                loading: false,
                error: results.length ? '' : 'No barcode matches found.',
                results,
            });
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('OFF barcode lookup failed:', error);
            setOffLookup({ loading: false, error: 'Barcode lookup failed. Try again.', results: [] });
        }
    }, [callOffProxy, fetchWithBackoff, formData.name, formData.barcode]);

    const applyOffCandidate = (candidate) => {
        setFormData((prev) => ({
            ...prev,
            barcode: candidate.barcode || prev.barcode,
            imageUrl: useOffImage
                ? (candidate.imageUrl || prev.imageUrl || '')
                : (prev.imageUrl || ''),
            name: prev.name || candidate.name || prev.name,
            brand: prev.brand || candidate.brand || '',
            description: prev.description || candidate.description || '',
            sugarsPer100g: candidate.sugarsPer100g ?? prev.sugarsPer100g ?? '',
            sodiumMgPer100g: candidate.sodiumMgPer100g ?? prev.sodiumMgPer100g ?? '',
            ingredientsText: candidate.ingredientsText ?? prev.ingredientsText ?? '',
            nutritionSource: candidate.nutritionSource ?? prev.nutritionSource ?? '',
        }));
        resetOffLookup();
    };

    const refreshData = useCallback(async () => {
        await Promise.all([
            fetchProducts(page),
            fetchCategories(),
            fetchSupermarkets()
        ]);
        setLastUpdated(new Date().toISOString());
    }, [fetchProducts, fetchCategories, fetchSupermarkets, page]);

    useEffect(() => {
        const t = setTimeout(() => refreshData(), 0);
        return () => clearTimeout(t);
    }, [refreshData]);

    // `isFresh` indicator handled by useFreshIndicator to avoid rapid flicker

    useEffect(() => {
        if (!showModal && offAbortRef.current) {
            offAbortRef.current.abort();
        }
    }, [showModal]);

    useEffect(() => {
        const channels = [
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRODUCTS}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.CATEGORIES}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.SUPERMARKETS}.documents`
        ];

        const unsubscribe = client.subscribe(channels, () => {
            setTimeout(() => refreshData(), 0);
        });

        return () => unsubscribe();
    }, [refreshData]);

    const handlePageChange = (newPage) => {
        fetchProducts(newPage);
        setLastUpdated(new Date().toISOString());
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const imageUrl = await uploadProductImage(file);
            if (imageUrl) {
                setFormData(prev => ({ ...prev, imageUrl }));
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('Image upload failed. Ensure the product images bucket exists.');
        }
        setUploading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const store = useProductsStore.getState();

        if (editingProduct) {
            await store.updateProduct(editingProduct.$id, formData);
        } else {
            await store.addProduct(formData);
        }

        setShowModal(false);
        setEditingProduct(null);
        resetOffLookup();
        setUseOffImage(true);
        setFormData({
            name: '',
            brand: '',
            barcode: '',
            imageUrl: '',
            description: '',
            stockQuantity: 0,
            categoryId: '',
            supermarkets: '',
            sugarsPer100g: '',
            sodiumMgPer100g: '',
            ingredientsText: '',
            nutritionSource: '',
        });
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        resetOffLookup();
        setUseOffImage(!product.imageUrl);
        const catId = product.categoryId && typeof product.categoryId === 'object'
            ? product.categoryId.$id
            : product.categoryId;
        const nutritionMeta = extractNutritionMeta(product.description);

        setFormData({
            name: product.name,
            brand: product.brand || '',
            barcode: product.barcode,
            imageUrl: product.imageUrl || '',
            description: stripNutritionMeta(product.description || ''),
            stockQuantity: product.stockQuantity || 0,
            categoryId: catId || '',
            supermarkets: product.supermarkets?.$id || '',
            sugarsPer100g: nutritionMeta?.sugarsPer100g ?? product.nutrition?.sugarsPer100g ?? product.sugarsPer100g ?? '',
            sodiumMgPer100g: nutritionMeta?.sodiumMgPer100g ?? product.nutrition?.sodiumMgPer100g ?? product.sodiumMgPer100g ?? '',
            ingredientsText: nutritionMeta?.ingredientsText ?? product.nutrition?.ingredientsText ?? (product.ingredientsText || ''),
            nutritionSource: nutritionMeta?.nutritionSource ?? product.nutrition?.nutritionSource ?? (product.nutritionSource || ''),
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            await deleteProduct(id);
        }
    };

    const getCategoryName = (product) => {
        if (product.categoryId && typeof product.categoryId === 'object') {
            return product.categoryId.categoryName || 'N/A';
        }
        if (product.categoryId && typeof product.categoryId === 'string') {
            const cat = categories.find(c => c.$id === product.categoryId);
            return cat ? cat.categoryName : 'N/A';
        }
        return 'N/A';
    };

    const filteredBySearch = products.filter(product => {
        const searchLower = searchTerm.toLowerCase();
        const description = stripNutritionMeta(product.description);
        return (
            product.name?.toLowerCase().includes(searchLower) ||
            product.brand?.toLowerCase().includes(searchLower) ||
            product.barcode?.toLowerCase().includes(searchLower) ||
            description.toLowerCase().includes(searchLower) ||
            getCategoryName(product).toLowerCase().includes(searchLower)
        );
    });

    const filteredProducts = filteredBySearch.filter(product => {
        if (!filterCategory) return true;
        const prodCatId = product.categoryId && typeof product.categoryId === 'object'
            ? product.categoryId.$id
            : product.categoryId;
        return prodCatId === filterCategory;
    });

    const sortedProducts = [...filteredProducts];
    if (sortConfig.key) {
        sortedProducts.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'category') {
                aValue = getCategoryName(a);
                bValue = getCategoryName(b);
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
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10 p-6 flex justify-between items-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Products</h1>
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
                                placeholder="Search by name, barcode or category..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setEditingProduct(null);
                            resetOffLookup();
                            setUseOffImage(true);
                            setShowModal(true);
                            setFormData({ name: '', brand: '', barcode: '', imageUrl: '', description: '', stockQuantity: 0, categoryId: '', supermarkets: '', sugarsPer100g: '', sodiumMgPer100g: '', ingredientsText: '', nutritionSource: '' });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                    >
                        <FiPlus size={20} className="stroke-[3]" /> Add Product
                    </button>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm mb-8 border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="flex items-center gap-6 w-full md:w-auto">
                            <div className="flex items-center gap-3 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">
                                <FiFilter className="text-blue-500" />
                                <span>Filter By Category:</span>
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-900 border-none px-4 py-2 rounded-xl focus:ring-0 cursor-pointer text-blue-600 font-black text-xs tracking-widest uppercase transition-all hover:bg-blue-50 dark:hover:bg-blue-900/40"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(c => (
                                        <option key={c.$id} value={c.$id}>{c.categoryName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Showing:</span>
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800/50">
                                {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                                <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] w-20">Media</th>
                                        <th
                                            className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('name')}
                                        >
                                            Product Details <SortIcon columnKey="name" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                        </th>
                                        <th
                                            className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('barcode')}
                                        >
                                            Identification <SortIcon columnKey="barcode" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                        </th>
                                        <th
                                            className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('category')}
                                        >
                                            Category <SortIcon columnKey="category" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                        </th>
                                        <th
                                            className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('stockQuantity')}
                                        >
                                            Stock <SortIcon columnKey="stockQuantity" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                        </th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {sortedProducts.map((item) => (
                                        <tr key={item.$id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="h-16 w-16 bg-gray-50 dark:bg-gray-900 rounded-[1.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                    {item.imageUrl ? (
                                                        <img className="h-full w-full object-cover" src={item.imageUrl} alt={item.name} />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-gray-300 dark:text-gray-600 italic text-[10px] font-black uppercase">No Image</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-base font-black text-gray-900 dark:text-white tracking-tight uppercase">{item.name}</div>
                                                <div className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mt-0.5 max-w-[200px] truncate">{stripNutritionMeta(item.description) || 'No Description provided'}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-sm font-mono font-black text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800 inline-block">
                                                    #{item.barcode || 'NO-CODE'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{getCategoryName(item)}</span>
                                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Asset Class</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-black ${item.stockQuantity <= 5 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {item.stockQuantity} Units
                                                    </span>
                                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                                                        {item.stockQuantity <= 5 ? 'Critical Alert' : 'Healthy Stock'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(item)} className="p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50">
                                                        <FiEdit2 size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.$id)} className="p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-red-100 dark:hover:border-red-800/50">
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
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-600 hover:text-white shadow-sm border border-gray-100 dark:border-gray-700'
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
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-600 hover:text-white shadow-sm border border-gray-100 dark:border-gray-700'
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
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] max-w-2xl w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200 h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8 sticky top-0 bg-white dark:bg-gray-800 pb-4 z-10">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{editingProduct ? 'Update Product' : 'Catalog New Entry'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl"><FiX size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="flex gap-8 items-start">
                                <div className="w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center group relative cursor-pointer shadow-inner">
                                    {formData.imageUrl ? (
                                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 font-black text-xs uppercase text-center p-4 opacity-60">
                                            <FiPackage size={32} className="mb-2" /> {uploading ? 'Processing...' : 'Upload Image'}
                                        </div>
                                    )}
                                    <input type="file" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                                <div className="flex-1 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Product Name</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                placeholder="Enter product title..."
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Barcode / SKU</label>
                                                <button
                                                    type="button"
                                                    onClick={handleOffLookup}
                                                    disabled={offLookup.loading}
                                                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                                >
                                                    {offLookup.loading ? 'Searching...' : 'Autofill'}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.barcode}
                                                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                placeholder="Scan or type barcode..."
                                                required
                                            />
                                            {offLookup.error && (
                                                <p className="text-[11px] text-red-600 font-semibold">{offLookup.error}</p>
                                            )}
                                            {offLookup.results.length > 0 && (
                                                <div className="mt-2 rounded-2xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-900/20 p-3 space-y-2">
                                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Open Food Facts matches</div>
                                                    {offLookup.results.map((hit) => (
                                                        <button
                                                            key={hit.barcode}
                                                            type="button"
                                                            onClick={() => applyOffCandidate(hit)}
                                                            className="w-full text-left p-2 rounded-xl bg-white/70 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition"
                                                        >
                                                            <div className="text-xs font-bold text-gray-900 dark:text-white truncate">{hit.name}</div>
                                                            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                                                <span className="font-mono">#{hit.barcode}</span>
                                                                {hit.brand && <span className="truncate max-w-[120px]">{hit.brand}</span>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Brand</label>
                                            <input
                                                type="text"
                                                value={formData.brand}
                                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                placeholder="Brand name..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Use OFF image</label>
                                            <label className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={useOffImage}
                                                    onChange={(e) => setUseOffImage(e.target.checked)}
                                                    className="h-4 w-4 accent-blue-600"
                                                />
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                                    Apply OFF image when selecting a match
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Classification</label>
                                            <select
                                                value={formData.categoryId}
                                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.$id} value={cat.$id}>{cat.categoryName}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Initial Stock Units</label>
                                            <input
                                                type="number"
                                                value={formData.stockQuantity}
                                                onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                min="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Extended Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all min-h-[120px]"
                                            placeholder="Provide additional details..."
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
                                        <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                            Nutrition overrides (optional)
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            Used by the user app when Open Food Facts has no data. Add matching attributes in Appwrite <code className="font-mono text-[10px]">products</code> if saves fail.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sugars (g / 100g)</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData.sugarsPer100g}
                                                    onChange={(e) => setFormData({ ...formData, sugarsPer100g: e.target.value })}
                                                    className="w-full bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                    placeholder="e.g. 12.5"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sodium (mg / 100g)</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData.sodiumMgPer100g}
                                                    onChange={(e) => setFormData({ ...formData, sodiumMgPer100g: e.target.value })}
                                                    className="w-full bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                    placeholder="e.g. 400"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ingredients text</label>
                                            <textarea
                                                value={formData.ingredientsText}
                                                onChange={(e) => setFormData({ ...formData, ingredientsText: e.target.value })}
                                                className="w-full bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all min-h-[100px]"
                                                placeholder="Comma-separated or label-style ingredient list..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nutrition source note</label>
                                            <input
                                                type="text"
                                                value={formData.nutritionSource}
                                                onChange={(e) => setFormData({ ...formData, nutritionSource: e.target.value })}
                                                className="w-full bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                                placeholder="e.g. Manufacturer label 2025"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="submit"
                                            className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                        >
                                            {editingProduct ? 'Commit Changes' : 'Launch Product'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
