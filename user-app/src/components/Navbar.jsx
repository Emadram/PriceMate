import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiLogOut, FiMoon, FiSun, FiGlobe, FiHome, FiSearch, FiCamera, FiHeart, FiCpu } from 'react-icons/fi';
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

    useEffect(() => {
        fetchRates();
    }, [fetchRates]);

    const toggleLanguage = () => {
        const currentLang = i18n.resolvedLanguage || i18n.language;
        const newLang = currentLang === 'tr' ? 'en' : 'tr';
        i18n.changeLanguage(newLang);
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const tapFeedback = () => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
        }
    };

    return (
        <>
            {/* Top mobile header: show logo here (visible) and make background dark in dark mode */}
            <div className="md:hidden fixed top-0 inset-x-0 z-9999 pt-safe px-safe">
                <div className="mx-2 px-4 py-3 bg-transparent dark:bg-gray-900/95 rounded-b-[1.4rem] backdrop-blur-xl border-b border-gray-800/20">
                        <Link to="/" className="flex items-center justify-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white font-black text-sm shadow-sm shadow-brand-500/25 shrink-0">
                            P
                        </div>
                        <span className="text-sm font-black tracking-tight text-gray-900 dark:text-white truncate">PriceMate</span>
                    </Link>
                </div>
            </div>

                <nav className="hidden md:block fixed top-0 left-0 right-0 pt-safe z-9999 bg-transparent dark:bg-gray-900/95 backdrop-blur-md transition-colors duration-200">
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
                                aria-label={t('toggle_dark_mode', 'Toggle Dark Mode')}
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
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">{t('account', 'Account')}</span>
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

                    </div>
                </div>
            </nav>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 inset-x-0 z-9998 px-safe">
              <div className="mx-2 mb-2 px-4 py-3 pb-safe-nav bg-transparent dark:bg-gray-900/95 rounded-t-[1.75rem] backdrop-blur-md">
                <div className="flex justify-evenly items-center max-w-md mx-auto">
                    <NavItem to="/" icon={FiHome} label={t('home')} currentPath={location.pathname} onTap={tapFeedback} />
                    <NavItem to="/search" icon={FiSearch} label={t('search')} currentPath={location.pathname} onTap={tapFeedback} />
                    <Link
                        to="/scan"
                        onClick={tapFeedback}
                        className="w-15 h-15 bg-brand-600 rounded-[1.35rem] flex items-center justify-center text-white shadow-soft -mt-9 relative border-[6px] border-white dark:border-gray-900 active:scale-90 transition-all duration-300"
                    >
                        <FiCamera size={26} strokeWidth={2.5} />
                    </Link>
                    <NavItem to="/ai-chat" icon={FiCpu} label={t('ai_chat_tab', 'AI')} currentPath={location.pathname} onTap={tapFeedback} />
                    <NavItem
                        to="/favorites"
                        icon={FiHeart}
                        label={t('favorites')}
                        currentPath={location.pathname}
                        state={{ from: location.pathname }}
                        onTap={tapFeedback}
                    />
                    <NavItem to="/profile" icon={FiUser} label={t('profile')} currentPath={location.pathname} onTap={tapFeedback} />
                </div>
              </div>
            </div>
        </>
    );
};

const NavItem = ({ to, icon, label, currentPath, state, onTap }) => {
    const IconComponent = icon;
    const isActive = currentPath === to;
    return (
        <Link
                to={to}
                state={state}
                onClick={onTap}
                className={`tap-target min-h-11 min-w-11 px-1.5 flex flex-col items-center justify-center gap-1 transition-colors duration-200 ease-out ${
                    isActive ? 'text-brand-600 dark:text-brand-500' : 'text-gray-400 dark:text-gray-200'
                }`}> 
            <IconComponent size={21} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-[9px] font-semibold tracking-tight uppercase ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                {label}
            </span>
            <span className="block mt-1.5 h-1.5 w-full">
                <span className={`mx-auto block h-[2px] w-5 origin-center transform transition-transform duration-200 ease-out rounded-full ${isActive ? 'bg-brand-600 scale-x-100' : 'bg-transparent scale-x-0'}`} />
            </span>
        </Link>
    );
};

export default Navbar;
