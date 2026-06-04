import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    lockDocumentScroll,
    releaseDocumentScrollLock,
    unlockDocumentScroll,
    getDocumentScrollLockCount,
    resetDocumentScrollLockForTests,
} from './documentScrollLock';

describe('documentScrollLock', () => {
    beforeEach(() => {
        resetDocumentScrollLockForTests();
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.classList.remove('pricemate-ai-chat-page', 'ai-open');
    });

    afterEach(() => {
        unlockDocumentScroll();
    });

    it('lock then unlock clears body class and inline overflow', () => {
        lockDocumentScroll();
        expect(document.body.classList.contains('pricemate-ai-chat-page')).toBe(true);
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');

        unlockDocumentScroll();
        expect(document.body.classList.contains('pricemate-ai-chat-page')).toBe(false);
        expect(document.body.classList.contains('ai-open')).toBe(false);
        expect(document.documentElement.style.overflow).toBe('');
        expect(document.body.style.overflow).toBe('');
    });

    it('unlock removes ai-open class', () => {
        document.body.classList.add('ai-open');
        unlockDocumentScroll();
        expect(document.body.classList.contains('ai-open')).toBe(false);
    });

    it('ref-counts nested locks and releases on last release', () => {
        lockDocumentScroll();
        lockDocumentScroll();
        expect(getDocumentScrollLockCount()).toBe(2);

        releaseDocumentScrollLock();
        expect(getDocumentScrollLockCount()).toBe(1);
        expect(document.body.classList.contains('pricemate-ai-chat-page')).toBe(true);

        releaseDocumentScrollLock();
        expect(getDocumentScrollLockCount()).toBe(0);
        expect(document.body.classList.contains('pricemate-ai-chat-page')).toBe(false);
    });

    it('unlockDocumentScroll resets ref-count to zero', () => {
        lockDocumentScroll();
        lockDocumentScroll();
        unlockDocumentScroll();
        expect(getDocumentScrollLockCount()).toBe(0);
        expect(document.body.classList.contains('pricemate-ai-chat-page')).toBe(false);
    });
});
