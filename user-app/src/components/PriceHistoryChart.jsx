import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiCalendar } from 'react-icons/fi';
import { fetchPriceHistory } from '../utils/productUtils';
import useCurrencyStore from '../stores/currencyStore';

const PriceHistoryChart = ({ productId, productName }) => {
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('1m'); // 1d, 7d, 1m, 3m, 6m, 1y

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
            setLoading(true);
            const data = await fetchPriceHistory(productId);
            
            // Format data for Recharts
            const formattedData = data.map(item => ({
                date: new Date(item.$createdAt).getTime(),
                displayDate: new Date(item.$createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
                price: item.price,
                supermarket: Array.isArray(item.supermarkets) ? item.supermarkets[0]?.name : (item.supermarketName || 'Store')
            })).sort((a, b) => a.date - b.date);

            setHistory(formattedData);
            setLoading(false);
        };

        if (productId) {
            loadHistory();
        }
    }, [productId]);

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

    const stats = useMemo(() => {
        if (!filteredData.length) return null;
        const prices = filteredData.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const latest = filteredData[filteredData.length - 1].price;
        const first = filteredData[0].price;
        const change = ((latest - first) / first * 100).toFixed(1);
        
        return { min, max, latest, change };
    }, [filteredData]);

    if (loading) return (
        <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="animate-pulse text-gray-400 font-medium">Loading Price Insights...</div>
        </div>
    );

    if (history.length === 0) return (
        <div className="h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center p-6">
            <FiCalendar className="text-3xl text-gray-300 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">No historical price data available yet.</p>
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
                            {convert(stats.min, 'TRY')} {getCurrencySymbol()}
                        </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800">
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Highest</p>
                        <p className="text-sm font-black text-gray-800 dark:text-white">
                            {convert(stats.max, 'TRY')} {getCurrencySymbol()}
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
                            dataKey="displayDate" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
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
                                                {new Date(payload[0].payload.date).toLocaleDateString('tr-TR')}
                                            </p>
                                            <p className="text-sm font-black text-blue-600">
                                                {convert(payload[0].value, 'TRY')} {getCurrencySymbol()}
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
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PriceHistoryChart;
