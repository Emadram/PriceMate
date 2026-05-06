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
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <FiPackage size={20} />
                </div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">PriceMate</h1>
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
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-semibold shadow-sm' 
                                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
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
