import useAuthStore from '../stores/authStore';
import { FiUser, FiMail, FiCalendar } from 'react-icons/fi';

const Profile = () => {
    const user = useAuthStore((state) => state.user);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-4 bg-blue-600">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FiUser /> Profile
                        </h1>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-4 pb-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="h-20 w-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 text-3xl font-bold">
                                {user.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {user.name}
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Member since {new Date(user.$createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Email
                                </label>
                                <div className="mt-1 flex items-center gap-2 text-gray-900 dark:text-white text-lg">
                                    <FiMail className="text-gray-400" />
                                    {user.email}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                                    User ID
                                </label>
                                <div className="mt-1 font-mono text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded inline-block">
                                    {user.$id}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
