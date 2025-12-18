import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTag, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import useCategoriesStore from '../stores/categoriesStore';

const Categories = () => {
    const { categories, loading, fetchCategories, deleteCategory } = useCategoriesStore();
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        categoryName: '',
        icon: ''
    });

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Submitting category:', formData);
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

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                            ← Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Categories</h1>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <FiPlus /> Add Category
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((category) => (
                            <div
                                key={category.$id}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                            <FiTag className="text-blue-600 dark:text-blue-400 text-xl" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800 dark:text-white">{category.categoryName}</h3>
                                            {category.icon && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{category.icon}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(category)}
                                        className="flex-1 flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-2 rounded transition"
                                    >
                                        <FiEdit2 /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.$id)}
                                        className="flex-1 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-2 rounded transition"
                                    >
                                        <FiTrash2 /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                            {editingCategory ? 'Edit Category' : 'Add Category'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Category Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.categoryName}
                                    onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Icon
                                </label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="e.g., drink, food, snack"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingCategory(null);
                                        setFormData({ categoryName: '', icon: '' });
                                    }}
                                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    {editingCategory ? 'Update' : 'Create'}
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
