import { Link, useLocation } from 'react-router-dom';
import { 
    FiHome, 
    FiPackage, 
    FiShoppingBag, 
    FiDollarSign, 
    FiClock,
    FiMessageSquare, 
    FiTag, 
    FiBell, 
    FiCpu 
} from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';

const Sidebar = () => {
    const location = useLocation();

    const menuItems = [
        { path: '/', label: 'Overview', icon: FiHome },
        { path: '/products', label: 'Products', icon: FiPackage },
        { path: '/supermarkets', label: 'Supermarkets', icon: FiShoppingBag },
        { path: '/categories', label: 'Categories', icon: FiTag },
        { path: '/prices', label: 'Prices/Stock', icon: FiDollarSign },
        { path: '/price-history', label: 'Price History', icon: FiClock },
        { path: '/announcements', label: 'Announcements', icon: FiBell },
        { path: '/feedback', label: 'User Reports', icon: FiMessageSquare },
        { path: '/chat-history', label: 'AI Chat Logs', icon: FiCpu },
    ];

    return (
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen hidden lg:block sticky top-0 overflow-y-auto">
            <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <img
                        src="/LogoPriceMate.png"
                        alt="PriceMate"
                        className="h-full w-full object-contain p-1"
                        loading="eager"
                        decoding="async"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white truncate">PriceMate</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">
                        Admin
                    </p>
                </div>
                <div className="shrink-0">
                    <ThemeToggle />
                </div>
            </div>

            <nav className="px-3 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname === item.path ||
                              location.pathname.startsWith(item.path + '/');
                    
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                                isActive 
                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold shadow-sm' 
                                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <Icon size={18} className={isActive ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400'} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="absolute bottom-4 left-6 right-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest mb-1">Status</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Backend Live</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
