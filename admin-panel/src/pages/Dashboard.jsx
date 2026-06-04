import { useNavigate } from 'react-router-dom';
import { 
    FiPackage, FiShoppingBag, FiDollarSign, FiMessageSquare, 
    FiTag, FiPlus, FiRefreshCcw, FiBell, FiCpu, FiTrendingUp, 
    FiActivity, FiUsers, FiCalendar, FiArrowUpRight, FiArrowDownRight, FiLogOut 
} from 'react-icons/fi';
import { 
    LineChart, Line, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import useAdminAuthStore from '../stores/adminAuthStore';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { DATABASE_ID, COLLECTIONS, Query, db } from '../lib/appwrite';
import Sidebar from '../components/Sidebar';
import useDebouncedRealtimeRefresh from '../hooks/useDebouncedRealtimeRefresh';
import { getCacheEntry, isFresh as isCacheFresh, setCacheEntry } from '../utils/readCache';

const DASHBOARD_CHART_CACHE_KEY = 'dashboard:charts:v1';
const CHART_CACHE_TTL_MS = 4 * 60 * 1000;
import {
    BRAND_CHART_COLORS,
    CHART_BRAND_STROKE,
    CHART_BRAND_STROKE_LIGHT,
    gridStroke,
    tickFill,
} from '../constants/chartTheme';

const resolveRelationshipId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) return field[0]?.$id || field[0] || null;
    if (typeof field === 'object') return field.$id || null;
    if (typeof field === 'string') return field;
    return null;
};

const resolveProductIdFromPrice = (price) => {
    if (price.productId) return price.productId;
    return resolveRelationshipId(price.products);
};

const resolveSupermarketIdFromPrice = (price) => {
    if (price.supermarketId) return price.supermarketId;
    return resolveRelationshipId(price.supermarkets);
};

