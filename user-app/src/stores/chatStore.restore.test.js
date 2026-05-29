import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

const listMock = vi.fn();

const memoryStorage = () => {
    const map = new Map();
    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => {
            map.set(key, String(value));
        },
        removeItem: (key) => {
            map.delete(key);
        },
        clear: () => {
            map.clear();
        },
    };
};

vi.mock('../lib/appwrite', () => ({
    db: {
        chatHistory: {
            list: (...args) => listMock(...args),
            create: vi.fn(),
            delete: vi.fn(),
        },
    },
    client: {
        subscribe: vi.fn(() => () => {}),
    },
    DATABASE_ID: 'test-db',
    COLLECTIONS: { CHAT_HISTORY: 'chat_history' },
    Query: {
        equal: vi.fn((field, value) => ({ field, value, op: 'equal' })),
        isNull: vi.fn((field) => ({ field, op: 'isNull' })),
        orderAsc: vi.fn((field) => ({ field, op: 'orderAsc' })),
        limit: vi.fn((n) => ({ op: 'limit', n })),
        cursorAfter: vi.fn((id) => ({ op: 'cursorAfter', id })),
    },
    ID: {
        unique: vi.fn(() => 'new-conversation-id'),
    },
}));

import useChatStore from './chatStore';

const userId = 'user-test-1';
const conversationId = 'conv-stored-1';

const sampleMessage = {
    $id: 'msg-1',
    userId,
    role: 'user',
    content: 'Hello',
    timestamp: '2026-05-01T10:00:00.000Z',
    conversationId,
};

const storageKey = (uid) => `pricemate_last_conversation_${uid}`;

describe('chatStore initializeChatSession restore', () => {
    let storage;

    beforeAll(() => {
        storage = memoryStorage();
        vi.stubGlobal('localStorage', storage);
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    beforeEach(() => {
        useChatStore.getState().resetChat();
        storage.clear();
        listMock.mockReset();
        listMock.mockResolvedValue({ documents: [sampleMessage] });
    });

    it('restores last stored conversation instead of clearing selection', async () => {
        localStorage.setItem(storageKey(userId), conversationId);

        await useChatStore.getState().initializeChatSession(userId);

        expect(useChatStore.getState().activeConversationId).toBe(conversationId);
        expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('falls back to most recent summary when stored id is invalid', async () => {
        localStorage.setItem(storageKey(userId), 'missing-conv');

        await useChatStore.getState().initializeChatSession(userId);

        expect(useChatStore.getState().activeConversationId).toBe(conversationId);
    });

    it('clears selection when user has no conversations', async () => {
        listMock.mockResolvedValue({ documents: [] });

        await useChatStore.getState().initializeChatSession(userId);

        expect(useChatStore.getState().activeConversationId).toBeNull();
        expect(useChatStore.getState().messages).toHaveLength(0);
    });
});
