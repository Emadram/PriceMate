import { useEffect } from 'react';

const isZoomGestureTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(
        target.closest('.leaflet-container')
        || target.closest('#scanner-root')
    );
};

/**
 * Blocks iOS Safari pinch-zoom gestures app-wide (viewport meta is primary guard).
 * Skips map and barcode scanner surfaces that need native gestures.
 */
export default function usePreventBrowserZoom(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;

        const onGestureStart = (event) => {
            if (isZoomGestureTarget(event.target)) return;
            event.preventDefault();
        };

        window.addEventListener('gesturestart', onGestureStart, { passive: false });
        window.addEventListener('gesturechange', onGestureStart, { passive: false });

        return () => {
            window.removeEventListener('gesturestart', onGestureStart);
            window.removeEventListener('gesturechange', onGestureStart);
        };
    }, [enabled]);
}
