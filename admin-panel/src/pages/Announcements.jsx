import { useCallback, useEffect, useState } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { FiPlus, FiEdit2, FiTrash2, FiBell, FiCheckCircle, FiXCircle, FiZap, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import useAnnouncementsStore from '../stores/announcementsStore';
import Sidebar from '../components/Sidebar';
import { DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import useDebouncedRealtimeRefresh from '../hooks/useDebouncedRealtimeRefresh';

const ANNOUNCEMENT_CATEGORY_OPTIONS = [
    { value: 'general', label: 'General' },
    { value: 'offer', label: 'Special offer' },
    { value: 'alert', label: 'Urgent alert' },
    { value: 'info', label: 'Information' },
];

const Announcements = () => {
    const { announcements, loading, fetchAnnouncements, addAnnouncement, updateAnnouncement, deleteAnnouncement } = useAnnouncementsStore();
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({
        text: '',
        category: 'general',
        active: true
    });
    const [lastUpdated, setLastUpdated] = useState(null);
    const isFresh = useFreshIndicator(lastUpdated);

    const refreshData = useCallback(async () => {
        await fetchAnnouncements();
        setLastUpdated(new Date().toISOString());
    }, [fetchAnnouncements]);

    useEffect(() => {
        const t = setTimeout(() => refreshData(), 0);
        return () => clearTimeout(t);
    }, [refreshData]);

    const announcementsChannel = `databases.${DATABASE_ID}.collections.${COLLECTIONS.ANNOUNCEMENTS}.documents`;
    useDebouncedRealtimeRefresh(announcementsChannel, () => refreshData());

    // `isFresh` indicator handled by useFreshIndicator to avoid rapid flicker

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const success = editing 
                ? await updateAnnouncement(editing.$id, formData)
                : await addAnnouncement(formData);
            
            if (success) {
                setShowModal(false);
                setEditing(null);
                setFormData({ text: '', category: 'general', active: true });
            }
        } catch (error) {
            console.error('Operation failed:', error);
        }
    };

    const handleEdit = (announcement) => {
        setEditing(announcement);
        setFormData({
            text: announcement.text,
            category: announcement.category || 'general',
            active: announcement.active
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this announcement?')) {
            await deleteAnnouncement(id);
        }
    };

    const getCategoryStyles = (category) => {
        switch (category) {
            case 'offer': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'alert': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'info': return 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const categoryPickerClasses = (value, selected) => {
        const base = 'flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 text-left transition-all';
        if (!selected) {
            return `${base} border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-500`;
        }
        switch (value) {
            case 'offer':
                return `${base} border-green-500 bg-green-50 dark:bg-green-900/25 ring-2 ring-green-500/30`;
            case 'alert':
                return `${base} border-red-500 bg-red-50 dark:bg-red-900/25 ring-2 ring-red-500/30`;
            case 'info':
                return `${base} border-brand-500 bg-brand-50 dark:bg-brand-900/25 ring-2 ring-brand-500/30`;
            default:
                return `${base} border-gray-500 bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-400/30`;
        }
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'offer': return <FiZap className="text-green-600 dark:text-green-400" size={22} />;
            case 'alert': return <FiAlertTriangle className="text-red-600 dark:text-red-400" size={22} />;
            case 'info': return <FiInfo className="text-brand-700 dark:text-brand-300" size={22} />;
            default: return <FiBell className="text-gray-600 dark:text-gray-400" size={22} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <Sidebar />

            <div className="flex-1">
                <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-30">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">Announcements</h1>
                            <span className="bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Live
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isFresh ? 'text-green-600' : 'text-gray-400'}`}>
                                Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
                        >
                            <FiPlus className="stroke-[3]" /> <span className="font-semibold">Create Message</span>
                        </button>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8">
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Active Ticker Feed</h2>
                        <p className="text-gray-500 dark:text-gray-400">Manage messages currently visible to users in the app's scrolling news bar.</p>
                    </div>

                <div className="grid gap-4">
                    {loading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                        </div>
                    )}
                    
                    {!loading && announcements.length === 0 && (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <FiBell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 text-lg">No announcements found. Add your first tracker message!</p>
                        </div>
                    )}

                    {announcements.map((item) => (
                        <div key={item.$id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between group hover:border-brand-300 dark:hover:border-brand-800 transition-all">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className={`p-3 rounded-xl bg-gray-50 dark:bg-gray-900 text-xl`}>
                                    {getCategoryIcon(item.category)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                        <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full tracking-wider shadow-sm ${getCategoryStyles(item.category)}`}>
                                            {item.category}
                                        </span>
                                        {!item.active && (
                                            <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                                                <FiXCircle className="w-3 h-3" /> Draft
                                            </span>
                                        )}
                                        {item.active && (
                                            <span className="text-[10px] uppercase font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                                                <FiCheckCircle className="w-3 h-3" /> Published
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-800 dark:text-gray-200 font-medium text-lg leading-snug truncate md:whitespace-normal">
                                        {item.text}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                <button 
                                    onClick={() => handleEdit(item)} 
                                    className="p-3 text-gray-500 hover:text-brand-700 dark:hover:text-brand-300 bg-gray-50 dark:bg-gray-700 hover:bg-brand-50 dark:hover:bg-brand-900/40 rounded-xl transition-all"
                                    title="Edit"
                                >
                                    <FiEdit2 size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(item.$id)} 
                                    className="p-3 text-gray-500 hover:text-red-600 bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-xl transition-all"
                                    title="Delete"
                                >
                                    <FiTrash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{editing ? 'Edit' : 'Add'} Announcement</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <FiXCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Announcement Message</label>
                                <textarea
                                    required
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-transparent p-4 text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-all"
                                    rows="4"
                                    value={formData.text}
                                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                                    placeholder="Flash Sale! 50% off on all organic fruits..."
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Category</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {ANNOUNCEMENT_CATEGORY_OPTIONS.map(({ value, label }) => {
                                        const selected = formData.category === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, category: value })}
                                                className={categoryPickerClasses(value, selected)}
                                            >
                                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/90 dark:bg-gray-950/50 shadow-sm border border-gray-100 dark:border-gray-700">
                                                    {getCategoryIcon(value)}
                                                </span>
                                                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="inline-flex items-center cursor-pointer group py-3 relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    />
                                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 dark:peer-focus:ring-brand-800/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                                    <span className="ml-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">Published</span>
                                </label>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-600/30 transition-all active:scale-95"
                                >
                                    {editing ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default Announcements;
