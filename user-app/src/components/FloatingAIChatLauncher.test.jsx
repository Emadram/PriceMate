import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FloatingAIChatLauncher from './FloatingAIChatLauncher';

vi.mock('./AIChatBox', () => ({
    default: ({ isOpen, onClose }) => (isOpen ? <div data-testid="mock-ai-chat"><button type="button" onClick={onClose}>close</button></div> : null),
}));

vi.mock('../stores/authStore', () => ({
    default: (selector) => selector({ user: null, logout: vi.fn() }),
}));

vi.mock('../stores/currencyStore', () => ({
    default: () => ({ currency: 'TRY', convert: (v) => v, getCurrencySymbol: () => '₺' }),
}));

vi.mock('../stores/chatStore', () => ({
    default: (selector) =>
        selector({
            messages: [],
            conversationSummaries: [],
            activeConversationId: null,
            error: null,
            addMessage: vi.fn(),
            loading: false,
            summariesLoading: false,
            initializeChatSession: vi.fn(),
            startNewConversation: vi.fn(),
            fetchMessagesForConversation: vi.fn(),
            deleteConversation: vi.fn(),
            resetChat: vi.fn(),
            clearChatWriteError: vi.fn(),
        }),
    CHAT_ERROR_MISSING_CONVERSATION_ID: 'missing',
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { language: 'en', changeLanguage: vi.fn(), resolvedLanguage: 'en' },
    }),
}));

const mockMatchMedia = (desktop) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: query === '(min-width: 768px)' ? desktop : query === '(min-width: 640px)' ? desktop : false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
};

describe('FloatingAIChatLauncher', () => {
    beforeEach(() => {
        document.body.classList.remove('ai-open');
    });

    it('returns null on mobile (no FAB flash mount)', () => {
        mockMatchMedia(false);
        const { container } = render(<FloatingAIChatLauncher />);
        expect(container.firstChild).toBeNull();
        expect(screen.queryByRole('button', { name: /open ai assistant/i })).toBeNull();
    });

    it('renders FAB on desktop', () => {
        mockMatchMedia(true);
        render(<FloatingAIChatLauncher />);
        expect(screen.getByRole('button', { name: /open ai assistant/i })).toBeTruthy();
        expect(document.getElementById('pricemate-ai-launcher')).toBeTruthy();
    });
});
