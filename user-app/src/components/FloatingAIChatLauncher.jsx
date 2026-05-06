import { useState } from 'react';
import { FiCpu } from 'react-icons/fi';
import AIChatBox from './AIChatBox';

const FloatingAIChatLauncher = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 active:scale-95 md:h-16 md:w-16"
                style={{
                    right: 'max(1rem, env(safe-area-inset-right))',
                    bottom: 'max(1rem, env(safe-area-inset-bottom))',
                }}
                title="AI Assistant"
                aria-label="Open AI Assistant"
            >
                <FiCpu className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
            </button>
            <AIChatBox isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default FloatingAIChatLauncher;
