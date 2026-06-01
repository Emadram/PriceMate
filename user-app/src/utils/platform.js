/** @returns {boolean} */
export const isDesktopViewport = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(min-width: 768px)').matches;
};

/** @returns {boolean} */
export const isAndroidWebBrowser = () => {
    if (typeof navigator === 'undefined') return false;
    if (navigator.userAgentData?.platform === 'Android') return true;
    return /Android/i.test(navigator.userAgent || '');
};

/**
 * Mobile browsers (including iOS) use layout viewport resize on /ai-chat so the
 * header stays visible and the composer pins above the bottom tab bar.
 * @returns {boolean}
 */
export const prefersKeyboardResizeViewport = () => {
    if (isDesktopViewport()) return false;
    return true;
};
