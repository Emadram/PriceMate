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

/** @returns {boolean} */
export const isIOSWebBrowser = () => {
    if (typeof navigator === 'undefined') return false;
    if (/iPad|iPhone|iPod/i.test(navigator.userAgent || '')) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

/**
 * Android: layout viewport shrinks with keyboard (interactive-widget=resizes-content).
 * iOS: overlay keyboard; use visualViewport CSS vars + fixed header/composer instead.
 * @returns {boolean}
 */
export const prefersKeyboardResizeViewport = () => {
    if (isDesktopViewport()) return false;
    if (isIOSWebBrowser()) return false;
    return true;
};

/**
 * iOS /ai-chat page uses fixed chrome pinned with --keyboard-inset-bottom.
 * @returns {boolean}
 */
export const usesAiChatFixedMobileChrome = () => {
    if (isDesktopViewport()) return false;
    return isIOSWebBrowser();
};
