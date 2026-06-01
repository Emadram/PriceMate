import AIChatBox from '../components/AIChatBox';
import useAiChatViewportMeta from '../hooks/useAiChatViewportMeta';
import useAppViewportHeight from '../hooks/useAppViewportHeight';

const AIChat = () => {
    useAiChatViewportMeta(true);
    useAppViewportHeight(true, { keyboardOverlayMode: true });

    return (
        <div
            className="pricemate-ai-chat-page-root flex flex-col w-full max-w-4xl mx-auto flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-900 md:min-h-screen md:pb-8 max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:bottom-[calc(var(--bottom-nav-h,0px)+env(safe-area-inset-bottom,0px))] max-md:h-auto max-md:max-h-none md:h-auto"
        >
            <AIChatBox isOpen variant="page" />
        </div>
    );
};

export default AIChat;
