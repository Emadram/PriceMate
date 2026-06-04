let lockCount = 0;

/**
 * Fully release document scroll locks used by AI chat / modals.
 * Does not restore stale inline values — always clears known lock artifacts.
 */
export const unlockDocumentScroll = () => {
    if (typeof document === 'undefined') return;

    lockCount = 0;
    const { documentElement: html, body } = document;

    body.classList.remove('pricemate-ai-chat-page', 'ai-open');
    html.style.overflow = '';
    body.style.overflow = '';
    html.style.removeProperty('overflow');
    body.style.removeProperty('overflow');
};

/**
 * Lock document scroll (ref-counted). Used by /ai-chat and modals.
 */
export const lockDocumentScroll = () => {
    if (typeof document === 'undefined') return;

    lockCount += 1;
    if (lockCount > 1) return;

    const { documentElement: html, body } = document;
    body.classList.add('pricemate-ai-chat-page');
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
};

/**
 * Release one ref-counted lock; full unlock when count reaches zero.
 */
export const releaseDocumentScrollLock = () => {
    if (typeof document === 'undefined') return;

    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
        unlockDocumentScroll();
    }
};

/** @internal For tests */
export const getDocumentScrollLockCount = () => lockCount;

/** @internal For tests */
export const resetDocumentScrollLockForTests = () => {
    lockCount = 0;
};
