import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiCalendar } from 'react-icons/fi';
import { fetchPriceHistory } from '../utils/productUtils';
import useCurrencyStore from '../stores/currencyStore';

const PriceHistoryChart = ({ productId, productName, currentPrices = [] }) => {
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('1m'); // 1d, 7d, 1m, 3m, 6m, 1y

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
            
            setLoading(true);
            try {
                const data = await fetchPriceHistory(productId);
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
                        currency: item.currency || 'TRY'
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
                        currency: price.currency || 'TRY'
                    };
                }).filter(Boolean);

                const merged = [...historyPoints, ...currentPoints];
                const unique = new Map();

                merged.forEach((item) => {
                    const key = `${item.supermarketId || 'unknown'}-${item.date}-${item.price}`;
                    if (!unique.has(key)) unique.set(key, item);
                });

                const formattedData = [...unique.values()].sort((a, b) => a.date - b.date);
                setHistory(formattedData);
            } catch (error) {
                console.error('Error loading history:', error);
                setHistory([]);
            }
            setLoading(false);
        };

        loadHistory();
    }, [productId, currentPrices]);

    const filteredData = useMemo(() => {
        if (!history.length) return [];
        
        const now = Date.now();
        const intervals = {
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '1m': 30 * 24 * 60 * 60 * 1000,
            '3m': 90 * 24 * 60 * 60 * 1000,
            '6m': 180 * 24 * 60 * 60 * 1000,
            '1y': 365 * 24 * 60 * 60 * 1000,
        };

        const cutoff = now - (intervals[filter] || intervals['1m']);
        return history.filter(item => item.date >= cutoff);
    }, [history, filter]);

    const showPointLabels = filteredData.length <= 12;

    const renderDot = (props) => {
        const { cx, cy, payload } = props;
        if (cx == null || cy == null) return null;

        return (
            <g>
                <circle cx={cx} cy={cy} r={3} fill="#2563eb" />
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
    }, [filteredData]);

    if (loading) return (
        <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="animate-pulse text-gray-400 font-medium">Loading Price Insights...</div>
        </div>
    );

    if (history.length === 0) return (
        <div className="h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700/50 text-center p-8 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10 space-y-4">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-2 text-blue-500/50 group-hover:scale-110 transition-transform duration-500">
                    <FiCalendar size={32} />
                </div>
                <div className="max-w-[200px] mx-auto">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Pulse Needed</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                        Once users start contributing prices, we'll track the deals and trends here!
                    </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded-lg border border-blue-600/20">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                    Awaiting First Data Point
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <FiTrendingUp className="text-blue-600" />
                        Price Timeline
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Tracking {productName} across all stores</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg self-start">
                    {filterOptions.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${
                                filter === opt.value 
                                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Lowest</p>
                        <p className="text-sm font-black text-gray-800 dark:text-white">
                            {stats.min.toFixed(2)} {getCurrencySymbol()}
                        </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800">
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Highest</p>
                        <p className="text-sm font-black text-gray-800 dark:text-white">
                            {stats.max.toFixed(2)} {getCurrencySymbol()}
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Trend</p>
                        <p className={`text-sm font-black flex items-center gap-1 ${parseFloat(stats.change) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseFloat(stats.change) <= 0 ? <FiTrendingDown /> : <FiTrendingUp />}
                            {stats.change}%
                        </p>
                    </div>
                </div>
            )}

            <div className="h-64 w-full">
                {filteredData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700/50 text-center p-8">
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest">No data in this range</div>
                        <div className="text-[11px] text-gray-400 mt-2">Try a longer range to see more points.</div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredData}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
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
                                            <p className="text-sm font-black text-blue-600">
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
                            stroke="#2563eb" 
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
