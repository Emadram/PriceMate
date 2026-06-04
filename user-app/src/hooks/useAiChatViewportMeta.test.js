import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useAiChatViewportMeta from './useAiChatViewportMeta';

vi.mock('../utils/platform', () => ({
    prefersKeyboardResizeViewport: vi.fn(() => false),
}));

import { prefersKeyboardResizeViewport } from '../utils/platform';

describe('useAiChatViewportMeta', () => {
    let meta;

    beforeEach(() => {
        vi.mocked(prefersKeyboardResizeViewport).mockReturnValue(false);
        document.documentElement.classList.remove('pricemate-ai-chat-keyboard-resize');
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
        document.documentElement.classList.remove('pricemate-ai-chat-keyboard-resize');
    });

    it('adds interactive-widget=overlays-content when resize is not preferred (desktop)', () => {
        vi.mocked(prefersKeyboardResizeViewport).mockReturnValue(false);
        const { unmount } = renderHook(() => useAiChatViewportMeta(true));
        expect(meta.getAttribute('content')).toContain('interactive-widget=overlays-content');
        expect(meta.getAttribute('content')).not.toContain('interactive-widget=resizes-content');
        expect(document.documentElement.classList.contains('pricemate-ai-chat-keyboard-resize')).toBe(false);
        unmount();
        expect(meta.getAttribute('content')).not.toContain('interactive-widget=overlays-content');
    });

    it('adds interactive-widget=resizes-content on Android', () => {
        vi.mocked(prefersKeyboardResizeViewport).mockReturnValue(true);
        const { unmount } = renderHook(() => useAiChatViewportMeta(true));
        expect(meta.getAttribute('content')).toContain('interactive-widget=resizes-content');
        expect(document.documentElement.classList.contains('pricemate-ai-chat-keyboard-resize')).toBe(true);
        unmount();
        expect(document.documentElement.classList.contains('pricemate-ai-chat-keyboard-resize')).toBe(false);
    });

    it('replaces overlays with resizes on Android when overlays was set', () => {
        vi.mocked(prefersKeyboardResizeViewport).mockReturnValue(true);
        meta.setAttribute(
            'content',
            'width=device-width, initial-scale=1, interactive-widget=overlays-content'
        );
        const { unmount } = renderHook(() => useAiChatViewportMeta(true));
        expect(meta.getAttribute('content')).toContain('interactive-widget=resizes-content');
        expect(meta.getAttribute('content')).not.toContain('overlays-content');
        unmount();
    });
});
