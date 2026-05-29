import AIChatBox from '../components/AIChatBox';
import { useEffect } from 'react';
import useAppViewportHeight from '../hooks/useAppViewportHeight';

const AIChat = () => {
    useAppViewportHeight(true);

    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.classList.add('pricemate-ai-chat-page');

        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
            body.classList.remove('pricemate-ai-chat-page');
        };
    }, []);

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto h-full min-h-0 flex-1 overflow-hidden bg-white dark:bg-gray-900">
            <AIChatBox isOpen variant="page" />
        </div>
    );
};

export default AIChat;
