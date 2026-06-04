import { useEffect, useRef } from 'react';
import { computeKeyboardInsetBottom } from './useAppViewportHeight';
import { prefersKeyboardResizeViewport } from '../utils/platform';

const COMPOSER_INPUT_SELECTOR = '[data-ai-composer-input]';

/**
 * Lifts the chat composer above the software keyboard.
 * Sets --composer-keyboard-lift on documentElement; 0 when the keyboard is closed.
 *
 * @param {boolean} enabled
 * @param {{ active?: boolean }} [options]
 */
export default function useComposerKeyboardLift(enabled = true, options = {}) {
    const { active = false } = options;
    const baselineInnerHeightRef = useRef(0);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        const root = document.documentElement;
        const preferResizeLayout = prefersKeyboardResizeViewport();

        const setLift = () => {
            // Android: composer is pinned above the tab bar; layout resize handles the keyboard.
            if (preferResizeLayout) {
                root.style.setProperty('--composer-keyboard-lift', '0px');
                return;
            }

            const baseline = active ? baselineInnerHeightRef.current : 0;
            const lift = computeKeyboardInsetBottom(window, {
                baselineInnerHeight: baseline,
                preferResizeLayout: false,
            });
            root.style.setProperty('--composer-keyboard-lift', `${lift}px`);
        };

        const onFocusIn = (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.matches(COMPOSER_INPUT_SELECTOR)) return;
            baselineInnerHeightRef.current = Math.round(window.innerHeight);
            setLift();
        };

        const onFocusOut = (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.matches(COMPOSER_INPUT_SELECTOR)) return;
            const next = event.relatedTarget;
            if (next instanceof HTMLElement && next.matches(COMPOSER_INPUT_SELECTOR)) {
                return;
            }
            baselineInnerHeightRef.current = 0;
            root.style.setProperty('--composer-keyboard-lift', '0px');
        };

        if (active && baselineInnerHeightRef.current === 0) {
            baselineInnerHeightRef.current = Math.round(window.innerHeight);
        }
        if (!active) {
            baselineInnerHeightRef.current = 0;
        }

        setLift();

        const vv = window.visualViewport;
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        window.addEventListener('resize', setLift, { passive: true });
        window.addEventListener('orientationchange', setLift, { passive: true });
        vv?.addEventListener('resize', setLift, { passive: true });
        vv?.addEventListener('scroll', setLift, { passive: true });

        return () => {
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            window.removeEventListener('resize', setLift);
            window.removeEventListener('orientationchange', setLift);
            vv?.removeEventListener('resize', setLift);
            vv?.removeEventListener('scroll', setLift);
            root.style.removeProperty('--composer-keyboard-lift');
            baselineInnerHeightRef.current = 0;
        };
    }, [enabled, active]);
}
