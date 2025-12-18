import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiStar, FiMessageSquare, FiLogOut, FiArrowLeft } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';

const Profile = () => {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <header className="bg-white dark:bg-gray-800 shadow p-4">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <FiArrowLeft /> Back
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex-1 text-center">Profile</h1>
                    <div className="w-16"></div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                            <FiUser className="text-blue-600 dark:text-blue-400 text-4xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{user?.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y dark:divide-gray-700">
                    <Link to="/favorites" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                                <FiStar className="text-yellow-600 dark:text-yellow-400 text-xl" />
                            </div>
                            <span className="font-medium text-gray-800 dark:text-white">Favorites</span>
                        </div>
                        <span className="text-gray-400">→</span>
                    </Link>

                    <Link to="/feedback" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <FiMessageSquare className="text-blue-600 dark:text-blue-400 text-xl" />
                            </div>
                            <span className="font-medium text-gray-800 dark:text-white">Send Feedback</span>
                        </div>
                        <span className="text-gray-400">→</span>
                    </Link>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full bg-red-500 dark:bg-red-600 text-white py-3 rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
                >
                    <FiLogOut /> Logout
                </button>
            </main>
        </div>
    );
};

export default Profile;
