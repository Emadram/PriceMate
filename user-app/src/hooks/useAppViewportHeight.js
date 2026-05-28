import { useEffect } from 'react';

/**
 * Keeps `--app-dvh` CSS var in sync with the visible viewport height.
 * Uses visualViewport on iOS to handle the on-screen keyboard correctly.
 */
export default function useAppViewportHeight(enabled = true) {
    useEffect(() => {
        if (!enabled) return undefined;
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

        const root = document.documentElement;
        const vv = window.visualViewport;

        const setVar = () => {
            const h = Math.round((vv?.height ?? window.innerHeight) || 0);
            if (h > 0) root.style.setProperty('--app-dvh', `${h}px`);
        };

        setVar();

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

