/**
 * Platform-appropriate splash / home-screen icon PNGs from /public.
 * @returns {string}
 */
export const getMobileSplashIconSrc = () => {
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
