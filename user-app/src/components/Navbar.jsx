import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiLogOut, FiMoon, FiSun, FiMenu, FiX, FiGlobe, FiDollarSign, FiHome, FiSearch, FiCamera, FiHeart } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import useCurrencyStore from '../stores/currencyStore';

const Navbar = () => {
    const { t, i18n } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const { currency, setCurrency, fetchRates } = useCurrencyStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [darkMode, setDarkMode] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        fetchRates();
    }, []);

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'tr' : 'en';
        i18n.changeLanguage(newLang);
    };

    useEffect(() => {
        // Check system preference or local storage
        const isDark = localStorage.getItem('theme') === 'dark' ||
            (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setDarkMode(isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
        }
    }, [darkMode]);

    const toggleTheme = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const NavItem = ({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </Link>
        );
    };

    return (
        <>
            <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-colors duration-200 border-b border-gray-100 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
                                    P
                                </div>
                                <span className="font-black text-2xl text-gray-900 dark:text-white hidden sm:block tracking-tighter">
                                    PriceMate
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-4">
                            {/* Currency Selector */}
                            <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl p-1 shadow-inner">
                                {['TRY', 'USD', 'EUR', 'GBP'].map((curr) => (
                                    <button
                                        key={curr}
                                        onClick={() => setCurrency(curr)}
                                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                            currency === curr 
                                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                                                : 'text-gray-500 dark:text-gray-400 hover:text-blue-600'
                                        }`}
                                    >
                                        {curr === 'TRY' ? 'TL' : curr}
                                    </button>
                                ))}
                            </div>

                            {/* Language Toggle */}
                            <button
                                onClick={toggleLanguage}
                                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-all border border-gray-100 dark:border-gray-700 shadow-sm group"
                            >
                                <FiGlobe className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                    {i18n.language === 'en' ? 'EN' : 'TR'}
                                </span>
                            </button>

                            <button
                                onClick={toggleTheme}
                                className="p-2.5 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl transition-all shadow-sm hover:scale-105"
                                aria-label="Toggle Dark Mode"
                            >
                                {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                            </button>

                            {user ? (
                                <div className="flex items-center gap-2">
                                    <Link
                                        to="/profile"
                                        className="flex items-center gap-2.5 pl-2.5 pr-1.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-blue-500/50 transition-all shadow-sm group"
                                    >
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold group-hover:scale-95 transition-transform overflow-hidden">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Account</span>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white leading-none max-w-[80px] truncate">{user.name}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.preventDefault(); handleLogout(); }}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-1"
                                        >
                                            <FiLogOut size={16} />
                                        </button>
                                    </Link>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-black transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/25 active:scale-95"
                                >
                                    {t('login')}
                                </Link>
                            )}
                        </div>

                        {/* Mobile Logo Only Center */}
                        <div className="md:hidden flex flex-1 justify-center items-center -mr-16">
                            <span className="font-black text-xl text-gray-900 dark:text-white tracking-tighter">
                                PriceMate
                            </span>
                        </div>

                        {/* Mobile Actions Right */}
                        <div className="flex items-center md:hidden gap-2">
                             <button
                                onClick={toggleLanguage}
                                className="p-2.5 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm"
                            >
                                <span className="text-[10px] font-black uppercase">{i18n.language}</span>
                            </button>
                            <button
                                onClick={toggleTheme}
                                className="p-2.5 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm"
                            >
                                {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 px-6 py-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center max-w-md mx-auto">
                    <NavItem to="/" icon={FiHome} label="Home" />
                    <NavItem to="/search" icon={FiSearch} label="Search" />
                    <Link
                        to="/scan"
                        className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/40 -mt-8 relative border-4 border-white dark:border-gray-900 active:scale-90 transition-transform"
                    >
                        <FiCamera size={24} className="stroke-[2.5]" />
                    </Link>
                    <NavItem to="/favorites" icon={FiHeart} label="Saved" />
                    <NavItem to="/profile" icon={FiUser} label="Profile" />
                </div>
            </div>
        </>
    );
};

export default Navbar;
