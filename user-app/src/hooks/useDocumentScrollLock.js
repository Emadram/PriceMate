import { useLayoutEffect } from 'react';
import { lockDocumentScroll, releaseDocumentScrollLock } from '../utils/documentScrollLock';

/**
 * Lock document scroll while `enabled` is true (ref-counted).
 */
export default function useDocumentScrollLock(enabled) {
    useLayoutEffect(() => {
        if (!enabled) return undefined;

        lockDocumentScroll();
        return () => {
            releaseDocumentScrollLock();
        };
    }, [enabled]);
}
