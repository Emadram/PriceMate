import { useEffect } from 'react';
import { computeKeyboardInsetBottom } from './useAppViewportHeight';

/**
 * Lifts the chat composer above the software keyboard (overlay mode) without resizing the page shell.
 * Sets --composer-keyboard-lift on documentElement; 0 when the keyboard is closed.
 *
 * @param {boolean} enabled
 */
export default function useComposerKeyboardLift(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        const root = document.documentElement;

        const setLift = () => {
            const lift = computeKeyboardInsetBottom(window);
            root.style.setProperty('--composer-keyboard-lift', `${lift}px`);
        };

        setLift();

        const vv = window.visualViewport;
        window.addEventListener('resize', setLift, { passive: true });
        window.addEventListener('orientationchange', setLift, { passive: true });
        vv?.addEventListener('resize', setLift, { passive: true });
        vv?.addEventListener('scroll', setLift, { passive: true });

        return () => {
            window.removeEventListener('resize', setLift);
            window.removeEventListener('orientationchange', setLift);
            vv?.removeEventListener('resize', setLift);
            vv?.removeEventListener('scroll', setLift);
            root.style.removeProperty('--composer-keyboard-lift');
        };
    }, [enabled]);
}
