import { useTranslation } from 'react-i18next';
import { FiRefreshCw } from 'react-icons/fi';
import { isDesktopViewport } from '../utils/platform';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useEffect, useState } from 'react';

/**
 * Mobile: pull-to-refresh indicator. Desktop: refresh icon button.
 */
const RefreshControl = ({
    onRefresh,
    enabled = true,
    enablePullToRefresh = true,
    containerRef,
    className = '',
    showDesktopButton = true,
    externalRefreshing = false,
}) => {
    const { t } = useTranslation();
    const [isDesktop, setIsDesktop] = useState(() => isDesktopViewport());

    const { pulling, refreshing, pullDistance } = usePullToRefresh({
        onRefresh,
        enabled: enabled && enablePullToRefresh && !isDesktop,
        containerRef,
    });

    const handleDesktopRefresh = async () => {
        if (typeof onRefresh === 'function') {
            await onRefresh();
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mq = window.matchMedia('(min-width: 768px)');
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    const isBusy = refreshing || externalRefreshing;
    const showPullIndicator = !isDesktop && (pulling || isBusy) && pullDistance > 0;

    return (
        <>
            {showPullIndicator && (
                <div
                    className="fixed left-0 right-0 z-[9980] flex justify-center pointer-events-none pt-safe"
                    style={{ top: Math.min(pullDistance, 72) }}
                    aria-live="polite"
                >
                    <div className="flex items-center gap-2 rounded-full bg-white/90 dark:bg-gray-900/90 px-3 py-1.5 shadow-sm border border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        <span
                            className={`inline-block w-3 h-3 border-2 border-gray-300 border-t-brand-600 rounded-full ${isBusy ? 'animate-spin' : ''}`}
                        />
                        {t('updating', 'Updating')}
                    </div>
                </div>
            )}

            {showDesktopButton && isDesktop && (
                <button
                    type="button"
                    onClick={() => void handleDesktopRefresh()}
                    disabled={isBusy || !enabled}
                    aria-label={t('refresh', 'Refresh')}
                    className={`tap-target min-h-11 min-w-11 inline-flex items-center justify-center rounded-2xl text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition disabled:opacity-40 ${className}`}
                >
                    <FiRefreshCw size={18} className={isBusy ? 'animate-spin' : ''} />
                </button>
            )}
        </>
    );
};

export default RefreshControl;
