import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MOBILE_SPLASH_KEY = 'pricemate-mobile-splash-seen';
const SCROLL_KEY_PREFIX = 'pricemate-scroll:';

const shouldShowInitialSplash = () => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(max-width: 767px)').matches &&
        sessionStorage.getItem(MOBILE_SPLASH_KEY) !== '1'
    );
};

const isDarkModeActive = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    return (
        document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );
};

const MobileSplashScreen = () => {
    const { t } = useTranslation();
    const [phase, setPhase] = useState(() => (shouldShowInitialSplash() ? 'visible' : 'hidden'));
    const [isPageLoaded, setIsPageLoaded] = useState(
        () => typeof document !== 'undefined' && document.readyState === 'complete'
    );
    const isDark = isDarkModeActive();

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (!isMobile || sessionStorage.getItem(MOBILE_SPLASH_KEY) === '1') {
            return undefined;
        }

        sessionStorage.setItem(MOBILE_SPLASH_KEY, '1');
        // save current scroll for the current path so we can restore it after the splash
        try {
            const path = window.location.pathname || '/';
            sessionStorage.setItem(`${SCROLL_KEY_PREFIX}${path}`, String(window.scrollY || window.pageYOffset || 0));
        } catch {
            // ignore storage errors
        }

        const timers = [];
        const beginExit = () => {
            setIsPageLoaded(true);
            timers.push(window.setTimeout(() => setPhase('exiting'), 700));
            timers.push(window.setTimeout(() => setPhase('hidden'), 1200));
        };

        if (document.readyState === 'complete') {
            beginExit();
        } else {
            window.addEventListener('load', beginExit, { once: true });
        }

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            window.removeEventListener('load', beginExit);
        };
    }, []);

    useEffect(() => {
        if (phase === 'hidden' || typeof document === 'undefined') return undefined;

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.classList.add('pricemate-splash-active');
        document.documentElement.classList.add('pricemate-splash-active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        // Ensure we start at the top while the splash is visible
        try {
            window.scrollTo(0, 0);
        } catch {
            // ignore scroll errors
        }

        return () => {
            document.body.classList.remove('pricemate-splash-active');
            document.documentElement.classList.remove('pricemate-splash-active');
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            // restore stored scroll for this path (if any)
            try {
                const path = window.location.pathname || '/';
                const stored = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${path}`);
                if (stored !== null) {
                    const pos = parseInt(stored, 10) || 0;
                    window.setTimeout(() => window.scrollTo(0, pos), 30);
                }
            } catch {
                // ignore restore errors
            }
        };
    }, [phase]);

    if (phase === 'hidden') {
        return null;
    }

    const overlayTone = isDark ? 'bg-slate-950 text-white' : 'bg-[#faf5ff] text-slate-950';
    const surfaceTone = 'from-brand-500 via-brand-600 to-brand-700';
    const mutedTone = isDark ? 'text-white/65' : 'text-slate-500';
    const promptTone = isDark ? 'text-brand-300' : 'text-brand-600';
    const shouldFade = phase === 'exiting';

    return (
        <div
            id="pricemate-mobile-splash"
            className={`fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden transition-all duration-500 ${overlayTone} ${shouldFade ? 'opacity-0 scale-[1.03]' : 'opacity-100'}`}
            aria-hidden="true"
        >
            <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.24),transparent_38%),linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,1))]' : 'bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_38%),linear-gradient(180deg,#faf5ff,#ffffff)]'}`} />
            <div className="relative flex w-full max-w-sm flex-col items-center px-8 text-center touch-none">
                <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
                    <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${surfaceTone} shadow-[0_24px_80px_rgba(79,70,229,0.35)]`} />
                    <div className="absolute inset-2 rounded-[1.6rem] border border-white/20" />
                    <div className={`absolute inset-[18px] rounded-[1.25rem] border border-white/18 bg-white/8 backdrop-blur-sm ${shouldFade ? 'animate-none' : 'animate-splash-glow'}`} />
                    <div className={`absolute right-5 top-8 h-3 w-3 rounded-full bg-white/85 ${shouldFade ? 'animate-none' : 'animate-pulse'}`} />
                    <div className={`absolute left-5 bottom-8 h-2 w-2 rounded-full bg-white/75 ${shouldFade ? 'animate-none' : 'animate-pulse'} delay-100`} />
                    <img
                        src="/LogoPriceMate.png"
                        alt="PriceMate"
                        className="relative h-20 w-20 object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
                        loading="eager"
                        decoding="async"
                    />
                    <div className={`absolute inset-x-7 -bottom-3 h-3 rounded-full ${isDark ? 'bg-brand-400/35' : 'bg-brand-500/25 blur-[3px]'} ${shouldFade ? 'animate-none' : 'animate-splash-ripple'}`} />
                </div>

                <div className="space-y-2">
                    <p className={`text-[10px] font-black uppercase tracking-[0.5em] ${promptTone}`}>PriceMate</p>
                    <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
                        PriceMate
                    </h1>
                    {isPageLoaded && (
                        <p className={`mx-auto max-w-[18rem] text-sm font-medium leading-relaxed ${mutedTone}`}>
                            {t('mobile_splash_ready', 'Smart price tracking, ready when you are.')}
                        </p>
                    )}
                </div>

                {/* The launcher button is rendered by FloatingAIChatLauncher and will position itself over the splash when attached. */}

                <div className="mt-8 flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full bg-brand-500 ${shouldFade ? 'animate-none' : 'animate-pulse'}`} />
                    <div className={`h-2.5 w-2.5 rounded-full bg-brand-400 ${shouldFade ? 'animate-none' : 'animate-pulse'} delay-100`} />
                    <div className={`h-2.5 w-2.5 rounded-full bg-accent-500 ${shouldFade ? 'animate-none' : 'animate-pulse'} delay-200`} />
                </div>
            </div>
        </div>
    );
};

export default MobileSplashScreen;
