import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiLogOut, FiMoon, FiSun, FiGlobe, FiHome, FiSearch, FiCamera, FiHeart } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import useCurrencyStore from '../stores/currencyStore';
import useThemeStore from '../stores/themeStore';

const Navbar = () => {
    const { t, i18n } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const { currency, setCurrency, fetchRates } = useCurrencyStore();
    const { theme, toggleTheme } = useThemeStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);

    useEffect(() => {
        fetchRates();
    }, [fetchRates]);

    const toggleCurrency = () => {
        setIsCurrencyMenuOpen(!isCurrencyMenuOpen);
    };

    const toggleLanguage = () => {
        const currentLang = i18n.resolvedLanguage || i18n.language;
        const newLang = currentLang === 'tr' ? 'en' : 'tr';
        i18n.changeLanguage(newLang);
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <>
            <nav className="pt-safe bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-colors duration-200 border-b border-gray-100 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
                                <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
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
                                                ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-500 shadow-sm' 
                                                : 'text-gray-500 dark:text-gray-400 hover:text-brand-600'
                                        }`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>

                            {/* Language Toggle */}
                            <button
                                onClick={toggleLanguage}
                                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-all border border-gray-100 dark:border-gray-700 shadow-sm group"
                            >
                                <FiGlobe className="w-4 h-4 text-accent-500 group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                    {(i18n.resolvedLanguage || i18n.language) === 'en' ? 'EN' : 'TR'}
                                </span>
                            </button>

                            <button
                                onClick={toggleTheme}
                                className="p-2.5 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl transition-all shadow-sm hover:scale-105"
                                aria-label="Toggle Dark Mode"
                            >
                                {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
                            </button>

                            {user ? (
                                <div className="flex items-center gap-2">
                                    <Link
                                        to="/profile"
                                        className="flex items-center gap-2.5 pl-2.5 pr-1.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-brand-500/50 transition-all shadow-sm group"
                                    >
                                            <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/50 rounded-xl flex items-center justify-center text-brand-600 dark:text-brand-500 font-black group-hover:scale-95 transition-transform overflow-hidden">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Account</span>
                                            <span className="text-xs font-black text-gray-900 dark:text-white leading-none max-w-[80px] truncate tracking-tight">{user.name}</span>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all active:scale-95"
                                        title={t('logout')}
                                    >
                                        <FiLogOut size={18} />
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    className="bg-brand-600 text-white px-8 py-3 rounded-2xl hover:bg-black transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-brand-500/25 active:scale-95"
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
                                onClick={toggleCurrency}
                                className={`tap-target h-11 min-w-11 px-2.5 flex items-center justify-center text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm transition-all ${isCurrencyMenuOpen ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 !border-brand-200' : ''}`}
                            >
                                <span className="text-[10px] font-black uppercase">{currency}</span>
                            </button>
                             <button
                                onClick={toggleLanguage}
                                className="tap-target h-11 w-11 flex items-center justify-center text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm"
                            >
                                <span className="text-[10px] font-black uppercase">{i18n.resolvedLanguage || i18n.language}</span>
                            </button>
                            <button
                                onClick={toggleTheme}
                                className="tap-target h-11 w-11 flex items-center justify-center text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm"
                            >
                                {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Currency Quick Select Drawer */}
                {isCurrencyMenuOpen && (
                    <div className="md:hidden border-t border-gray-100 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm animate-in slide-in-from-top duration-300 overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                            {['TRY', 'USD', 'EUR', 'GBP'].map((curr) => (
                                <button
                                    key={curr}
                                    onClick={() => {
                                        setCurrency(curr);
                                        setIsCurrencyMenuOpen(false);
                                    }}
                                    className={`flex-1 py-3 text-xs font-black rounded-2xl transition-all ${
                                        currency === curr 
                                            ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-500 shadow-sm border border-brand-100 dark:border-brand-900/50' 
                                            : 'text-gray-500 dark:text-gray-400 border border-transparent'
                                    }`}
                                >
                                    {curr}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </nav>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 px-6 py-4 pb-safe-nav shadow-soft">
                <div className="flex justify-between items-center max-w-md mx-auto">
                    <NavItem to="/" icon={FiHome} label={t('home')} currentPath={location.pathname} />
                    <NavItem to="/search" icon={FiSearch} label={t('search')} currentPath={location.pathname} />
                    <Link
                        to="/scan"
                        className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-soft -mt-10 relative border-8 border-white dark:border-gray-900 active:scale-90 transition-all duration-300"
                    >
                        <FiCamera size={28} strokeWidth={2.5} />
                    </Link>
                    <NavItem
                        to="/favorites"
                        icon={FiHeart}
                        label={t('favorites')}
                        currentPath={location.pathname}
                        state={{ from: location.pathname }}
                    />
                    <NavItem to="/profile" icon={FiUser} label={t('profile')} currentPath={location.pathname} />
                </div>
            </div>
        </>
    );
};

const NavItem = ({ to, icon, label, currentPath, state }) => {
    const IconComponent = icon;
    const isActive = currentPath === to;
    return (
        <Link
                to={to}
                state={state}
                className={`tap-target min-h-11 min-w-11 px-2 flex flex-col items-center justify-center gap-1.5 transition-colors duration-200 ease-out ${
                    isActive ? 'text-brand-600 dark:text-brand-500' : 'text-gray-400 dark:text-gray-500'
                }`}
            >
            <IconComponent size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-[10px] font-semibold tracking-tight ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                {label}
            </span>
            <span className="block mt-1 h-2 w-full">
                <span className={`mx-auto block rounded-full w-1.5 h-1.5 transition-all duration-200 ${isActive ? 'bg-brand-600 scale-100' : 'bg-transparent scale-75'}`} />
            </span>
        </Link>
    );
};

export default Navbar;
