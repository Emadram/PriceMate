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
 * Android browsers often need layout viewport resize for keyboard avoidance;
 * iOS Safari keeps overlay mode so the bottom tab bar does not jump.
 * @returns {boolean}
 */
export const prefersKeyboardResizeViewport = () => isAndroidWebBrowser();
