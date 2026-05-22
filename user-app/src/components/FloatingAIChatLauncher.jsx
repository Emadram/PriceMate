import { useState } from 'react';
import { Bot } from 'lucide-react';
import AIChatBox from './AIChatBox';

const FloatingAIChatLauncher = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-neutral-900 text-neutral-100 shadow-xl shadow-black/25 transition hover:bg-neutral-800 active:scale-95 dark:border-white/15 dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-black/30 dark:hover:bg-neutral-200 md:h-16 md:w-16 right-[max(1rem,env(safe-area-inset-right,0px))] max-md:bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]"
                title="AI Assistant"
                aria-label="Open AI Assistant"
            >
                <Bot className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2} aria-hidden />
            </button>
            <AIChatBox isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default FloatingAIChatLauncher;
