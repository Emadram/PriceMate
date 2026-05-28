import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../stores/adminAuthStore';
import ThemeToggle from '../components/ThemeToggle';

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
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] dark:bg-black px-4">
            <div className="max-w-md w-full relative z-10">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-soft border border-gray-200 dark:border-white/10 overflow-hidden">
                    {/* Header */}
                    <div className="p-8 text-center border-b border-gray-100 dark:border-white/10 relative">
                        <div className="absolute right-5 top-5">
                            <ThemeToggle />
                        </div>
                        <div className="w-16 h-16 bg-brand-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-brand-600/20">
                            <span className="text-2xl font-bold text-white">PM</span>
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">PriceMate Admin</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Management System</p>
                    </div>

                    {/* Form */}
                    <div className="p-8">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-300 p-3 rounded-xl mb-6 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-gray-500 dark:text-gray-400 mb-1 font-black text-[10px] uppercase tracking-widest">
                                    Admin Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full min-h-11 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
                                    placeholder="admin@pricemate.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-500 dark:text-gray-400 mb-1 font-black text-[10px] uppercase tracking-widest">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full min-h-11 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-brand-600 text-white py-3 rounded-xl hover:bg-brand-700 transition duration-200 font-black uppercase tracking-widest text-[11px] mt-2"
                            >
                                Login
                            </button>
                        </form>

                        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/10 text-center">
                            <p className="text-gray-400 text-xs">
                                Restricted access
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-400 text-xs mt-6">
                    PriceMate Admin v1.0 • Unauthorized access is prohibited
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
