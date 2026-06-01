import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAndroidWebBrowser, prefersKeyboardResizeViewport } from './platform';

describe('platform', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('detects Android from userAgent', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
            userAgentData: undefined,
        });
        expect(isAndroidWebBrowser()).toBe(true);
        expect(prefersKeyboardResizeViewport()).toBe(true);
    });

    it('does not treat iOS as Android', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            userAgentData: undefined,
        });
        expect(isAndroidWebBrowser()).toBe(false);
        expect(prefersKeyboardResizeViewport()).toBe(false);
    });
});
