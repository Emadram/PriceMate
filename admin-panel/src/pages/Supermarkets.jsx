import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiMapPin, FiPhone, FiMail, FiChevronUp, FiChevronDown, FiX, FiSearch, FiShoppingBag } from 'react-icons/fi';
import useSupermarketsStore from '../stores/supermarketsStore';
import Sidebar from '../components/Sidebar';
import { validateSupermarketCoordinates } from '../utils/coordinateValidation';

const Supermarkets = () => {
    const { supermarkets, loading, fetchSupermarkets, deleteSupermarket, uploadSupermarketLogo } = useSupermarketsStore();
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [coordinateError, setCoordinateError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        brand: '',
        branchName: '',
        latitude: '',
        longitude: '',
        address: '',
        phoneNumber: '',
        email: '',
        icon: '',
        isParent: false,
        parentId: ''
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    useEffect(() => {
        const t = setTimeout(() => fetchSupermarkets(), 0);
        return () => clearTimeout(t);
    }, [fetchSupermarkets]);

    const filteredSupermarkets = supermarkets.filter(sm => 
        (sm.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (sm.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (sm.branchName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (sm.address?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const imageUrl = await uploadSupermarketLogo(file);
            if (imageUrl) {
                setFormData(prev => ({ ...prev, icon: imageUrl }));
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('Image upload failed. Ensure the supermarkets logo bucket exists.');
        }
        setUploading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const store = useSupermarketsStore.getState();
        const nextCoordinateError = validateSupermarketCoordinates(formData.latitude, formData.longitude);
        if (nextCoordinateError) {
            setCoordinateError(nextCoordinateError);
            return;
        }
        const data = {
            ...formData,
            latitude: Number(formData.latitude),
            longitude: Number(formData.longitude),
            isParent: formData.isParent,
            parentId: formData.isParent ? null : formData.parentId
        };

        const saved = editing
            ? await store.updateSupermarket(editing.$id, data)
            : await store.addSupermarket(data);

        if (!saved) {
            setCoordinateError(useSupermarketsStore.getState().error || nextCoordinateError || 'Unable to save supermarket.');
            return;
        }

        setShowModal(false);
        setEditing(null);
        setCoordinateError('');
        resetForm();
    };

    const resetForm = () => {
        setFormData({ name: '', brand: '', branchName: '', latitude: '', longitude: '', address: '', phoneNumber: '', email: '', icon: '', isParent: false, parentId: '' });
        setCoordinateError('');
    };

    const handleEdit = (supermarket) => {
        setEditing(supermarket);
        setFormData({
            name: supermarket.name,
            brand: supermarket.brand || '',
            branchName: supermarket.branchName || '',
            latitude: supermarket.latitude ?? '',
            longitude: supermarket.longitude ?? '',
            address: supermarket.address || '',
            phoneNumber: supermarket.phoneNumber || '',
            email: supermarket.email || '',
            icon: supermarket.icon || '',
            isParent: supermarket.isParent || false,
            parentId: supermarket.parentId || ''
        });
        setCoordinateError('');
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this supermarket?')) {
            await deleteSupermarket(id);
        }
    };

    const sortedSupermarkets = [...filteredSupermarkets];
    if (sortConfig.key) {
        sortedSupermarkets.sort((a, b) => {
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

    // SortIcon hoisted to ../components/SortIcon

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10 p-6 flex justify-between items-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Supermarkets</h1>
                        <div className="relative group max-w-md w-full ml-4 hidden md:block">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Find store, brand or address..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                    >
                        <FiPlus size={20} className="stroke-[3]" /> Add Branch
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
                                        <th
                                            className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('name')}
                                        >
                                            Supermarket <SortIcon columnKey="name" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                        </th>
                                        <th
                                            className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => requestSort('address')}
                                        >
                                            Contact <SortIcon columnKey="address" currentKey={sortConfig.key} direction={sortConfig.direction} />
                                        </th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Coordinates</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {sortedSupermarkets.map((item) => (
                                        <tr key={item.$id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-14 w-14 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                        {item.icon ? (
                                                            <img className="h-14 w-14 rounded-2xl object-cover shadow-sm border border-gray-100 dark:border-gray-700" src={item.icon} alt="" />
                                                        ) : (
                                                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400 font-black text-xl border border-green-100/50 dark:border-green-800/30">
                                                                {item.name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-5">
                                                        <div className="text-base font-black text-gray-900 dark:text-white tracking-tight uppercase">
                                                            {item.brand ? `${item.brand}` : item.name}
                                                        </div>
                                                        <div className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mt-0.5">
                                                            {item.branchName || 'Primary Store'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2 font-bold mb-1.5"><FiMapPin className="text-blue-500 text-xs" /> {item.address || 'Location Hidden'}</div>
                                                <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-2 font-black uppercase tracking-widest"><FiPhone className="text-gray-300" /> {item.phoneNumber || 'No Contact'}</div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                                                <span className={`px-3 py-1.5 rounded-xl border font-black ${
                                                    validateSupermarketCoordinates(item.latitude, item.longitude)
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                                        : 'bg-gray-50/80 dark:bg-gray-900/80 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                                                }`}>
                                                    {validateSupermarketCoordinates(item.latitude, item.longitude)
                                                        ? 'Needs location fix'
                                                        : Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
                                                        ? `${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`
                                                        : '—'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
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
                </main>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{editing ? 'Edit Store' : 'Add Store'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 dark:bg-gray-900 p-2 rounded-xl"><FiX size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex gap-6 items-start">
                                <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-[2rem] overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center group relative cursor-pointer shadow-inner">
                                    {formData.icon ? (
                                        <img src={formData.icon} alt="Logo" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 font-black text-xs uppercase text-center p-2 opacity-60">
                                            <FiShoppingBag size={24} className="mb-1" /> Photo
                                        </div>
                                    )}
                                    <input type="file" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Logo Upload</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                        />
                                        {uploading && <p className="text-xs text-blue-600 mt-1 animate-pulse">Uploading...</p>}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                                        </div>
                                        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                                            <span className="px-2 bg-white dark:bg-gray-800 text-gray-400">OR</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon URL</label>
                                        <input
                                            type="text"
                                            placeholder="https://example.com/logo.png"
                                            value={formData.icon}
                                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                    <select
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={formData.isParent}
                                        onChange={(e) => setFormData({ ...formData, isParent: e.target.value === 'true' })}
                                    >
                                        <option value="true">Main Brand (Parent)</option>
                                        <option value="false">Branch (Child)</option>
                                    </select>
                                </div>
                                {!formData.isParent && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent Brand</label>
                                        <select
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            value={formData.parentId}
                                            onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                                            required={!formData.isParent}
                                        >
                                            <option value="">Select Brand...</option>
                                            {supermarkets.filter(s => s.isParent).map(s => (
                                                <option key={s.$id} value={s.$id}>{s.name || s.brand}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Carrefour"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch/Specific Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Downtown Branch"
                                        value={formData.branchName}
                                        onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude *</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.latitude}
                                        onChange={(e) => {
                                            setFormData({ ...formData, latitude: e.target.value });
                                            setCoordinateError('');
                                        }}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude *</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.longitude}
                                        onChange={(e) => {
                                            setFormData({ ...formData, longitude: e.target.value });
                                            setCoordinateError('');
                                        }}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>
                            {coordinateError && (
                                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl px-4 py-3">
                                    {coordinateError}
                                </p>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    rows="2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}
                                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || !!validateSupermarketCoordinates(formData.latitude, formData.longitude)}
                                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
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

export default Supermarkets;
