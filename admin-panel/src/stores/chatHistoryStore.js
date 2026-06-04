import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';
import { invalidateCacheKey } from '../utils/readCache';

/** Matches user-app: documents without conversationId belong to legacy thread. */
export const LEGACY_THREAD_KEY = 'legacy';

export const DEFAULT_SESSION_INDEX_MAX = 500;
const SESSION_INDEX_TTL_MS = 3 * 60 * 1000;
const SESSION_CACHE_KEY = 'admin:chat-session-index:v1';

const PAGE_SIZE = 100;

export const messageThreadKey = (msg) =>
    msg.conversationId && String(msg.conversationId).trim() !== ''
        ? msg.conversationId
        : LEGACY_THREAD_KEY;

/** Fetch documents matching queries (cursor pagination). */
const listAllPages = async (listFn, baseQueries, maxDocs = Infinity) => {
    const all = [];
    let lastId;
    for (;;) {
        const queries = [...baseQueries, Query.limit(PAGE_SIZE)];
        if (lastId) queries.push(Query.cursorAfter(lastId));
        const res = await listFn(queries);
        if (res.documents.length === 0) break;
        all.push(...res.documents);
        if (all.length >= maxDocs) {
            return all.slice(0, maxDocs);
        }
        if (res.documents.length < PAGE_SIZE) break;
        lastId = res.documents[res.documents.length - 1].$id;
    }
    return all;
};

const listRecentPages = async (listFn, baseQueries, maxMessages) => {
    const all = [];
    let lastId;
    for (;;) {
        const queries = [...baseQueries, Query.limit(PAGE_SIZE)];
        if (lastId) queries.push(Query.cursorAfter(lastId));
        const res = await listFn(queries);
        if (res.documents.length === 0) break;
        all.push(...res.documents);
        if (all.length >= maxMessages) {
            return all.slice(0, maxMessages);
        }
        if (res.documents.length < PAGE_SIZE) break;
        lastId = res.documents[res.documents.length - 1].$id;
    }
    return all;
};

const deleteMemoryFor = async (userId, threadKey = null) => {
    if (!db.aiChatMemory || !userId) return;
    try {
        const baseQueries = [Query.equal('userId', userId), Query.orderAsc('$id')];
        if (threadKey && threadKey !== LEGACY_THREAD_KEY) {
            baseQueries.unshift(Query.equal('conversationId', threadKey));
        }
        const docs = await listAllPages(db.aiChatMemory.list.bind(db.aiChatMemory), baseQueries);
        await Promise.all(docs.map((doc) => db.aiChatMemory.delete(doc.$id)));
    } catch (error) {
        const msg = String(error?.message || '');
        if (error?.code === 404 || /not found|collection/i.test(msg)) return;
        throw error;
    }
};

const mapDocumentToMessage = (msg) => ({
    id: msg.$id,
    userId: msg.userId,
    text: msg.text || msg.content || '',
    role: msg.role,
    timestamp: msg.timestamp || msg.$createdAt,
    userName: msg.userName,
    userEmail: msg.userEmail,
    conversationId: msg.conversationId || null,
});

