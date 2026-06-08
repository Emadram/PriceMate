import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_THRESHOLD_PX = 64;

const isInsideHorizontalScroller = (target) => {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('[data-horizontal-scroll]'));
};

/**
 * Pull-to-refresh for mobile scroll containers or window.
 * @param {object} options
 * @param {() => void | Promise<void>} options.onRefresh
 * @param {boolean} [options.enabled=true]
 * @param {React.RefObject<HTMLElement>} [options.containerRef] - scroll root; defaults to window
 * @param {number} [options.thresholdPx=64]
 */
export function usePullToRefresh({
    onRefresh,
    enabled = true,
    containerRef,
    thresholdPx = DEFAULT_THRESHOLD_PX,
}) {
    const [pulling, setPulling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);

    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const pullingRef = useRef(false);
    const refreshingRef = useRef(false);
    const pullDistanceRef = useRef(0);
    const horizontalGestureRef = useRef(false);

    const resetPull = useCallback(() => {
        pullingRef.current = false;
        horizontalGestureRef.current = false;
        setPulling(false);
        pullDistanceRef.current = 0;
        setPullDistance(0);
    }, []);

    const getScrollTop = useCallback(() => {
        const el = containerRef?.current;
        if (el) return el.scrollTop;
        if (typeof window !== 'undefined') {
            return window.scrollY || document.documentElement.scrollTop || 0;
        }
        return 0;
    }, [containerRef]);

    const runRefresh = useCallback(async () => {
        if (refreshingRef.current || typeof onRefresh !== 'function') return;
        refreshingRef.current = true;
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            refreshingRef.current = false;
            setRefreshing(false);
            resetPull();
        }
    }, [onRefresh, resetPull]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;

        const target = containerRef?.current || window;
        const opts = { passive: false };

        const onTouchStart = (e) => {
            if (refreshingRef.current) return;
            if (getScrollTop() > 0) return;
            if (!e.touches?.length) return;
            if (isInsideHorizontalScroller(e.target)) {
                horizontalGestureRef.current = true;
                return;
            }

            horizontalGestureRef.current = false;
            startXRef.current = e.touches[0].clientX;
            startYRef.current = e.touches[0].clientY;
            pullingRef.current = true;
            setPulling(true);
        };

        const onTouchMove = (e) => {
            if (horizontalGestureRef.current || refreshingRef.current) return;
            if (!pullingRef.current) return;
            if (getScrollTop() > 0) {
                resetPull();
                return;
            }

            const touch = e.touches[0];
            const deltaX = touch.clientX - startXRef.current;
            const deltaY = touch.clientY - startYRef.current;

            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                resetPull();
                return;
            }

            if (deltaY <= 0) {
                setPullDistance(0);
                return;
            }

            const next = Math.min(deltaY, thresholdPx * 1.5);
            pullDistanceRef.current = next;
            setPullDistance(next);
            if (deltaY > 8) {
                e.preventDefault();
            }
        };

        const onTouchEnd = () => {
            horizontalGestureRef.current = false;
            if (!pullingRef.current || refreshingRef.current) return;
            const shouldRefresh = pullDistanceRef.current >= thresholdPx;
            pullingRef.current = false;
            setPulling(false);
            if (shouldRefresh) {
                void runRefresh();
            } else {
                pullDistanceRef.current = 0;
                setPullDistance(0);
            }
        };

        const onTouchCancel = () => {
            resetPull();
        };

        target.addEventListener('touchstart', onTouchStart, opts);
        target.addEventListener('touchmove', onTouchMove, opts);
        target.addEventListener('touchend', onTouchEnd);
        target.addEventListener('touchcancel', onTouchCancel);

        return () => {
            target.removeEventListener('touchstart', onTouchStart);
            target.removeEventListener('touchmove', onTouchMove);
            target.removeEventListener('touchend', onTouchEnd);
            target.removeEventListener('touchcancel', onTouchCancel);
        };
    }, [enabled, containerRef, getScrollTop, resetPull, runRefresh, thresholdPx]);

    const triggerRefresh = useCallback(() => {
        void runRefresh();
    }, [runRefresh]);

    return {
        pulling,
        refreshing,
        pullDistance,
        triggerRefresh,
    };
}
