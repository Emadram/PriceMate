import { useState } from 'react';
import { FiList } from 'react-icons/fi';
import AIChatBox from './AIChatBox';

const FloatingAIChatLauncher = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-xl shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-800 active:scale-95 md:h-16 md:w-16 right-[max(1rem,env(safe-area-inset-right,0px))] max-md:bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]"
                title="AI Assistant"
                aria-label="Open AI Assistant"
            >
                <FiList className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
            </button>
            <AIChatBox isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default FloatingAIChatLauncher;
