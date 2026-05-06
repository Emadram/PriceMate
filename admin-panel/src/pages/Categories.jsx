import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTag, FiEdit2, FiTrash2, FiPlus, FiChevronUp, FiChevronDown, FiArrowLeft, FiSearch } from 'react-icons/fi';
import useCategoriesStore from '../stores/categoriesStore';
import Sidebar from '../components/Sidebar';
import { CATEGORY_ICON_ELEMENTS, CATEGORY_ICON_KEYS } from '../constants/categoryIconMap';

const Categories = () => {
    const { categories, loading, fetchCategories, deleteCategory } = useCategoriesStore();
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        categoryName: '',
        icon: ''
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const store = useCategoriesStore.getState();

        try {
            let success;
            if (editingCategory) {
                success = await store.updateCategory(editingCategory.$id, formData);
            } else {
                success = await store.addCategory(formData);
            }

            if (success) {
                setShowModal(false);
                setEditingCategory(null);
                setFormData({ categoryName: '', icon: '' });
            } else {
                alert('Failed to save category. Check console for details.');
            }
        } catch (error) {
            console.error('Category submit error:', error);
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({
            categoryName: category.categoryName,
            icon: category.icon || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure? This will affect all products in this category.')) {
            await deleteCategory(id);
        }
    };

    const filteredCategories = categories.filter(cat => 
        cat.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.icon?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedCategories = [...filteredCategories];
    if (sortConfig.key) {
        sortedCategories.sort((a, b) => {
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
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <div className="flex-1 overflow-x-hidden flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Categories</h1>
                        <div className="relative group max-w-md w-full ml-4 hidden md:block">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search categorized assets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => { setShowModal(true); setEditingCategory(null); setFormData({ categoryName: '', icon: '' }); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                    >
                        <FiPlus size={20} className="stroke-[3]" />
                        <span className="hidden sm:inline">New Category</span>
                    </button>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                    <div className="mb-8 flex items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Structural Overview</span>
                            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Active Classifications</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Index Count:</span>
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800/50">
                                {categories.length} Nodes
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Synchronizing Taxonomy...</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <th
                                            className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('categoryName')}
                                        >
                                            Classification <SortIcon columnKey="categoryName" />
                                        </th>
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em]">Iconic Identifier</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {sortedCategories.map((category) => (
                                        <tr key={category.$id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 rounded-[1.5rem] flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 group-hover:scale-105 transition-transform">
                                                        <FiTag size={24} className="stroke-[2.5]" />
                                                    </div>
                                                    <div className="ml-5">
                                                        <div className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                            {category.categoryName}
                                                        </div>
                                                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Category ID: {category.$id.slice(-6)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-900 text-xl text-blue-600 dark:text-blue-400 border border-gray-100 dark:border-gray-800">
                                                        {category.icon && CATEGORY_ICON_ELEMENTS[category.icon]
                                                            ? CATEGORY_ICON_ELEMENTS[category.icon]
                                                            : CATEGORY_ICON_ELEMENTS.default}
                                                    </div>
                                                    <span className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800 max-w-[10rem] truncate">
                                                        {category.icon || 'default'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(category)}
                                                        className="p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50"
                                                    >
                                                        <FiEdit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(category.$id)}
                                                        className="p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-red-100 dark:hover:border-red-800/50"
                                                    >
                                                        <FiTrash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedCategories.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="px-8 py-24 text-center">
                                                <div className="flex flex-col items-center">
                                                    <FiTag size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Null Reference: No categories matched</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                                {editingCategory ? 'Update Class' : 'Define New Class'}
                            </h2>
                            <button onClick={() => { setShowModal(false); setEditingCategory(null); }} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl">
                                <FiArrowLeft size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Label</label>
                                <input
                                    type="text"
                                    value={formData.categoryName}
                                    onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white font-bold transition-all"
                                    placeholder="Enter category name..."
                                    required
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category icon</label>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium px-1">
                                    Selected:{' '}
                                    <span className="font-bold text-gray-800 dark:text-gray-200 inline-flex items-center gap-2">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-lg">
                                            {(formData.icon && CATEGORY_ICON_ELEMENTS[formData.icon]
                                                ? CATEGORY_ICON_ELEMENTS[formData.icon]
                                                : CATEGORY_ICON_ELEMENTS.default)}
                                        </span>
                                        {formData.icon || 'Default (keyword match in app)'}
                                    </span>
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, icon: '' })}
                                        className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${
                                            !formData.icon
                                                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-500/40'
                                                : 'border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 hover:border-gray-200 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200/80 dark:bg-gray-700 text-gray-500 text-lg">
                                            <FiTag size={20} />
                                        </span>
                                        <span className="text-[8px] font-black uppercase tracking-tighter text-center text-gray-500 leading-tight">
                                            Default
                                        </span>
                                    </button>
                                    {CATEGORY_ICON_KEYS.map((key) => (
                                        <button
                                            type="button"
                                            key={key}
                                            onClick={() => setFormData({ ...formData, icon: key })}
                                            title={key}
                                            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${
                                                formData.icon === key
                                                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-500/40'
                                                    : 'border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 hover:border-gray-200 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-xl shadow-sm border border-gray-100/80 dark:border-gray-700">
                                                {CATEGORY_ICON_ELEMENTS[key]}
                                            </span>
                                            <span className="text-[8px] font-black uppercase tracking-tighter text-center text-gray-600 dark:text-gray-400 leading-tight line-clamp-2 w-full break-all">
                                                {key}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                >
                                    {editingCategory ? 'Commit Update' : 'Initialize Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;
