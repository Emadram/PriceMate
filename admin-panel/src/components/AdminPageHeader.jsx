import { Link } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCcw } from 'react-icons/fi';
import useFreshIndicator from '../hooks/useFreshIndicator';

const AdminPageHeader = ({
    title,
    subtitle,
    lastUpdated,
    onRefresh,
    loading = false,
    actions = null,
    children = null,
    sticky = true,
    backLink = null,
    contentMaxWidth = '',
    showBorder = true,
}) => {
    const isFresh = useFreshIndicator(lastUpdated);
    const updatedLabel = lastUpdated
        ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    const inner = (
        <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase truncate">
                            {title}
                        </h1>
                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full shrink-0">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Live
                        </span>
                        <span
                            className={`text-[10px] font-black uppercase tracking-widest transition-colors shrink-0 ${isFresh ? 'text-green-600' : 'text-gray-400'}`}
                        >
                            Updated {updatedLabel}
                        </span>
                    </div>
                    {subtitle ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1 normal-case tracking-normal">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
                {children}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {onRefresh ? (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-3 rounded-2xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-all"
                        aria-label="Refresh"
                    >
                        <FiRefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                ) : null}
                {actions}
            </div>
        </div>
    );

    return (
        <header
            className={`${sticky ? 'sticky top-0 z-30' : ''} bg-white/80 dark:bg-gray-800/80 backdrop-blur-md ${showBorder ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
        >
            <div className="px-8 pt-5 pb-4">
                {backLink ? (
                    <Link
                        to={backLink.to}
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-700 dark:text-brand-300 hover:gap-3 transition-all mb-4"
                    >
                        <FiArrowLeft size={14} />
                        {backLink.label}
                    </Link>
                ) : null}
                <div className={contentMaxWidth || undefined}>
                    {inner}
                </div>
            </div>
        </header>
    );
};

export default AdminPageHeader;
