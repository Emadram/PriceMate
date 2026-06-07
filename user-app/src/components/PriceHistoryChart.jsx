import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiBarChart2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { fetchPriceHistory } from '../utils/productUtils';
import { getCacheEntry, swrGetOrFetch } from '../utils/swrCache';
import { PRICE_HISTORY_CHART_TTL_MS } from '../utils/cacheTtls';
import useCurrencyStore from '../stores/currencyStore';

const getSupermarketFromPrice = (price) => {
    if (!price) return null;
    if (price.supermarkets) {
        return Array.isArray(price.supermarkets) ? price.supermarkets[0] : price.supermarkets;
    }
    return price.supermarketId || null;
};

const getSupermarketId = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return getSupermarketId(value[0]);
    if (typeof value === 'string') return value;
    return value.$id;
};

const getHistoryTimestamp = (item) => item?.timestamp || item?.recordedAt || item?.$createdAt || null;

const getPriceTimestamp = (price) => price?.$updatedAt || price?.updatedAt || price?.$createdAt || price?.createdAt || null;

const formatSupermarketName = (supermarket) => {
    if (!supermarket || typeof supermarket !== 'object') return 'Store';
    if (supermarket.branchName) return `${supermarket.name} - ${supermarket.branchName}`;
    return supermarket.name || 'Store';
};

const formatSupermarketLabel = (name) => {
    if (!name) return 'Store';
    const trimmed = name.trim();
    return trimmed.length > 14 ? `${trimmed.slice(0, 14)}...` : trimmed;
};

const buildCurrentPricesSignature = (currentPrices = []) =>
    currentPrices
        .map((price) => {
            const supermarket = getSupermarketFromPrice(price);
            return `${getSupermarketId(supermarket) || 'unknown'}:${price.price}:${getPriceTimestamp(price) || ''}`;
        })
        .sort()
        .join('|');

const buildChartHistory = (data, currentPrices = []) => {
    const supermarketLookup = new Map();

    currentPrices.forEach((price) => {
        const supermarket = getSupermarketFromPrice(price);
        const supermarketId = getSupermarketId(supermarket);
        if (supermarketId && typeof supermarket === 'object') {
            supermarketLookup.set(supermarketId, supermarket);
        }
    });

    const historyPoints = data.map((item) => {
        const timeValue = getHistoryTimestamp(item);
        if (!timeValue) return null;

        const supermarketId = getSupermarketId(item.supermarketId || item.supermarkets || item.supermarket);
        const matched = supermarketLookup.get(supermarketId);
        const displayDate = new Date(timeValue).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
        const supermarketName = matched ? formatSupermarketName(matched) : item.supermarketName || 'Store';

        return {
            date: new Date(timeValue).getTime(),
            displayDate,
            price: Number(item.price),
            supermarket: supermarketName,
            supermarketLabel: formatSupermarketLabel(supermarketName),
            supermarketId,
            currency: item.currency || 'TRY',
        };
    }).filter(Boolean);

    const currentPoints = currentPrices.map((price) => {
        const supermarket = getSupermarketFromPrice(price);
        const timeValue = getPriceTimestamp(price);
        if (!timeValue) return null;

        const supermarketName = formatSupermarketName(supermarket);

        return {
            date: new Date(timeValue).getTime(),
            displayDate: new Date(timeValue).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
            price: Number(price.price),
            supermarket: supermarketName,
            supermarketLabel: formatSupermarketLabel(supermarketName),
            supermarketId: getSupermarketId(supermarket),
            currency: price.currency || 'TRY',
        };
    }).filter(Boolean);

    const merged = [...historyPoints, ...currentPoints];
    const unique = new Map();

    merged.forEach((item) => {
        const key = `${item.supermarketId || 'unknown'}-${item.date}-${item.price}`;
        if (!unique.has(key)) unique.set(key, item);
    });

    return [...unique.values()].sort((a, b) => a.date - b.date);
};

const ChartEmptyState = ({ title, subtitle }) => (
    <div className="h-56 sm:h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700/50 text-center p-8">
        <div className="inline-flex items-center justify-center p-5 bg-gray-100 dark:bg-gray-900/50 rounded-full border border-gray-200 dark:border-gray-700 mb-4">
            <FiBarChart2 className="text-gray-300 dark:text-gray-600" size={28} />
        </div>
        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">{title}</h4>
        {subtitle ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed mt-2 max-w-[220px]">
                {subtitle}
            </p>
        ) : null}
    </div>
);