const groupDocumentsByUser = (documents) => {
    const grouped = documents.reduce((acc, doc) => {
        const uid = doc.userId || 'anonymous';
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(mapDocumentToMessage(doc));
        return acc;
    }, {});

    for (const uid of Object.keys(grouped)) {
        grouped[uid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    return grouped;
};

export const groupMessagesByThread = (messages) => {
    const byThread = {};
    for (const m of messages) {
        const key = messageThreadKey(m);
        if (!byThread[key]) byThread[key] = [];
        byThread[key].push(m);
    }
    for (const key of Object.keys(byThread)) {
        byThread[key].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
    }
    return byThread;
};

export const useChatHistoryStore = create((set, get) => ({
    groupedHistory: {},
    loading: false,
    error: null,
    lastFetchedAt: null,
    sessionIndexCapped: false,
    maxMessagesLoaded: 0,
    threadDetail: { userId: null, threadKey: null, messages: [] },

    fetchSessionIndex: async ({
        maxMessages = DEFAULT_SESSION_INDEX_MAX,
        force = false,
    } = {}) => {
        const { lastFetchedAt, loading } = get();
        if (
            !force &&
            lastFetchedAt &&
            Date.now() - lastFetchedAt < SESSION_INDEX_TTL_MS &&
            Object.keys(get().groupedHistory).length > 0
        ) {
            return;
        }
        if (loading && !force) return;

        set({ loading: true, error: null });
        try {
            const documents = await listRecentPages(
                db.chatHistory.list.bind(db.chatHistory),
                [Query.orderDesc('timestamp')],
                maxMessages
            );

            const grouped = groupDocumentsByUser(documents);
            const capped = documents.length >= maxMessages;

            set({
                groupedHistory: grouped,
                loading: false,
                lastFetchedAt: Date.now(),
                sessionIndexCapped: capped,
                maxMessagesLoaded: documents.length,
            });
        } catch (error) {
            console.error('Failed to fetch chat session index:', error);
            set({ error: error.message, loading: false });
        }
    },

    /** @deprecated Use fetchSessionIndex — kept for callers migrating gradually */
    fetchHistory: async (options = {}) =>
        get().fetchSessionIndex({
            maxMessages: options.maxMessages ?? DEFAULT_SESSION_INDEX_MAX,
            force: options.force ?? false,
        }),

    fetchUserMessages: async (userId, { maxMessages = 500 } = {}) => {
        if (!userId) return;
        set({ loading: true, error: null });
        try {
            const documents = await listRecentPages(
                db.chatHistory.list.bind(db.chatHistory),
                [Query.equal('userId', userId), Query.orderDesc('timestamp')],
                maxMessages
            );
            const messages = documents
                .map(mapDocumentToMessage)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            set((state) => ({
                groupedHistory: { ...state.groupedHistory, [userId]: messages },
                loading: false,
            }));
        } catch (error) {
            console.error('Failed to fetch user messages:', error);
            set({ error: error.message, loading: false });
        }
    },

    fetchThreadMessages: async (userId, threadKey) => {
        if (!userId || !threadKey) return;
        set({ loading: true, error: null });
        try {
            const baseQueries =
                threadKey === LEGACY_THREAD_KEY
                    ? [
                          Query.equal('userId', userId),
                          Query.isNull('conversationId'),
                          Query.orderAsc('$id'),
                      ]
                    : [
                          Query.equal('userId', userId),
                          Query.equal('conversationId', threadKey),
                          Query.orderAsc('$id'),
                      ];

            const documents = await listAllPages(
                db.chatHistory.list.bind(db.chatHistory),
                baseQueries
            );
            const messages = documents.map(mapDocumentToMessage);

            set({
                threadDetail: { userId, threadKey, messages },
                loading: false,
            });
        } catch (error) {
            console.error('Failed to fetch thread messages:', error);
            set({ error: error.message, loading: false });
        }
    },

    invalidate: () => {
        invalidateCacheKey(SESSION_CACHE_KEY);
        set({ lastFetchedAt: null });
    },

    deleteMessage: async (messageId, userId) => {
        set({ loading: true, error: null });
        try {
            await db.chatHistory.delete(messageId);
            set((state) => {
                const updated = { ...state.groupedHistory };
                if (updated[userId]) {
                    updated[userId] = updated[userId].filter((msg) => msg.id !== messageId);
                    if (updated[userId].length === 0) {
                        delete updated[userId];
                    }
                }
                const threadMessages = state.threadDetail.messages.filter(
                    (msg) => msg.id !== messageId
                );
                return {
                    groupedHistory: updated,
                    threadDetail: { ...state.threadDetail, messages: threadMessages },
                    loading: false,
                };
            });
            get().invalidate();
            return true;
        } catch (error) {
            console.error('Failed to delete message:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteThread: async (userId, threadKey) => {
        set({ loading: true, error: null });
        try {
            const baseQueries =
                threadKey === LEGACY_THREAD_KEY
                    ? [
                          Query.equal('userId', userId),
                          Query.isNull('conversationId'),
                          Query.orderAsc('$id'),
                      ]
                    : [
                          Query.equal('userId', userId),
                          Query.equal('conversationId', threadKey),
                          Query.orderAsc('$id'),
                      ];

            const toDelete = await listAllPages(db.chatHistory.list.bind(db.chatHistory), baseQueries);
            await Promise.all(toDelete.map((doc) => db.chatHistory.delete(doc.$id)));
            await deleteMemoryFor(userId, threadKey);

            set((state) => {
                const msgs = state.groupedHistory[userId] || [];
                const kept = msgs.filter((m) => messageThreadKey(m) !== threadKey);
                const updated = { ...state.groupedHistory };
                if (kept.length === 0) delete updated[userId];
                else updated[userId] = kept;

                const clearThreadDetail =
                    state.threadDetail.userId === userId &&
                    state.threadDetail.threadKey === threadKey;

                return {
                    groupedHistory: updated,
                    threadDetail: clearThreadDetail
                        ? { userId: null, threadKey: null, messages: [] }
                        : state.threadDetail,
                    loading: false,
                };
            });
            get().invalidate();
            return true;
        } catch (error) {
            console.error('Failed to delete thread:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    deleteUserHistory: async (userId) => {
        set({ loading: true, error: null });
        try {
            const toDelete = await listAllPages(db.chatHistory.list.bind(db.chatHistory), [
                Query.equal('userId', userId),
                Query.orderAsc('$id'),
            ]);

            await Promise.all(toDelete.map((doc) => db.chatHistory.delete(doc.$id)));
            await deleteMemoryFor(userId);

            set((state) => {
                const updated = { ...state.groupedHistory };
                delete updated[userId];
                return {
                    groupedHistory: updated,
                    threadDetail:
                        state.threadDetail.userId === userId
                            ? { userId: null, threadKey: null, messages: [] }
                            : state.threadDetail,
                    loading: false,
                };
            });
            get().invalidate();
            return true;
        } catch (error) {
            console.error('Failed to delete user history:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },
}));
