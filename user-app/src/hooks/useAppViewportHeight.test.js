import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeKeyboardInsetBottom } from './useAppViewportHeight';

describe('computeKeyboardInsetBottom', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns 0 when keyboard is closed', () => {
        const win = {
            innerHeight: 800,
            visualViewport: { height: 800, offsetTop: 0 },
        };
        expect(computeKeyboardInsetBottom(win)).toBe(0);
    });

    it('returns keyboard height when visual viewport shrinks', () => {
        const win = {
            innerHeight: 800,
            visualViewport: { height: 500, offsetTop: 0 },
        };
        expect(computeKeyboardInsetBottom(win)).toBe(300);
    });

    it('accounts for visual viewport offsetTop', () => {
        const win = {
            innerHeight: 800,
            visualViewport: { height: 500, offsetTop: 50 },
        };
        expect(computeKeyboardInsetBottom(win)).toBe(250);
    });

    it('never returns negative values', () => {
        const win = {
            innerHeight: 800,
            visualViewport: { height: 900, offsetTop: 0 },
        };
        expect(computeKeyboardInsetBottom(win)).toBe(0);
    });
});
