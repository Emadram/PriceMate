import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMessageSquare, FiTrash2, FiChevronUp, FiChevronDown, FiEye, FiCheckCircle, FiClock, FiAlertTriangle, FiArrowLeft, FiFilter, FiSearch, FiX } from 'react-icons/fi';
import useFeedbackStore from '../stores/feedbackStore';
import Sidebar from '../components/Sidebar';
import { client, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';

const Feedback = () => {
    const { feedback, loading, fetchFeedback, deleteFeedback, updateFeedbackStatus } = useFeedbackStore();
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: '$createdAt', direction: 'descending' });
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isFresh, setIsFresh] = useState(false);

    const refreshData = useCallback(async () => {
        await fetchFeedback();
        setLastUpdated(new Date().toISOString());
    }, [fetchFeedback]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        const channel = `databases.${DATABASE_ID}.collections.${COLLECTIONS.FEEDBACK}.documents`;
        const unsubscribe = client.subscribe(channel, () => {
            refreshData();
        });
        return () => unsubscribe();
    }, [refreshData]);

    useEffect(() => {
        if (!lastUpdated) return;
        setIsFresh(true);
        const timer = setTimeout(() => setIsFresh(false), 1200);
        return () => clearTimeout(timer);
    }, [lastUpdated]);

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this record?')) {
            await deleteFeedback(id);
        }
    };

    const handleResolve = async (id) => {
        await updateFeedbackStatus(id, 'resolved');
        if (selectedFeedback && selectedFeedback.$id === id) {
            setSelectedFeedback({ ...selectedFeedback, status: 'resolved' });
        }
    };

    const filteredFeedbackBySearch = feedback.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (item.userId || item.user_id || '').toLowerCase().includes(searchLower) ||
            (item.productId || item.targetId || '').toLowerCase().includes(searchLower) ||
            (item.issueType || item.type || '').toLowerCase().includes(searchLower) ||
            (item.content || item.message || item.reason || '').toLowerCase().includes(searchLower) ||
            (item.status || '').toLowerCase().includes(searchLower)
        );
    });

    const filteredFeedback = filteredFeedbackBySearch.filter(item => 
        filterStatus === 'all' || item.status === filterStatus
    );

    const sortedFeedback = [...filteredFeedback];
    if (sortConfig.key) {
        sortedFeedback.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

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

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? <FiChevronUp className="inline ml-1" /> : <FiChevronDown className="inline ml-1" />;
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">User Reports</h1>
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
                                placeholder="Search feedback, issues or user IDs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <button 
                                onClick={() => setFilterStatus('all')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            >
                                All Feedback
                            </button>
                            <button 
                                onClick={() => setFilterStatus('pending')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            >
                                <FiClock className="inline mr-1.5 mb-0.5" /> Pending
                            </button>
                            <button 
                                onClick={() => setFilterStatus('resolved')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'resolved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            >
                                <FiCheckCircle className="inline mr-1.5 mb-0.5" /> Resolved
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-500">Retrieving moderation queue...</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                            <th onClick={() => requestSort('type')} className="px-8 py-6 cursor-pointer group">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                    Classification <SortIcon columnKey="type" />
                                                </div>
                                            </th>
                                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Report Details</th>
                                            <th onClick={() => requestSort('status')} className="px-8 py-6 cursor-pointer group text-center">
                                                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                    Status <SortIcon columnKey="status" />
                                                </div>
                                            </th>
                                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {sortedFeedback.map((item) => (
                                            <tr key={item.$id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                                <td className="px-8 py-6 whitespace-nowrap">
                                                    <span className={`px-4 py-2 text-[10px] rounded-xl inline-flex items-center gap-2 font-black uppercase tracking-widest ${
                                                        item.type === 'bug' || item.targetType === 'product' 
                                                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20' :
                                                        item.type === 'feature' 
                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                                                        'bg-gray-50 text-gray-600 dark:bg-gray-900'
                                                    }`}>
                                                        {item.targetType ? <FiAlertTriangle className="w-3.5 h-3.5" /> : <FiMessageSquare className="w-3.5 h-3.5" />}
                                                        {item.targetType ? `${item.targetType} Report` : (item.type || 'General')}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 max-w-md">
                                                    <div className="flex flex-col gap-1.5">
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                                                            {item.message || item.reason || 'No description provided'}
                                                        </p>
                                                        <div className="flex items-center gap-3">
                                                            {item.targetId && (
                                                                <span className="text-[10px] font-black bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-lg text-gray-400">REF: {item.targetId.slice(-6).toUpperCase()}</span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                                                {new Date(item.$createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap text-center">
                                                    <span className={`px-3 py-1.5 text-[10px] rounded-lg font-black uppercase tracking-widest inline-block min-w-[100px] ${
                                                        item.status === 'resolved' 
                                                            ? 'text-emerald-500 bg-emerald-500/10' 
                                                            : 'text-amber-500 bg-amber-500/10 border border-amber-500/20'
                                                    }`}>
                                                        {item.status || 'pending'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 whitespace-nowrap text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                        <button
                                                            onClick={() => setSelectedFeedback(item)}
                                                            className="p-3 bg-blue-50 dark:bg-gray-900 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm"
                                                            title="Inspect Log"
                                                        >
                                                            <FiEye size={18} />
                                                        </button>
                                                        {item.status !== 'resolved' && (
                                                            <button
                                                                onClick={() => handleResolve(item.$id)}
                                                                className="p-3 bg-emerald-50 dark:bg-gray-900 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-2xl transition-all shadow-sm"
                                                                title="Mark Resolved"
                                                            >
                                                                <FiCheckCircle size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(item.$id)}
                                                            className="p-3 bg-red-50 dark:bg-gray-900 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl transition-all shadow-sm"
                                                            title="Purge"
                                                        >
                                                            <FiTrash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {sortedFeedback.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="px-8 py-24 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-[2rem] flex items-center justify-center">
                                                            <FiMessageSquare size={32} className="text-gray-200" />
                                                        </div>
                                                        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Systems Normalized</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Inspect Modal */}
            {selectedFeedback && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] max-w-xl w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Intelligence Brief</h2>
                            <button onClick={() => setSelectedFeedback(null)} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Signal Type</label>
                                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{selectedFeedback.type || selectedFeedback.targetType || 'General'}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Source Entity</label>
                                <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{selectedFeedback.userId || selectedFeedback.user_id || 'ANONYMOUS'}</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transmission Data</label>
                            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-bold">
                                    {selectedFeedback.message || selectedFeedback.reason}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${selectedFeedback.status === 'resolved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{selectedFeedback.status || 'PENDING'}</span>
                            </div>
                            <button
                                onClick={() => setSelectedFeedback(null)}
                                className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-transform"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Feedback;
