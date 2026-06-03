import { create } from 'zustand';
import { db, Query } from '../lib/appwrite';

/** Matches user-app: documents without conversationId belong to legacy thread. */
export const LEGACY_THREAD_KEY = 'legacy';

export const messageThreadKey = (msg) =>
    msg.conversationId && String(msg.conversationId).trim() !== ''
        ? msg.conversationId
        : LEGACY_THREAD_KEY;

const PAGE_SIZE = 100;

/** Fetch all documents matching queries (Appwrite caps a single list response). */
const listAllPages = async (listFn, baseQueries) => {
    const all = [];
    let lastId;
    for (;;) {
        const queries = [...baseQueries, Query.limit(PAGE_SIZE)];
        if (lastId) queries.push(Query.cursorAfter(lastId));
        const res = await listFn(queries);
        if (res.documents.length === 0) break;
        all.push(...res.documents);
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
    text: msg.text || msg.content || '',
    role: msg.role,
    timestamp: msg.timestamp || msg.$createdAt,
    userName: msg.userName,
    userEmail: msg.userEmail,
    conversationId: msg.conversationId || null,
});

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

export const useChatHistoryStore = create((set) => ({
    groupedHistory: {},
    loading: false,
    error: null,

    fetchHistory: async () => {
        set({ loading: true, error: null });
        try {
            const documents = await listAllPages(db.chatHistory.list.bind(db.chatHistory), [
                Query.orderAsc('$id'),
            ]);

            const grouped = documents.reduce((acc, doc) => {
                const uid = doc.userId || 'anonymous';
                if (!acc[uid]) acc[uid] = [];
                acc[uid].push(mapDocumentToMessage(doc));
                return acc;
            }, {});

            for (const uid of Object.keys(grouped)) {
                grouped[uid].sort(
                    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
                );
            }

            set({ groupedHistory: grouped, loading: false });
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
            set({ error: error.message, loading: false });
        }
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
                return { groupedHistory: updated, loading: false };
            });
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
                return { groupedHistory: updated, loading: false };
            });
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
                return { groupedHistory: updated, loading: false };
            });
            return true;
        } catch (error) {
            console.error('Failed to delete user history:', error);
            set({ error: error.message, loading: false });
            return false;
        }
    },
}));