const Dashboard = () => {
    const admin = useAdminAuthStore((state) => state.admin);
    const logout = useAdminAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        products: 0,
        prices: 0,
        supermarkets: 0,
        categories: 0,
        pendingReports: 0,
        outOfStock: 0,
        announcements: 0,
        chats: 0
    });
    const [loading, setLoading] = useState(true);
    const [rawProducts, setRawProducts] = useState([]);
    const [rawPrices, setRawPrices] = useState([]);
    const [rawPricesForMarket, setRawPricesForMarket] = useState([]);
    const [rawSupermarkets, setRawSupermarkets] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);
    const showFreshIndicator = useFreshIndicator(lastUpdated);
    const inFlightRef = useRef(false);
    const lastUpdatedMsRef = useRef(0);
    const chartsFreshRef = useRef(false);

    const fetchAll = useCallback(async (listFn, label) => {
        const limit = 100;
        const documents = [];
        let offset = 0;

        try {
            while (true) {
                const res = await listFn(offset, limit);
                const batch = res?.documents || [];
                documents.push(...batch);
                if (batch.length < limit) break;
                offset += limit;
            }
        } catch (error) {
            console.warn(`Dashboard: Failed to fetch ${label}:`, error.message);
            return [];
        }

        return documents;
    }, []);

    const fetchTotalsOnly = useCallback(async () => {
        const safeList = async (listFn, label) => {
            try {
                return await listFn();
            } catch (error) {
                console.warn(`Dashboard: Failed to fetch ${label}:`, error.message);
                return { total: 0, documents: [] };
            }
        };

        const [
            productsRes,
            pricesRes,
            categoriesRes,
            supermarketsRes,
            pendingReportsRes,
            outOfStockRes,
            announcementsRes,
            chatsRes,
        ] = await Promise.all([
            safeList(() => db.products.list([Query.limit(1)]), 'products'),
            safeList(() => db.prices.list([Query.limit(1)]), 'prices'),
            safeList(() => db.categories.list([Query.limit(1)]), 'categories'),
            safeList(() => db.supermarkets.list([Query.limit(1)]), 'supermarkets'),
            safeList(() => db.feedback.list([
                Query.equal('status', 'pending'),
                Query.limit(1),
            ]), 'pending reports'),
            safeList(() => db.prices.list([
                Query.equal('stockStatus', 'out_of_stock'),
                Query.limit(1),
            ]), 'stock issues'),
            safeList(() => db.announcements.list([Query.limit(1)]), 'announcements'),
            safeList(() => db.chatHistory.list([Query.limit(1)]), 'chat history'),
        ]);

        setStats({
            products: productsRes.total || 0,
            prices: pricesRes.total || 0,
            supermarkets: supermarketsRes.total || 0,
            categories: categoriesRes.total || 0,
            pendingReports: pendingReportsRes.total || 0,
            outOfStock: outOfStockRes.total || 0,
            announcements: announcementsRes.total || 0,
            chats: chatsRes.total || 0,
        });
    }, []);

    const fetchChartData = useCallback(async () => {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const pricesFromMs = fourteenDaysAgo.getTime();

        const [productsDocs, allPricesDocs, supermarketsDocs] = await Promise.all([
            fetchAll(
                (offset, limit) => db.products.list([
                    Query.limit(limit),
                    Query.offset(offset),
                    Query.orderDesc('$createdAt'),
                ]),
                'products for charts'
            ),
            fetchAll(
                (offset, limit) => db.prices.list([
                    Query.limit(limit),
                    Query.offset(offset),
                    Query.select([
                        '$id',
                        '$createdAt',
                        'productId',
                        'supermarketId',
                        'products.$id',
                        'products.name',
                        'supermarkets.$id',
                        'supermarkets.name',
                    ]),
                ]),
                'prices for charts'
            ),
            fetchAll(
                (offset, limit) => db.supermarkets.list([
                    Query.limit(limit),
                    Query.offset(offset),
                    Query.select(['$id', 'name']),
                ]),
                'supermarkets for charts'
            ),
        ]);

        const pricesTrendDocs = allPricesDocs.filter(
            (p) => new Date(p.$createdAt).getTime() >= pricesFromMs
        );

        setRawProducts(productsDocs);
        setRawPrices(pricesTrendDocs);
        setRawPricesForMarket(allPricesDocs);
        setRawSupermarkets(supermarketsDocs);

        setCacheEntry(DASHBOARD_CHART_CACHE_KEY, {
            productsDocs,
            pricesTrendDocs,
            allPricesDocs,
            supermarketsDocs,
        });
        chartsFreshRef.current = true;
    }, [fetchAll]);

    const applyChartCache = useCallback((cached) => {
        if (!cached?.data) return false;
        const { productsDocs, pricesTrendDocs, allPricesDocs, supermarketsDocs } = cached.data;
        setRawProducts(productsDocs || []);
        setRawPrices(pricesTrendDocs || []);
        setRawPricesForMarket(allPricesDocs || []);
        setRawSupermarkets(supermarketsDocs || []);
        chartsFreshRef.current = true;
        return true;
    }, []);

    const fetchStats = useCallback(async ({ showLoader = false, forceCharts = false } = {}) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        if (showLoader) setLoading(true);
        try {
            const cached = getCacheEntry(DASHBOARD_CHART_CACHE_KEY);
            const chartsCachedFresh = !forceCharts && isCacheFresh(cached, CHART_CACHE_TTL_MS);

            if (chartsCachedFresh) {
                applyChartCache(cached);
            }

            await fetchTotalsOnly();

            if (!chartsCachedFresh) {
                await fetchChartData();
            }

            const now = Date.now();
            if (now - lastUpdatedMsRef.current >= 1500) {
                setLastUpdated(new Date(now).toISOString());
                lastUpdatedMsRef.current = now;
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            if (showLoader) setLoading(false);
            inFlightRef.current = false;
        }
    }, [applyChartCache, fetchChartData, fetchTotalsOnly]);

    const fetchStatsLight = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const cached = getCacheEntry(DASHBOARD_CHART_CACHE_KEY);
            if (isCacheFresh(cached, CHART_CACHE_TTL_MS)) {
                await fetchTotalsOnly();
            } else {
                await fetchStats({ showLoader: false, forceCharts: false });
                return;
            }
            const now = Date.now();
            if (now - lastUpdatedMsRef.current >= 1500) {
                setLastUpdated(new Date(now).toISOString());
                lastUpdatedMsRef.current = now;
            }
        } catch (error) {
            console.error('Error fetching dashboard stats (light):', error);
        } finally {
            inFlightRef.current = false;
        }
    }, [fetchStats, fetchTotalsOnly]);

    const getWeeklyTrend = (items = [], dateField = '$createdAt') => {
        if (!items.length) return null;
        const now = new Date();
        const currentStart = new Date(now);
        currentStart.setDate(now.getDate() - 7);
        const previousStart = new Date(now);
        previousStart.setDate(now.getDate() - 14);

        const currentCount = items.filter((item) => new Date(item[dateField]) >= currentStart).length;
        const previousCount = items.filter((item) => {
            const date = new Date(item[dateField]);
            return date >= previousStart && date < currentStart;
        }).length;

        if (previousCount === 0) {
            if (currentCount === 0) return null;
            return { text: `+${currentCount}`, isUp: true };
        }

        const change = ((currentCount - previousCount) / previousCount) * 100;
        const sign = change >= 0 ? '+' : '';
        return { text: `${sign}${change.toFixed(1)}%`, isUp: change >= 0 };
    };

    const productTrend = useMemo(() => getWeeklyTrend(rawProducts), [rawProducts]);
    const priceTrend = useMemo(() => getWeeklyTrend(rawPrices), [rawPrices]);

    const marketChartData = useMemo(() => {
        if (!rawPricesForMarket.length) return [];

        const productSetsByMarket = {};
        rawPricesForMarket.forEach((price) => {
            const marketId = resolveSupermarketIdFromPrice(price);
            const productId = resolveProductIdFromPrice(price);
            if (!marketId || !productId) return;
            if (!productSetsByMarket[marketId]) {
                productSetsByMarket[marketId] = new Set();
            }
            productSetsByMarket[marketId].add(productId);
        });

        const marketIdsWithProducts = Object.keys(productSetsByMarket);
        if (marketIdsWithProducts.length === 0) return [];

        const supermarketById = Object.fromEntries(
            rawSupermarkets.map((market) => [market.$id, market])
        );

        const marketNameFromPrices = {};
        rawPricesForMarket.forEach((price) => {
            const marketId = resolveSupermarketIdFromPrice(price);
            if (!marketId || marketNameFromPrices[marketId]) return;
            const field = price.supermarkets;
            const name = typeof field === 'object' && !Array.isArray(field)
                ? field.name
                : (Array.isArray(field) ? field[0]?.name : null);
            if (name) marketNameFromPrices[marketId] = name;
        });

        return marketIdsWithProducts
            .map((marketId, i) => ({
                name: supermarketById[marketId]?.name || marketNameFromPrices[marketId] || 'Unknown Market',
                value: productSetsByMarket[marketId].size,
                color: BRAND_CHART_COLORS[i % BRAND_CHART_COLORS.length],
            }))
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [rawPricesForMarket, rawSupermarkets]);

    // Process Price Trends Data (Grouped by creation date)
    const priceTrendsData = useMemo(() => {
        if (!rawPrices.length) return [];
        
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const dailyCounts = {};
        rawPrices.forEach(p => {
            const date = p.$createdAt.split('T')[0];
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });

        return last7Days.map(date => ({
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            updates: dailyCounts[date] || 0
        }));
    }, [rawPrices]);

    useEffect(() => {
        const cached = getCacheEntry(DASHBOARD_CHART_CACHE_KEY);
        if (isCacheFresh(cached, CHART_CACHE_TTL_MS)) {
            applyChartCache(cached);
        }
        const t = setTimeout(() => fetchStats({ showLoader: true }), 0);
        return () => clearTimeout(t);
    }, [applyChartCache, fetchStats]);

    const dashboardChannels = useMemo(
        () => [
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRODUCTS}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.PRICES}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.CATEGORIES}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.SUPERMARKETS}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.FEEDBACK}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.ANNOUNCEMENTS}.documents`,
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_HISTORY}.documents`,
        ],
        []
    );

    useDebouncedRealtimeRefresh(dashboardChannels, fetchStatsLight, 1500);

    // `isFresh` indicator handled by useFreshIndicator to avoid rapid flicker

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans text-gray-900 dark:text-gray-100 uppercase-none">
            <Sidebar />
            
            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar">
                {/* Modern Header */}
                <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-8 py-5 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Executive Dashboard</h1>
                            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Live
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${showFreshIndicator ? 'text-green-600' : 'text-gray-400'}`}>
                                Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-medium tracking-tight">System health and real-time market overview</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-black text-gray-900 dark:text-white tracking-widest uppercase">{admin?.name || 'Admin'}</span>
                            <span className="text-[10px] font-black uppercase text-green-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> Node Active
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => fetchStats({ showLoader: true, forceCharts: true })}
                                className="p-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all active:scale-95 border border-gray-200 dark:border-gray-600 shadow-sm"
                                title="Sync Data"
                            >
                                <FiRefreshCcw className={loading ? 'animate-spin' : ''} />
                            </button>
                            <button 
                                onClick={handleLogout}
                                className="p-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all active:scale-95 border border-rose-100 dark:border-rose-900/50 shadow-sm"
                                title="Exit System"
                            >
                                <FiLogOut size={20} />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-8 space-y-8 max-w-[1600px] mx-auto w-full">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard 
                            title="Total Products" 
                            value={stats.products} 
                            icon={FiPackage} 
                            trend={productTrend?.text || ''} 
                            isUp={productTrend?.isUp ?? true} 
                            color="blue" 
                            loading={loading}
                        />
                        <MetricCard 
                            title="Active Market Prices" 
                            value={stats.prices} 
                            icon={FiDollarSign} 
                            trend={priceTrend?.text || ''} 
                            isUp={priceTrend?.isUp ?? true} 
                            color="emerald" 
                            loading={loading}
                        />
                        <MetricCard 
                            title="User reports (pending)" 
                            value={stats.pendingReports} 
                            icon={FiActivity} 
                            trend={''} 
                            isUp={true} 
                            color="rose" 
                            loading={loading}
                        />
                        <MetricCard 
                            title="Supermarket Nodes" 
                            value={stats.supermarkets} 
                            icon={FiShoppingBag} 
                            trend={''} 
                            isUp={true} 
                            color="amber" 
                            loading={loading}
                        />
                    </div>

                    {/* Analytics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Traffic Overview */}
                        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-[450px] overflow-hidden">
                            <div className="flex justify-between items-start mb-4 shrink-0 gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight normal-case">Price Activity</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black">Updates in the last 7 days</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-brand-700 bg-brand-50 dark:bg-brand-900/30 px-3 py-1 rounded-full uppercase whitespace-nowrap">
                                        <div className="w-1.5 h-1.5 bg-brand-600 rounded-full shrink-0"></div> Activity
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 w-full min-h-0 min-w-0 overflow-hidden">
                                <div className="w-full h-full min-h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={priceTrendsData}>
                                        <defs>
                                            <linearGradient id="colorSearches" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_BRAND_STROKE} stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor={CHART_BRAND_STROKE} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: tickFill, fontWeight: 700}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: tickFill, fontWeight: 700}} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px 16px', backgroundColor: '#fff', color: '#000'}}
                                            itemStyle={{fontSize: '12px', fontWeight: 800}}
                                        />
                                        <Area type="monotone" dataKey="updates" stroke={CHART_BRAND_STROKE} fillOpacity={1} fill="url(#colorSearches)" strokeWidth={4} dot={{fill: CHART_BRAND_STROKE_LIGHT, strokeWidth: 2, r: 4}} activeDot={{r: 6, strokeWidth: 0}} />
                                    </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Products per market chart */}
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-[450px] overflow-hidden">
                            <div className="mb-4 shrink-0 min-w-0">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight normal-case">Products per Market</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black mt-1">Live — distinct products with prices</p>
                            </div>
                            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                                {marketChartData.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6 min-h-0 overflow-hidden">
                                        <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-300 dark:text-gray-600 mb-3 shrink-0">
                                            <FiPackage size={26} className="shrink-0" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 normal-case">No market data yet</p>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-2 max-w-[220px] leading-relaxed">
                                            Add prices in the Prices page to populate this chart
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 min-h-0 w-full overflow-hidden">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={marketChartData}
                                                    layout="vertical"
                                                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                                                >
                                                <XAxis type="number" hide />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={72}
                                                    tick={{ fontSize: 10, fill: tickFill, fontWeight: 700 }}
                                                    tickFormatter={(value) => {
                                                        const label = String(value || '');
                                                        return label.length > 10 ? `${label.slice(0, 10)}…` : label;
                                                    }}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '8px 12px' }}
                                                />
                                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={24}>
                                                    {marketChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="shrink-0 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 max-h-[108px] overflow-y-auto overflow-x-hidden space-y-2 pr-1">
                                            {marketChartData.map((market, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: market.color }} />
                                                        <span className="truncate normal-case">{market.name}</span>
                                                    </div>
                                                    <span className="text-gray-900 dark:text-white shrink-0 whitespace-nowrap normal-case">
                                                        {market.value} {market.value === 1 ? 'product' : 'products'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Access Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
                         <QuickStatus 
                            title="AI Chat Logs" 
                            value={stats.chats} 
                            subText="Total stored messages" 
                            icon={FiCpu} 
                            color="blue"
                            onClick={() => navigate('/chat-history')}
                         />
                         <QuickStatus 
                            title="System Broadcasts" 
                            value={stats.announcements} 
                            subText="Active Platform Alerts" 
                            icon={FiBell} 
                            color="amber"
                            onClick={() => navigate('/announcements')}
                         />
                         <QuickStatus 
                            title="User reports queue" 
                            value={stats.pendingReports} 
                            subText="Resolution Required" 
                            icon={FiMessageSquare} 
                            color="rose"
                            onClick={() => navigate('/feedback')}
                         />
                    </div>
                </main>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, icon, trend, isUp, color, loading }) => {
    const IconComponent = icon;
    const colorMap = {
        blue: 'text-brand-700 bg-brand-50 border-brand-100 dark:bg-brand-900/30 dark:border-brand-800',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800',
        rose: 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-900/30 dark:border-rose-800',
        amber: 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/30 dark:border-amber-800',
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-7 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm relative group overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl">
            <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:scale-150 transition-transform duration-500">
                <IconComponent size={120} />
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border-2 ${colorMap[color]}`}>
                <IconComponent size={26} strokeWidth={2.5} />
            </div>
            <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</h4>
            <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-black tracking-tighter text-gray-900 dark:text-white ${loading ? 'animate-pulse opacity-20' : ''}`}>
                    {loading ? '--' : value.toLocaleString()}
                </span>
                {trend ? (
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isUp ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />} {trend}
                    </span>
                ) : null}
            </div>
        </div>
    );
};

const QuickStatus = ({ title, value, subText, icon, color, onClick }) => {
    const IconComponent = icon;
    const colorMap = {
        blue: 'bg-brand-600 shadow-brand-600/30',
        amber: 'bg-amber-500 shadow-amber-500/30',
        rose: 'bg-rose-500 shadow-rose-500/30',
    };

    return (
        <button 
            onClick={onClick}
            className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-6 group hover:translate-y-[-6px] transition-all text-left w-full"
        >
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl transition-transform group-hover:rotate-12 ${colorMap[color]}`}>
                <IconComponent size={28} strokeWidth={2.5} />
            </div>
            <div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white leading-none mb-1.5 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{value}</h4>
                <p className="text-sm font-black text-gray-500 tracking-tight leading-none mb-2">{title}</p>
                <div className="flex items-center gap-1.5 opacity-60">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <p className="text-[9px] uppercase font-black tracking-widest text-gray-400">{subText}</p>
                </div>
            </div>
        </button>
    );
};

export default Dashboard;
