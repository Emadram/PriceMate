import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiEdit2, FiTrash2, FiPlus, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import useProductsStore from '../stores/productsStore';
import useCategoriesStore from '../stores/categoriesStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import { storage } from '../lib/appwrite';
import { ID } from 'appwrite';

const Products = () => {
    const { products, loading, fetchProducts, deleteProduct } = useProductsStore();
    const { categories, fetchCategories } = useCategoriesStore();
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();

    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        imageUrl: '',
        description: '',
        stockQuantity: 0,
        categoryId: '',
        supermarkets: ''
    });

    const [filterCategory, setFilterCategory] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    useEffect(() => {
        fetchProducts();
        fetchCategories();
        fetchSupermarkets();
    }, [fetchProducts, fetchCategories, fetchSupermarkets]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Upload to Appwrite Storage (Assuming bucket ID 'product-images' or use a default)
            // You might need to create this bucket in Appwrite Console if it doesn't exist.
            const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_PRODUCT_IMAGES || 'product-images'; // Ensure this exists!
            const response = await storage.createFile(BUCKET_ID, ID.unique(), file);

            // Construct View URL
            // https://cloud.appwrite.io/v1/storage/buckets/[BUCKET_ID]/files/[FILE_ID]/view?project=[PROJECT_ID]
            const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
            const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

            const imageUrl = `${endpoint}/storage/buckets/${BUCKET_ID}/files/${response.$id}/view?project=${projectId}`;

            setFormData(prev => ({ ...prev, imageUrl }));
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('Image upload failed. Please check if the "product-images" Storage Bucket exists and verify permissions.');
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
        setFormData({
            name: '',
            barcode: '',
            imageUrl: '',
            description: '',
            stockQuantity: 0,
            categoryId: '',
            supermarkets: ''
        });
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        // categoryId might be an object (if expanded) or a string (if not)
        const catId = product.categoryId && typeof product.categoryId === 'object'
            ? product.categoryId.$id
            : product.categoryId;

        setFormData({
            name: product.name,
            barcode: product.barcode,
            imageUrl: product.imageUrl || '',
            description: product.description || '',
            stockQuantity: product.stockQuantity || 0,
            categoryId: catId || '',
            supermarkets: product.supermarkets?.$id || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            await deleteProduct(id);
        }
    };

    const getCategoryName = (product) => {
        // If it's an object with categoryName, returns it
        if (product.categoryId && typeof product.categoryId === 'object') {
            return product.categoryId.categoryName || 'N/A';
        }
        // If it's a string ID, find it in the categories list
        if (product.categoryId && typeof product.categoryId === 'string') {
            const cat = categories.find(c => c.$id === product.categoryId);
            return cat ? cat.categoryName : 'N/A';
        }
        return 'N/A';
    };

    const filteredProducts = products.filter(product => {
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

            // Handle special cases
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
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Products</h1>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <FiPlus /> Add Product
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
                    <div className="max-w-md">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Category</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => (
                                <option key={c.$id} value={c.$id}>{c.categoryName}</option>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Image</th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('name')}
                                    >
                                        Name <SortIcon columnKey="name" />
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('barcode')}
                                    >
                                        Barcode <SortIcon columnKey="barcode" />
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('category')}
                                    >
                                        Category <SortIcon columnKey="category" />
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => requestSort('stockQuantity')}
                                    >
                                        Stock <SortIcon columnKey="stockQuantity" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedProducts.map((product) => (
                                    <tr key={product.$id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded" />
                                                ) : (
                                                    <FiPackage className="text-gray-400" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{product.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{product.barcode}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{getCategoryName(product)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{product.stockQuantity}</td>
                                        <td className="px-6 py-4 text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleEdit(product)}
                                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center gap-1"
                                            >
                                                <FiEdit2 /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.$id)}
                                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 inline-flex items-center gap-1"
                                            >
                                                <FiTrash2 /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No products found matching filters.
                            </div>
                        )}
                    </div>
                )
                }
            </main >

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 my-8">
                        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                            {editingProduct ? 'Edit Product' : 'Add Product'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Barcode *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Product Image
                                </label>
                                <div className="flex gap-4 items-center">
                                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">
                                        {formData.imageUrl ? (
                                            <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <FiPackage size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                            className="block w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-blue-50 file:text-blue-700
                                                hover:file:bg-blue-100
                                                dark:file:bg-blue-900 dark:file:text-blue-300
                                            "
                                        />
                                        {uploading && <p className="text-sm text-blue-600 mt-1">Uploading...</p>}
                                        <input
                                            type="text"
                                            placeholder="Or enter URL manually"
                                            value={formData.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                            className="mt-2 w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={formData.categoryId}
                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map((cat) => (
                                            <option key={cat.$id} value={cat.$id}>{cat.categoryName}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Removed Supermarket select as Products are global, Prices link to Supermarkets */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Stock Quantity
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.stockQuantity}
                                        onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    rows="3"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingProduct(null);
                                        setFormData({
                                            name: '',
                                            barcode: '',
                                            imageUrl: '',
                                            description: '',
                                            stockQuantity: 0,
                                            categoryId: '',
                                        });
                                    }}
                                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {editingProduct ? 'Update Product' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
