import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMobileSplashIconSrc } from './splashIcon';

describe('getMobileSplashIconSrc', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('uses apple-touch-icon on iOS', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        });
        expect(getMobileSplashIconSrc()).toBe('/apple-touch-icon.png');
    });

    it('uses android-chrome-512 on Android', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
        });
        expect(getMobileSplashIconSrc()).toBe('/android-chrome-512.png');
    });

    it('uses favicon.png as fallback', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
        });
        expect(getMobileSplashIconSrc()).toBe('/favicon.png');
    });
});
