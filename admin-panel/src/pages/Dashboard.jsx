import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingBag, FiDollarSign, FiMessageSquare, FiTag } from 'react-icons/fi';
import useAdminAuthStore from '../stores/adminAuthStore';

const Dashboard = () => {
    const admin = useAdminAuthStore((state) => state.admin);
    const logout = useAdminAuthStore((state) => state.logout);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">PriceMate Admin</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-700 dark:text-gray-300">Welcome, {admin?.name}</span>
                        <button
                            onClick={logout}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Management Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Link
                        to="/categories"
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-transparent dark:border-gray-700"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                                <FiTag className="text-purple-600 dark:text-purple-400 text-2xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Categories</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">Manage product categories</p>
                    </Link>

                    <Link
                        to="/products"
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-transparent dark:border-gray-700"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                <FiPackage className="text-blue-600 dark:text-blue-400 text-2xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Products</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">Manage products and inventory</p>
                    </Link>

                    <Link
                        to="/supermarkets"
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-transparent dark:border-gray-700"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <FiShoppingBag className="text-green-600 dark:text-green-400 text-2xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Supermarkets</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">Manage supermarket locations</p>
                    </Link>

                    <Link
                        to="/prices"
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-transparent dark:border-gray-700"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                                <FiDollarSign className="text-yellow-600 dark:text-yellow-400 text-2xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Prices</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">View price entries</p>
                    </Link>

                    <Link
                        to="/feedback"
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-transparent dark:border-gray-700"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                                <FiMessageSquare className="text-red-600 dark:text-red-400 text-2xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Feedback</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">Review user feedback</p>
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
