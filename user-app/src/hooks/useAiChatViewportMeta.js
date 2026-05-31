import { useEffect } from 'react';

const RESIZES_CONTENT = 'interactive-widget=resizes-content';
const OVERLAYS_CONTENT = 'interactive-widget=overlays-content';

/**
 * On /ai-chat only: keyboard overlays content instead of resizing layout (ChatGPT-style).
 */
export default function useAiChatViewportMeta(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return undefined;

        const original = meta.getAttribute('content') || '';
                if (!original.includes('interactive-widget')) {
                        return undefined;
                }

                const next = original.includes(RESIZES_CONTENT)
                        ? original.replace(RESIZES_CONTENT, OVERLAYS_CONTENT)
                        : original.includes(OVERLAYS_CONTENT)
                            ? original
                            : original;

        meta.setAttribute('content', next);

        return () => {
            meta.setAttribute('content', original);
        };
    }, [enabled]);
}