const PriceHistoryChart = ({ productId, productName, currentPrices = [] }) => {
    const { t } = useTranslation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('1m'); // 1d, 7d, 1m, 3m, 6m, 1y
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const filterOptions = [
        { label: '1D', value: '1d' },
        { label: '7D', value: '7d' },
        { label: '1M', value: '1m' },
        { label: '3M', value: '3m' },
        { label: '6M', value: '6m' },
        { label: '1Y', value: '1y' },
    ];

    useEffect(() => {
        const loadHistory = async () => {
            if (!productId || typeof productId !== 'string' || productId.length < 5) {
                setLoading(false);
                setHistory([]);
                return;
            }

            const currentSig = buildCurrentPricesSignature(currentPrices);
            const key = `price-history-chart:${productId}:${currentSig}`;
            const fetcher = async () => {
                const data = await fetchPriceHistory(productId);
                return buildChartHistory(data, currentPrices);
            };

            try {
                const { data, fromCache, refreshing: willRefresh } = await swrGetOrFetch(key, {
                    ttlMs: PRICE_HISTORY_CHART_TTL_MS,
                    fetcher,
                    onUpdate: (next) => {
                        setHistory(Array.isArray(next) ? next : []);
                        setLoading(false);
                    },
                });

                if (fromCache && data) {
                    setHistory(Array.isArray(data) ? data : []);
                    setLoading(willRefresh);
                } else {
                    setLoading(true);
                    const entry = getCacheEntry(key);
                    const awaited = entry?.promise ? await entry.promise : await fetcher();
                    setHistory(Array.isArray(awaited) ? awaited : []);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error loading history:', error);
                setHistory([]);
                setLoading(false);
            }
        };

        loadHistory();
    }, [productId, currentPrices]);

    const filteredData = useMemo(() => {
        if (!history.length) return [];
        const latest = history.reduce((max, item) => Math.max(max, item?.date || 0), 0);
        if (!latest) return history;
        const intervals = {
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '1m': 30 * 24 * 60 * 60 * 1000,
            '3m': 90 * 24 * 60 * 60 * 1000,
            '6m': 180 * 24 * 60 * 60 * 1000,
            '1y': 365 * 24 * 60 * 60 * 1000,
        };

        const cutoff = latest - (intervals[filter] || intervals['1m']);
        return history.filter(item => item.date >= cutoff);
    }, [history, filter]);

    const showPointLabels = !isMobile && filteredData.length <= 12;

    const renderDot = (props) => {
        const { cx, cy, payload } = props;
        if (cx == null || cy == null) return null;

        return (
            <g>
                <circle cx={cx} cy={cy} r={3} fill="#4f46e5" />
                {showPointLabels && payload?.supermarketLabel && (
                    <text
                        x={cx}
                        y={cy - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="600"
                        fill="#9ca3af"
                    >
                        {payload.supermarketLabel}
                    </text>
                )}
            </g>
        );
    };

    const formatXAxisTick = (value) => {
        const dateObj = new Date(value);
        if (filter === '1d') {
            return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        if (filter === '7d') {
            return dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
        }
        return dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
    };

    const stats = useMemo(() => {
        if (!filteredData.length) return null;
        const prices = filteredData.map((d) => Number(convert(d.price, d.currency || 'TRY')));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const latest = prices[prices.length - 1];
        const first = prices[0];
        const change = ((latest - first) / first * 100).toFixed(1);
        
        return { min, max, latest, change };
    }, [filteredData, convert]);

    if (loading) return (
        <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="animate-pulse text-gray-400 font-medium">Loading Price Insights...</div>
        </div>
    );

    if (history.length === 0) {
        return (
            <ChartEmptyState
                title={t('no_available_data')}
                subtitle={t('no_data_yet_subtitle')}
            />
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <FiTrendingUp className="text-brand-600" />
                        Price Timeline
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Tracking {productName} across all stores</p>
                </div>

                <div className="flex w-full sm:w-auto bg-gray-100 dark:bg-gray-700 p-1 rounded-lg self-start justify-between sm:justify-start overflow-x-auto scrollbar-none">
                    {filterOptions.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`tap-target min-h-11 px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs font-black rounded-md transition-all ${
                                filter === opt.value 
                                    ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-500 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
                    <div className="bg-brand-50 dark:bg-brand-900/20 p-2 sm:p-3 rounded-xl border border-brand-100 dark:border-brand-800 text-center sm:text-left min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-bold text-brand-600 dark:text-brand-500 uppercase truncate">Lowest</p>
                        <p className="text-xs sm:text-sm font-black text-gray-800 dark:text-white truncate">
                            {stats.min.toFixed(2)} {getCurrencySymbol()}
                        </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded-xl border border-red-100 dark:border-red-800 text-center sm:text-left min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-bold text-red-600 dark:text-red-400 uppercase truncate">Highest</p>
                        <p className="text-xs sm:text-sm font-black text-gray-800 dark:text-white truncate">
                            {stats.max.toFixed(2)} {getCurrencySymbol()}
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 sm:p-3 rounded-xl border border-gray-100 dark:border-gray-600 text-center sm:text-left min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase truncate">Trend</p>
                        <p className={`text-xs sm:text-sm font-black flex items-center justify-center sm:justify-start gap-0.5 sm:gap-1 ${parseFloat(stats.change) <= 0 ? 'text-green-600' : 'text-red-600'} truncate`}>
                            {parseFloat(stats.change) <= 0 ? <FiTrendingDown className="shrink-0" /> : <FiTrendingUp className="shrink-0" />}
                            <span>{stats.change}%</span>
                        </p>
                    </div>
                </div>
            )}

            <div className="h-56 sm:h-64 w-full">
                {filteredData.length === 0 ? (
                    <ChartEmptyState title={t('no_available_data')} />
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredData} margin={{ top: 15, right: 5, left: 5, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                        <XAxis 
                            dataKey="date" 
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            scale="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
                            tickFormatter={formatXAxisTick}
                            minTickGap={20}
                        />
                        <YAxis 
                            hide 
                        />
                        <Tooltip 
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white dark:bg-gray-800 p-2 shadow-xl border border-gray-100 dark:border-gray-700 rounded-lg">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                {new Date(payload[0].payload.date).toLocaleString('tr-TR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                            <p className="text-sm font-black text-brand-600">
                                                {convert(payload[0].value, payload[0].payload.currency || 'TRY')} {getCurrencySymbol()}
                                            </p>
                                            <p className="text-[9px] font-medium text-gray-400">
                                                at {payload[0].payload.supermarket}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="price" 
                            stroke="#4f46e5" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorPrice)" 
                            animationDuration={1500}
                            dot={renderDot}
                        />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PriceHistoryChart;
