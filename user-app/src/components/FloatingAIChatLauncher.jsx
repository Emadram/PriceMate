import { useState, useEffect } from 'react';
import { FiCpu } from 'react-icons/fi';
import AIChatBox from './AIChatBox';

const FloatingAIChatLauncher = () => {
    const [isOpen, setIsOpen] = useState(false);

    // No DOM duplicate detection — App renders a single launcher via AppShell.

    // Track whether the mobile splash is present so we can visually attach the launcher
    const [attachedToSplash, setAttachedToSplash] = useState(false);
    // Hide the launcher while the splash is visible to avoid overlap
    const [hideWhileSplash, setHideWhileSplash] = useState(false);

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;

        const detect = () => {
            const splash = document.getElementById('pricemate-mobile-splash');
            const exists = !!splash;
            // Consider splash visible if it exists and has bounding rects / is not hidden
            let visible = false;
            try {
                if (splash) {
                    const rects = splash.getClientRects();
                    const style = window.getComputedStyle(splash);
                    visible = rects.length > 0 && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
                }
            } catch (e) {
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
    }, []);

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('openAI') === '1') {
                // schedule async to avoid sync setState in effect
                Promise.resolve().then(() => setIsOpen(true));
                // remove the param to avoid reopening on navigation
                params.delete('openAI');
                const newQs = params.toString();
                const newUrl = window.location.pathname + (newQs ? `?${newQs}` : '') + window.location.hash;
                window.history.replaceState({}, '', newUrl);
            }
        } catch {
            // ignore
        }
    }, []);

    // We always render the launcher; AppShell ensures a single instance.

    const wrapperClass = attachedToSplash
        ? 'fixed left-1/2 -translate-x-1/2 bottom-[40%] z-[2710]'
        : 'fixed z-[2710] right-[max(1rem,env(safe-area-inset-right,0px))] max-md:bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]';

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        if (isOpen) document.body.classList.add('ai-open');
        else document.body.classList.remove('ai-open');

        return () => document.body.classList.remove('ai-open');
    }, [isOpen]);

    return (
        <>
            <div id="pricemate-ai-launcher" className={wrapperClass}>
                {!isOpen && !hideWhileSplash && (
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="flex items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-xl shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-800 active:scale-95 md:h-16 md:w-16 h-14 w-14 touch-none md:touch-auto"
                        title="AI Assistant"
                        aria-label="Open AI Assistant"
                    >
                        <FiCpu className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
                    </button>
                )}
            </div>
            <AIChatBox isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};


export default FloatingAIChatLauncher;
