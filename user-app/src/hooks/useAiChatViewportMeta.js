import { useEffect } from 'react';

/**
 * On /ai-chat: prefer layout resize when the keyboard opens (ChatGPT / Gemini style).
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
        if (original.includes(overlaysContent)) {
            next = original.replace(overlaysContent, resizesContent);
        } else if (!original.includes(resizesContent)) {
            next = original.trim().endsWith(',')
                ? `${original} ${resizesContent}`
                : `${original}, ${resizesContent}`;
        }

        if (next !== original) {
            meta.setAttribute('content', next);
        }

        return () => {
            meta.setAttribute('content', original);
        };
    }, [enabled]);
}
