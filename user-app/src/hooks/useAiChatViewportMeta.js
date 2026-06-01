import { useEffect } from 'react';

/**
 * On /ai-chat: keyboard overlays content (same model as Search) — do not resize the layout viewport.
 */
export default function useAiChatViewportMeta(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return undefined;

        const original = meta.getAttribute('content') || '';
        const resizesContent = 'interactive-widget=resizes-content';
        const overlaysContent = 'interactive-widget=overlays-content';

        let next = original;
        if (original.includes(resizesContent)) {
            next = original.replace(resizesContent, overlaysContent);
        } else if (!original.includes(overlaysContent)) {
            next = original.trim().endsWith(',')
                ? `${original} ${overlaysContent}`
                : `${original}, ${overlaysContent}`;
        }

        if (next !== original) {
            meta.setAttribute('content', next);
        }

        return () => {
            meta.setAttribute('content', original);
        };
    }, [enabled]);
}
