import { useEffect } from 'react';
import { prefersKeyboardResizeViewport } from '../utils/platform';

const RESIZES = 'interactive-widget=resizes-content';
const OVERLAYS = 'interactive-widget=overlays-content';

/**
 * On /ai-chat: Android uses layout resize; iOS uses overlay + visualViewport insets.
 */
export default function useAiChatViewportMeta(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return undefined;

        const original = meta.getAttribute('content') || '';
        const useResize = prefersKeyboardResizeViewport();
        const targetWidget = useResize ? RESIZES : OVERLAYS;
        const otherWidget = useResize ? OVERLAYS : RESIZES;

        let next = original;
        if (next.includes(otherWidget)) {
            next = next.replace(otherWidget, targetWidget);
        } else if (!next.includes(targetWidget)) {
            next = next.trim().endsWith(',')
                ? `${next} ${targetWidget}`
                : `${next}, ${targetWidget}`;
        }

        const root = document.documentElement;
        if (useResize) {
            root.classList.add('pricemate-ai-chat-keyboard-resize');
        } else {
            root.classList.remove('pricemate-ai-chat-keyboard-resize');
        }

        if (next !== original) {
            meta.setAttribute('content', next);
        }

        return () => {
            meta.setAttribute('content', original);
            root.classList.remove('pricemate-ai-chat-keyboard-resize');
        };
    }, [enabled]);
}
