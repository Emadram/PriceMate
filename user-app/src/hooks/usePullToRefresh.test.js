import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from './usePullToRefresh';

describe('usePullToRefresh', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls onRefresh when pull exceeds threshold', async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            usePullToRefresh({ onRefresh, enabled: true, thresholdPx: 64 })
        );

        act(() => {
            window.dispatchEvent(new TouchEvent('touchstart', { touches: [{ clientY: 100 }] }));
            window.dispatchEvent(new TouchEvent('touchmove', { touches: [{ clientY: 180 }], cancelable: true }));
            window.dispatchEvent(new TouchEvent('touchend'));
        });

        await vi.waitFor(() => {
            expect(onRefresh).toHaveBeenCalledTimes(1);
            expect(result.current.refreshing).toBe(false);
        });
    });

    it('does not refresh when scroll position is not at top', async () => {
        Object.defineProperty(window, 'scrollY', { value: 120, writable: true, configurable: true });
        const onRefresh = vi.fn();
        renderHook(() => usePullToRefresh({ onRefresh, enabled: true }));

        act(() => {
            window.dispatchEvent(new TouchEvent('touchstart', { touches: [{ clientY: 100 }] }));
            window.dispatchEvent(new TouchEvent('touchmove', { touches: [{ clientY: 200 }], cancelable: true }));
            window.dispatchEvent(new TouchEvent('touchend'));
        });

        expect(onRefresh).not.toHaveBeenCalled();
    });
});
