import AIChatBox from '../components/AIChatBox';
import useAiChatViewportMeta from '../hooks/useAiChatViewportMeta';

const AIChat = () => {
    useAiChatViewportMeta(true);

    return (
        <div className="pricemate-ai-chat-page-root flex flex-col w-full max-w-4xl mx-auto flex-1 min-h-[100dvh] max-h-[100dvh] md:min-h-screen md:max-h-none overflow-hidden bg-white dark:bg-gray-900 max-md:pb-0 md:pb-8">
            <AIChatBox isOpen variant="page" />
        </div>
    );
};

export default AIChat;
