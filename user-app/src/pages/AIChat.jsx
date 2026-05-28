import AIChatBox from '../components/AIChatBox';
import { MobilePage } from '../components/MobilePageLayout';
import { useEffect } from 'react';
import useAppViewportHeight from '../hooks/useAppViewportHeight';

const AIChat = () => {
    useAppViewportHeight(true);

    useEffect(() => {
        // Lock document scrolling on the dedicated AI chat page.
        // The message list inside AIChatBox remains scrollable.
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';

        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
        };
    }, []);

    return (
        <MobilePage className="min-h-[100dvh]">
            <div
                className="max-w-4xl mx-auto flex flex-col min-h-0 overflow-hidden"
                style={{ height: 'var(--app-dvh, 100dvh)' }}
            >
                <AIChatBox isOpen variant="page" />
            </div>
        </MobilePage>
    );
};

export default AIChat;

