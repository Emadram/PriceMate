import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useComposerKeyboardLift from './useComposerKeyboardLift';

vi.mock('../utils/platform', () => ({
    prefersKeyboardResizeViewport: vi.fn(() => false),
}));

import { prefersKeyboardResizeViewport } from '../utils/platform';

describe('useComposerKeyboardLift', () => {
    beforeEach(() => {
        document.documentElement.style.removeProperty('--composer-keyboard-lift');
    });

    afterEach(() => {
        document.documentElement.style.removeProperty('--composer-keyboard-lift');
        vi.restoreAllMocks();
    });

    it('sets --composer-keyboard-lift from visual viewport and clears on unmount', () => {
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

        const { unmount } = renderHook(() => useComposerKeyboardLift(true, { active: true }));

        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('400px');

        unmount();
        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('');
    });

    it('does nothing when disabled', () => {
        renderHook(() => useComposerKeyboardLift(false));
        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('');
    });

    it('keeps lift at 0 on Android (composer anchored to tab bar)', () => {
        vi.mocked(prefersKeyboardResizeViewport).mockReturnValue(true);
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

        renderHook(() => useComposerKeyboardLift(true, { active: true }));
        expect(document.documentElement.style.getPropertyValue('--composer-keyboard-lift')).toBe('0px');
    });
});
