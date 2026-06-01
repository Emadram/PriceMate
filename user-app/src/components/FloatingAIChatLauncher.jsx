import { lazy, Suspense, useEffect, useState } from 'react';
import { FiCpu } from 'react-icons/fi';
import { isDesktopViewport } from '../utils/platform';

const AIChatBox = lazy(() => import('./AIChatBox'));

const readDesktopEnabled = () => isDesktopViewport();

const FloatingAIChatLauncher = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [enabled, setEnabled] = useState(readDesktopEnabled);
    const [attachedToSplash, setAttachedToSplash] = useState(false);
    const [hideWhileSplash, setHideWhileSplash] = useState(false);

    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const detect = () => {
            const splash = document.getElementById('pricemate-mobile-splash');
            const exists = !!splash;
            let visible = false;
            try {
                if (splash) {
                    const rects = splash.getClientRects();
                    const style = window.getComputedStyle(splash);
                    visible = rects.length > 0 && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
                }
            } catch {
                visible = exists;
            }

            setAttachedToSplash(exists && visible);
            setHideWhileSplash(exists && visible);
        };

        detect();
        const observer = new MutationObserver(detect);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

        const openHandler = () => setIsOpen(true);
        window.addEventListener('pricemate-open-ai', openHandler);

        return () => {
            observer.disconnect();
            window.removeEventListener('pricemate-open-ai', openHandler);
        };
    }, [enabled]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mq = window.matchMedia('(min-width: 768px)');

        const update = () => setEnabled(!!mq.matches);
        update();

        try {
            mq.addEventListener('change', update);
            return () => mq.removeEventListener('change', update);
        } catch {
            mq.addListener(update);
            return () => mq.removeListener(update);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('openAI') === '1') {
                Promise.resolve().then(() => setIsOpen(true));
                params.delete('openAI');
                const newQs = params.toString();
                const newUrl = window.location.pathname + (newQs ? `?${newQs}` : '') + window.location.hash;
                window.history.replaceState({}, '', newUrl);
            }
        } catch {
            // ignore
        }
        return undefined;
    }, [enabled]);

    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;
        const isDesktop = window.matchMedia('(min-width: 640px)').matches;
        if (isOpen && isDesktop) document.body.classList.add('ai-open');
        else document.body.classList.remove('ai-open');
        return () => document.body.classList.remove('ai-open');
    }, [isOpen, enabled]);

    if (!enabled) {
        return null;
    }

    const wrapperClass = attachedToSplash
        ? 'fixed left-1/2 -translate-x-1/2 bottom-[40%] z-[2710]'
        : 'fixed z-[2710] right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[max(1rem,env(safe-area-inset-bottom,0px))]';

    return (
        <>
            <div id="pricemate-ai-launcher" className={wrapperClass}>
                {!isOpen && !hideWhileSplash && (
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-xl shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-800 active:scale-95"
                        title="AI Assistant"
                        aria-label="Open AI Assistant"
                    >
                        <FiCpu className="h-8 w-8" aria-hidden />
                    </button>
                )}
            </div>
            <Suspense fallback={null}>
                {isOpen ? <AIChatBox isOpen={isOpen} onClose={() => setIsOpen(false)} /> : null}
            </Suspense>
        </>
    );
};

export default FloatingAIChatLauncher;
