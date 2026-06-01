import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAndroidWebBrowser, prefersKeyboardResizeViewport, isDesktopViewport } from './platform';

describe('platform', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const mockMobileViewport = () => {
        vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
            matches: query === '(min-width: 768px)' ? false : false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })));
    };

    it('detects Android from userAgent', () => {
        mockMobileViewport();
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
            userAgentData: undefined,
        });
        expect(isAndroidWebBrowser()).toBe(true);
        expect(prefersKeyboardResizeViewport()).toBe(true);
    });

    it('does not treat iOS as Android', () => {
        mockMobileViewport();
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            userAgentData: undefined,
        });
        expect(isAndroidWebBrowser()).toBe(false);
        expect(prefersKeyboardResizeViewport()).toBe(true);
    });

    it('does not prefer keyboard resize on desktop', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
            matches: query === '(min-width: 768px)' ? true : false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })));
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            userAgentData: undefined,
        });
        expect(isDesktopViewport()).toBe(true);
        expect(prefersKeyboardResizeViewport()).toBe(false);
    });
});
