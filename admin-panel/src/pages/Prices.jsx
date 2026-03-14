import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiEdit2 } from 'react-icons/fi';
import usePricesStore from '../stores/pricesStore';
import useProductsStore from '../stores/productsStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import useAdminAuthStore from '../stores/adminAuthStore';

const Prices = () => {
    const { prices, loading, fetchPrices, addPrice, updatePrice, deletePrice } = usePricesStore();
    const { products, fetchProducts } = useProductsStore();
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();
    const adminUser = useAdminAuthStore((state) => state.user);

    const [showModal, setShowModal] = useState(false);
    const [editingPrice, setEditingPrice] = useState(null);
    const [formData, setFormData] = useState({
        price: '',
        currency: 'EGP',
        products: '',
        supermarkets: '',
        stockStatus: 'in_stock',
        userId: ''
    });

    const [filterProduct, setFilterProduct] = useState('');
    const [filterSupermarket, setFilterSupermarket] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    useEffect(() => {
        fetchPrices();
        fetchProducts();
        fetchSupermarkets();
    }, [fetchPrices, fetchProducts, fetchSupermarkets]);

    useEffect(() => {
        if (adminUser) {
            setFormData(prev => ({ ...prev, userId: adminUser.$id }));
        }
    }, [adminUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = editingPrice
            ? await updatePrice(editingPrice.$id, formData)
            : await addPrice(formData);

        if (success) {
            setShowModal(false);
            setEditingPrice(null);
            setFormData({
                price: '',
                currency: 'EGP',
                products: '',
                supermarkets: '',
                stockStatus: 'in_stock',
                userId: adminUser?.$id || ''
            });
        } else {
            alert('Failed to add price. Check console for details.');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this price?')) {
            await deletePrice(id);
        }
    };

    const handleEdit = (price) => {
        const productId = price.products && typeof price.products === 'object' ? price.products.$id : '';
        const supermarketId = price.supermarkets && typeof price.supermarkets === 'object' ? price.supermarkets.$id : '';

        setEditingPrice(price);
        setFormData({
            price: price.price ?? '',
            currency: price.currency || 'EGP',
            products: productId,
            supermarkets: supermarketId,
            stockStatus: price.stockStatus || 'in_stock',
            userId: adminUser?.$id || price.userId || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingPrice(null);
        setFormData({
            price: '',
            currency: 'EGP',
            products: '',
            supermarkets: '',
            stockStatus: 'in_stock',
            userId: adminUser?.$id || ''
        });
    };

    const getProductName = (price) => {
        if (price.products && typeof price.products === 'object') {
            return price.products.name || 'Unknown Product';
        }
        return 'Unknown Product';
    };

    const getSupermarketName = (price) => {
        if (price.supermarkets && typeof price.supermarkets === 'object') {
            return price.supermarkets.name || 'Unknown Store';
        }
        return 'Unknown Store';
    };

    const filteredPrices = prices.filter(price => {
        const matchesProduct = filterProduct ? (price.products?.$id === filterProduct) : true;
        const matchesSupermarket = filterSupermarket ? (price.supermarkets?.$id === filterSupermarket) : true;
        return matchesProduct && matchesSupermarket;
    });

    const sortedPrices = [...filteredPrices];
    if (sortConfig.key) {
        sortedPrices.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle special cases
            if (sortConfig.key === 'product') {
                aValue = getProductName(a);
                bValue = getProductName(b);
            } else if (sortConfig.key === 'supermarket') {
                aValue = getSupermarketName(a);
                bValue = getSupermarketName(b);
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

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? <FiChevronUp className="inline ml-1" /> : <FiChevronDown className="inline ml-1" />;
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                            ← Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Prices</h1>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <FiPlus /> Add Price
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Product</label>
                        <select
                            value={filterProduct}
                            onChange={(e) => setFilterProduct(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="">All Products</option>
                            {products.map(p => (
                                <option key={p.$id} value={p.$id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Supermarket</label>
                        <select
                            value={filterSupermarket}
                            onChange={(e) => setFilterSupermarket(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="">All Supermarkets</option>
                            {supermarkets.map(s => (
                                <option key={s.$id} value={s.$id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('product')}
                                    >
                                        Product <SortIcon columnKey="product" />
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('supermarket')}
                                    >
                                        Supermarket <SortIcon columnKey="supermarket" />
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('price')}
                                    >
                                        Price <SortIcon columnKey="price" />
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('currency')}
                                    >
                                        Currency <SortIcon columnKey="currency" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedPrices.map((price) => (
                                    <tr key={price.$id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{getProductName(price)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{getSupermarketName(price)}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-green-600 dark:text-green-400">
                                            {price.price}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{price.currency || 'EGP'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                price.stockStatus === 'in_stock' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                price.stockStatus === 'low_stock' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                                {price.stockStatus ? price.stockStatus.replace('_', ' ') : 'in stock'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button
                                                onClick={() => handleEdit(price)}
                                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center gap-1 mr-4"
                                            >
                                                <FiEdit2 /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(price.$id)}
                                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 inline-flex items-center gap-1"
                                            >
                                                <FiTrash2 /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredPrices.length === 0 && (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No prices found matching filters.
                            </div>
                        )}
                    </div>
                )}
            </main>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">{editingPrice ? 'Edit Price' : 'Add Price'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Product *
                                </label>
                                <select
                                    value={formData.products}
                                    onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                >
                                    <option value="">Select Product</option>
                                    {products.map((product) => (
                                        <option key={product.$id} value={product.$id}>
                                            {product.name} ({product.barcode})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Supermarket *
                                </label>
                                <select
                                    value={formData.supermarkets}
                                    onChange={(e) => setFormData({ ...formData, supermarkets: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                >
                                    <option value="">Select Supermarket</option>
                                    {supermarkets.map((sm) => (
                                        <option key={sm.$id} value={sm.$id}>
                                            {sm.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Currency
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="EGP"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Stock Status
                                    </label>
                                    <select
                                        value={formData.stockStatus || 'in_stock'}
                                        onChange={(e) => setFormData({ ...formData, stockStatus: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="in_stock">In Stock</option>
                                        <option value="low_stock">Low Stock</option>
                                        <option value="out_of_stock">Out of Stock</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    {editingPrice ? 'Save Changes' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Prices;
