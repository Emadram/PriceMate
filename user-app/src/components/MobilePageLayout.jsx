import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';

export const MobileHeader = ({
    title,
    icon: TitleIcon,
    left,
    right,
    backTo,
    backLabel = 'Back',
    className = '',
    dense = false,
}) => {
    const headerRef = useRef(null);

    useEffect(() => {
        const el = headerRef.current;
        if (!el || typeof document === 'undefined') return undefined;

        const root = document.documentElement;
        const setVar = () => {
            const h = Math.round(el.getBoundingClientRect().height || 0);
            if (h > 0) root.style.setProperty('--mobile-header-h', `${h}px`);
        };

        setVar();
        const ro = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(setVar)
            : null;
        ro?.observe(el);
        window.addEventListener('resize', setVar, { passive: true });
        window.addEventListener('orientationchange', setVar, { passive: true });

        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', setVar);
            window.removeEventListener('orientationchange', setVar);
        };
    }, []);

    const leftNode =
        left ??
        (backTo ? (
            <Link
                to={backTo}
                aria-label={backLabel}
                className="tap-target min-h-11 min-w-11 -ml-2 inline-flex items-center justify-center rounded-2xl hover:bg-gray-100/60 dark:hover:bg-white/5 transition"
            >
                <FiChevronLeft size={22} />
            </Link>
        ) : (
            <span className="w-11" aria-hidden />
        ));

    const rightNode = right ?? <span className="w-11" aria-hidden />;

    return (
        <>
            <header
                ref={headerRef}
                className={`px-safe fixed inset-x-0 z-[9990] top-[var(--mobile-top-logo-h,5rem)] border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-md md:static md:sticky md:top-0 md:z-50 ${className}`}
            >
                <div className={`max-w-4xl mx-auto px-4 ${dense ? 'py-2' : 'py-3'}`}>
                    <div className="grid grid-cols-3 items-center">
                        <div className="justify-self-start">{leftNode}</div>
                        <h1 className="justify-self-center text-base sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 min-w-0">
                            {TitleIcon ? <TitleIcon className="text-brand-600 shrink-0" size={18} /> : null}
                            <span className="truncate">{title}</span>
                        </h1>
                        <div className="justify-self-end">{rightNode}</div>
                    </div>
                </div>
            </header>
            <div className="md:hidden h-[var(--mobile-header-h,3.25rem)] shrink-0" aria-hidden="true" />
        </>
    );
};

export const MobilePage = ({ children, className = '' }) => (
    <div className={`min-h-screen bg-[#F5F5F7] dark:bg-black text-gray-900 dark:text-gray-100 pb-safe ${className}`}>
        {children}
    </div>
);
