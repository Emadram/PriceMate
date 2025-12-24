import { Link, Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { FiUser, FiMail, FiCalendar, FiStar, FiMessageSquare, FiLogOut, FiArrowLeft } from 'react-icons/fi';

const Profile = () => {
    const { user, logout } = useAuthStore();

    if (!user) return <Navigate to="/login" />;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Back Link */}
                <Link to="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline mb-6">
                    <FiArrowLeft /> Back to Home
                </Link>

                <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="px-6 py-8 bg-blue-600 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <FiUser size={120} />
                        </div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3 relative z-10">
                            <FiUser /> User Account
                        </h1>
                    </div>

                    <div className="p-8">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pb-8 border-b border-gray-100 dark:border-gray-700">
                            <div className="h-28 w-28 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 text-5xl font-bold shadow-inner">
                                {user.name?.charAt(0) || 'U'}
                            </div>
                            <div className="text-center md:text-left pt-2">
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {user.name}
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center md:justify-start gap-2 mt-1">
                                    <FiCalendar className="text-sm" />
                                    Member since {new Date(user.$createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                                        Email Address
                                    </label>
                                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <FiMail className="text-blue-500" />
                                        <span className="font-medium">{user.email}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                                        Account Identity
                                    </label>
                                    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <span className="font-mono text-sm break-all">{user.$id}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                                    Quick Access
                                </label>
                                <Link
                                    to="/favorites"
                                    className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-400 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 hover:shadow-md transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <FiStar size={20} className="group-hover:scale-110 transition" />
                                        <span className="font-bold">My Favorites</span>
                                    </div>
                                    <span className="text-xl">→</span>
                                </Link>

                                <Link
                                    to="/feedback"
                                    className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/30 hover:shadow-md transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <FiMessageSquare size={20} className="group-hover:scale-110 transition" />
                                        <span className="font-bold">Send Feedback</span>
                                    </div>
                                    <span className="text-xl">→</span>
                                </Link>

                                <button
                                    onClick={() => logout()}
                                    className="w-full flex items-center justify-center gap-2 p-4 mt-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 font-bold hover:bg-red-100 dark:hover:bg-red-900/20 transition"
                                >
                                    <FiLogOut /> Logout Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
