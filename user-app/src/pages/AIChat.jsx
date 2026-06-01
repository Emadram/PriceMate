import AIChatBox from '../components/AIChatBox';
import useAppViewportHeight from '../hooks/useAppViewportHeight';
import useAiChatViewportMeta from '../hooks/useAiChatViewportMeta';
import useDocumentScrollLock from '../hooks/useDocumentScrollLock';

const AIChat = () => {
    useAiChatViewportMeta(true);
    useAppViewportHeight(true);
    useDocumentScrollLock(true);

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto h-full min-h-0 flex-1 overflow-hidden bg-white dark:bg-gray-900">
            <AIChatBox isOpen variant="page" />
        </div>
    );
};

export default AIChat;
