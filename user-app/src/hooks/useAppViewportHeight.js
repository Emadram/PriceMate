import { useEffect } from 'react';

/**
 * @param {Window} win
 * @returns {number}
 */
export const computeKeyboardInsetBottom = (win = typeof window !== 'undefined' ? window : null) => {
    if (!win?.visualViewport) return 0;
    const vv = win.visualViewport;
    return Math.max(0, Math.round(win.innerHeight - vv.offsetTop - vv.height));
};

/**
 * Keeps viewport CSS vars in sync with the visible area (iOS keyboard-safe).
 * --app-dvh: visual viewport height
 * --app-vv-top: visual viewport offset from layout top
 * --keyboard-inset-bottom: space covered by keyboard / browser chrome at bottom
 *
 * @param {boolean} enabled
 * @param {{ keyboardOverlayMode?: boolean }} [options]
 */
export default function useAppViewportHeight(enabled = true, options = {}) {
    const { keyboardOverlayMode = false } = options;

    useEffect(() => {
        if (!enabled) return undefined;
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

        const root = document.documentElement;
        const { body } = document;

        const setVar = () => {
            const vv = window.visualViewport;
            const h = Math.round((vv?.height ?? window.innerHeight) || 0);
            const top = Math.round(vv?.offsetTop ?? 0);
            const keyboardInset = computeKeyboardInsetBottom(window);

            if (h > 0) {
                root.style.setProperty('--app-dvh', `${h}px`);
            }
            root.style.setProperty('--app-vv-top', `${top}px`);
            root.style.setProperty('--keyboard-inset-bottom', `${keyboardInset}px`);

            const bottomNavPx = Number.parseInt(
                getComputedStyle(root).getPropertyValue('--bottom-nav-h') || '0',
                10
            ) || 0;
            const shellH = keyboardInset > 0 ? h : Math.max(0, h - bottomNavPx);
            if (shellH > 0) {
                root.style.setProperty('--ai-chat-shell-h', `${shellH}px`);
            }

            if (keyboardOverlayMode) {
                if (keyboardInset > 0) {
                    body.classList.add('pricemate-ai-keyboard-overlay');
                } else {
                    body.classList.remove('pricemate-ai-keyboard-overlay');
                }
            }
        };

        setVar();

        const vv = window.visualViewport;
        window.addEventListener('resize', setVar, { passive: true });
        window.addEventListener('orientationchange', setVar, { passive: true });
        vv?.addEventListener('resize', setVar, { passive: true });
        vv?.addEventListener('scroll', setVar, { passive: true });

        return () => {
            window.removeEventListener('resize', setVar);
            window.removeEventListener('orientationchange', setVar);
            vv?.removeEventListener('resize', setVar);
            vv?.removeEventListener('scroll', setVar);
            if (keyboardOverlayMode) {
                body.classList.remove('pricemate-ai-keyboard-overlay');
            }
            root.style.removeProperty('--keyboard-inset-bottom');
            root.style.removeProperty('--ai-chat-shell-h');
        };
    }, [enabled, keyboardOverlayMode]);
}
