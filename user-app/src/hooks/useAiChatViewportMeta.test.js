import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useAiChatViewportMeta from './useAiChatViewportMeta';

describe('useAiChatViewportMeta', () => {
    let meta;

    beforeEach(() => {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute(
            'content',
            'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, viewport-fit=cover'
        );
        document.head.appendChild(meta);
    });

    afterEach(() => {
        meta?.remove();
    });

    it('adds interactive-widget=overlays-content while enabled', () => {
        const { unmount } = renderHook(() => useAiChatViewportMeta(true));
        expect(meta.getAttribute('content')).toContain('interactive-widget=overlays-content');
        expect(meta.getAttribute('content')).not.toContain('interactive-widget=resizes-content');
        unmount();
        expect(meta.getAttribute('content')).not.toContain('interactive-widget=overlays-content');
    });

    it('replaces resizes-content with overlays-content', () => {
        meta.setAttribute(
            'content',
            'width=device-width, initial-scale=1, interactive-widget=resizes-content'
        );
        const { unmount } = renderHook(() => useAiChatViewportMeta(true));
        expect(meta.getAttribute('content')).toContain('interactive-widget=overlays-content');
        expect(meta.getAttribute('content')).not.toContain('resizes-content');
        unmount();
    });
});
