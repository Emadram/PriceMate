import { useEffect } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import useThemeStore from '../stores/themeStore';

const ThemeToggle = () => {
    const theme = useThemeStore((s) => s.theme);
    const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
    const setTheme = useThemeStore((s) => s.setTheme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (useThemeStore.getState().theme === 'system') {
                setTheme('system');
            }
        };
        try {
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        } catch {
            mq.addListener(handler);
            return () => mq.removeListener(handler);
        }
    }, [setTheme]);

    const icon = effectiveTheme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />;

    return (
        <div className="inline-flex items-center gap-2">
            <button
                type="button"
                onClick={toggleTheme}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5 flex items-center justify-center"
                aria-label="Toggle theme"
                title="Toggle theme"
            >
                {icon}
            </button>

            <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200"
                aria-label="Theme mode"
                title="Theme mode"
            >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
        </div>
    );
};

export default ThemeToggle;

