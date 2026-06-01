import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useComposerKeyboardLift from './useComposerKeyboardLift';

describe('useComposerKeyboardLift', () => {
    beforeEach(() => {
        document.documentElement.style.removeProperty('--composer-keyboard-lift');
    });

    afterEach(() => {
        document.documentElement.style.removeProperty('--composer-keyboard-lift');
        vi.restoreAllMocks();
    });

    it('sets --composer-keyboard-lift from visual viewport and clears on unmount', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');

        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: {
                height: 400,
                offsetTop: 0,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            },
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 800,
        });

        const { unmount } = renderHook(() => useComposerKeyboardLift(true));

        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('400px');
        expect(addSpy).toHaveBeenCalled();

        unmount();
        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('');
        expect(removeSpy).toHaveBeenCalled();
    });

    it('does nothing when disabled', () => {
        renderHook(() => useComposerKeyboardLift(false));
        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('');
    });
});
