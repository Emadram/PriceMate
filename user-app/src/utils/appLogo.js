/** AI chat header, launcher, and other AI-branded surfaces. */
export const APP_AI_LOGO_SRC = '/favicon.png';

/**
 * Platform-appropriate app icon PNGs from /public (splash, nav, auth, etc.).
 * @returns {string}
 */
export const getAppLogoSrc = () => {
    if (typeof navigator === 'undefined') return '/favicon.png';

    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) {
        return '/apple-touch-icon.png';
    }
    if (/Android/i.test(ua)) {
        return '/android-chrome-512.png';
    }
    return '/favicon.png';
};
