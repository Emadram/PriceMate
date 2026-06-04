import AIChatBox from '../components/AIChatBox';
import useAiChatViewportMeta from '../hooks/useAiChatViewportMeta';
import useAppViewportHeight from '../hooks/useAppViewportHeight';
import useDocumentScrollLock from '../hooks/useDocumentScrollLock';

const AIChat = () => {
    useAiChatViewportMeta(true);
    useAppViewportHeight(true, { keyboardOverlayMode: true });
    // Prevent body scroll behind the fixed /ai-chat layout (iOS Safari especially).
    useDocumentScrollLock(true);

    return (
        <div
            className="pricemate-ai-chat-page-root flex flex-col w-full max-w-4xl mx-auto flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-900 md:min-h-screen md:pb-8 max-md:fixed max-md:inset-x-0 max-md:top-[var(--app-vv-top,0px)] max-md:bottom-[calc(var(--bottom-nav-h,0px)+env(safe-area-inset-bottom,0px))] max-md:h-[calc(var(--app-dvh,100dvh)-var(--bottom-nav-h,0px)-env(safe-area-inset-bottom,0px))] max-md:max-h-none md:h-auto"
        >
            <AIChatBox isOpen variant="page" />
        </div>
    );
};

export default AIChat;
