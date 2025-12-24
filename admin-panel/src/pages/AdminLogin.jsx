import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../stores/adminAuthStore';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const login = useAdminAuthStore((state) => state.login);
    const error = useAdminAuthStore((state) => state.error);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await login(email, password);
        if (success) {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
            <div className="max-w-md w-full relative z-10">
                <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gray-700 p-8 text-center border-b border-gray-600">
                        <div className="w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center shadow-md">
                            <span className="text-2xl font-bold text-white">PM</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">PriceMate Admin</h1>
                        <p className="text-gray-400 text-sm">Management System</p>
                    </div>

                    {/* Form */}
                    <div className="p-8">
                        {error && (
                            <div className="bg-red-900/30 border border-red-800 text-red-400 p-3 rounded mb-6 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 mb-1 font-medium text-xs uppercase tracking-wider">
                                    Admin Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                                    placeholder="admin@pricemate.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 mb-1 font-medium text-xs uppercase tracking-wider">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2.5 rounded-md hover:bg-blue-700 transition duration-200 font-medium mt-2"
                            >
                                Login
                            </button>
                        </form>

                        <div className="mt-8 pt-4 border-t border-gray-700 text-center">
                            <p className="text-gray-500 text-xs">
                                Restricted access
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-500 text-xs mt-6">
                    PriceMate Admin v1.0 • Unauthorized access is prohibited
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
