import { Link, useNavigate } from 'react-router-dom';
import { FiPackage, FiShoppingBag, FiDollarSign, FiMessageSquare, FiTag, FiPlus, FiRefreshCcw } from 'react-icons/fi';
import useAdminAuthStore from '../stores/adminAuthStore';
import { useEffect, useState } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';

const Dashboard = () => {
    const admin = useAdminAuthStore((state) => state.admin);
    const logout = useAdminAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        products: 0,
        prices: 0,
        supermarkets: 0,
        categories: 0,
        feedback: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // Fetch counts from all collections
            // Note: We use limit(0) to just get the total count without fetching heavy documents if possible,
            // otherwise listDocuments returns total.
            const [products, prices, markets, cats, feedback] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PRODUCTS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PRICES),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SUPERMARKETS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CATEGORIES),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.FEEDBACK)
            ]);

            setStats({
                products: products.total,
                prices: prices.total,
                supermarkets: markets.total,
                categories: cats.total,
                feedback: feedback.total
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Helper Card Component
    const StatCard = ({ title, count, icon: Icon, colorClass, link, bgClass }) => (
        <Link
            to={link}
            className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-transparent dark:border-gray-700 relative overflow-hidden`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wide">{title}</h2>
                    <p className={`text-4xl font-bold mt-2 ${loading ? 'animate-pulse bg-gray-200 dark:bg-gray-700 h-10 w-20 rounded text-transparent' : 'text-gray-800 dark:text-white'}`}>
                        {loading ? '-' : count}
                    </p>
                </div>
                <div className={`p-3 rounded-lg ${bgClass}`}>
                    <Icon className={`${colorClass} text-2xl`} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                View Details →
            </div>
        </Link>
    );

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded text-white">
                            <FiPackage />
                        </div>
                        <h1 className="text-xl font-bold text-gray-800 dark:text-white">PriceMate Admin</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={fetchStats} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition" title="Refresh Data">
                            <FiRefreshCcw className={loading ? 'animate-spin' : ''} />
                        </button>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                                {admin?.name?.charAt(0) || 'A'}
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">{admin?.name || 'Admin'}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Overview</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening in your app today.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/products')}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                        >
                            <FiPlus /> Add Product
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-10">
                    <StatCard
                        title="Total Products"
                        count={stats.products}
                        icon={FiPackage}
                        colorClass="text-blue-600"
                        bgClass="bg-blue-100 dark:bg-blue-900"
                        link="/products"
                    />
                    <StatCard
                        title="Price Entries"
                        count={stats.prices}
                        icon={FiDollarSign}
                        colorClass="text-green-600"
                        bgClass="bg-green-100 dark:bg-green-900"
                        link="/prices"
                    />
                    <StatCard
                        title="Supermarkets"
                        count={stats.supermarkets}
                        icon={FiShoppingBag}
                        colorClass="text-purple-600"
                        bgClass="bg-purple-100 dark:bg-purple-900"
                        link="/supermarkets"
                    />
                    <StatCard
                        title="Categories"
                        count={stats.categories}
                        icon={FiTag}
                        colorClass="text-orange-600"
                        bgClass="bg-orange-100 dark:bg-orange-900"
                        link="/categories"
                    />
                    <StatCard
                        title="Feedback"
                        count={stats.feedback}
                        icon={FiMessageSquare}
                        colorClass="text-indigo-600"
                        bgClass="bg-indigo-100 dark:bg-indigo-900"
                        link="/feedback"
                    />
                </div>

            </main>
        </div>
    );
};

export default Dashboard;
