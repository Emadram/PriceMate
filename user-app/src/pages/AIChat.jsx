import AIChatBox from '../components/AIChatBox';
import useAiChatViewportMeta from '../hooks/useAiChatViewportMeta';
import useAppViewportHeight from '../hooks/useAppViewportHeight';

const AIChat = () => {
    useAiChatViewportMeta(true);
    useAppViewportHeight(true);

    return (
        <div className="pricemate-ai-chat-page-root flex flex-col w-full max-w-4xl mx-auto flex-1 min-h-0 h-[var(--app-dvh,100dvh)] max-h-[var(--app-dvh,100dvh)] md:min-h-screen md:max-h-none md:h-auto overflow-hidden bg-white dark:bg-gray-900 max-md:pb-[calc(var(--bottom-nav-h,0px)+env(safe-area-inset-bottom,0px))] md:pb-8">
            <AIChatBox isOpen variant="page" />
        </div>
    );
};

export default AIChat;
