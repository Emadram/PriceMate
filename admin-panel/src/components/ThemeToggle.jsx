import { useEffect } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import useThemeStore from '../stores/themeStore';

const ThemeToggle = () => {
    const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);

    useEffect(() => {
        // no-op: we intentionally keep admin theme as explicit light/dark
        return undefined;
    }, []);

    const icon = effectiveTheme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />;

    return (
        <div className="inline-flex items-center">
            <button
                type="button"
                onClick={toggleTheme}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5 flex items-center justify-center"
                aria-label="Toggle theme"
                title="Toggle theme"
            >
                {icon}
            </button>
        </div>
    );
};

export default ThemeToggle;

