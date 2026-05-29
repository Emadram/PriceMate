import { useEffect } from 'react';

/**
 * Keeps viewport CSS vars in sync with the visible area (iOS keyboard-safe).
 * --app-dvh: visual viewport height
 * --app-vv-top: visual viewport offset from layout top
 */
export default function useAppViewportHeight(enabled = true) {
    useEffect(() => {
        if (!enabled) return undefined;
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

        const root = document.documentElement;

        const setVar = () => {
            const vv = window.visualViewport;
            const h = Math.round((vv?.height ?? window.innerHeight) || 0);
            const top = Math.round(vv?.offsetTop ?? 0);
            if (h > 0) {
                root.style.setProperty('--app-dvh', `${h}px`);
            }
            root.style.setProperty('--app-vv-top', `${top}px`);
        };

        setVar();

        const vv = window.visualViewport;
        window.addEventListener('resize', setVar, { passive: true });
        window.addEventListener('orientationchange', setVar, { passive: true });
        vv?.addEventListener('resize', setVar, { passive: true });
        vv?.addEventListener('scroll', setVar, { passive: true });

        return () => {
            window.removeEventListener('resize', setVar);
            window.removeEventListener('orientationchange', setVar);
            vv?.removeEventListener('resize', setVar);
            vv?.removeEventListener('scroll', setVar);
        };
    }, [enabled]);
}
