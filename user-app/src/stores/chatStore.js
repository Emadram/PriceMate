import { create } from 'zustand';
import { db, Query, client, DATABASE_ID, COLLECTIONS, ID } from '../lib/appwrite';

/** Messages with no `conversationId` in Appwrite are grouped under this id in the UI. */
export const LEGACY_CONVERSATION_ID = 'legacy';

/** Set on write failures when Appwrite schema lacks optional multithread attribute (see appwrite.js). */
export const CHAT_ERROR_MISSING_CONVERSATION_ID = 'MISSING_CONVERSATION_ID_ATTR';

const normalizedConversationId = (doc) => {
    const v = doc.conversationId;
    if (v == null || v === '') return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};

const threadKeyFromDoc = (doc) => normalizedConversationId(doc) || LEGACY_CONVERSATION_ID;

const messageMatchesActive = (doc, userId, activeConversationId) => {
    if (doc.userId !== userId) return false;
    const cid = normalizedConversationId(doc);
    if (activeConversationId === LEGACY_CONVERSATION_ID) {
        return cid == null;
    }
    return cid === activeConversationId;
};

const sortMessagesAsc = (a, b) => new Date(a.timestamp) - new Date(b.timestamp);

const buildSummariesFromDocuments = (documents) => {
    const byThread = new Map();

    for (const doc of documents) {
        const tid = threadKeyFromDoc(doc);
        if (!byThread.has(tid)) {
            byThread.set(tid, { id: tid, docs: [] });
        }
        byThread.get(tid).docs.push(doc);
    }

    const summaries = [];

    for (const { id, docs } of byThread.values()) {
        const sorted = [...docs].sort(sortMessagesAsc);
        const firstUser = sorted.find((d) => d.role === 'user');
        const latestTs = sorted.reduce(
            (max, d) => (new Date(d.timestamp) > new Date(max) ? d.timestamp : max),
            sorted[0].timestamp
        );
        const raw = firstUser?.content?.trim() || '';
        const title =
            raw.length > 0 ? (raw.length > 48 ? `${raw.slice(0, 48)}…` : raw) : '';

        let startedAtMs = Infinity;
        for (const d of sorted) {
            const t = new Date(d.timestamp || d.$createdAt).getTime();
            if (!Number.isNaN(t)) startedAtMs = Math.min(startedAtMs, t);
        }
        if (startedAtMs === Infinity) startedAtMs = 0;

        summaries.push({
            id,
            title,
            updatedAt: latestTs,
            startedAtMs,
        });
    }

    const byStart = [...summaries].sort((a, b) => a.startedAtMs - b.startedAtMs);
    const indexById = new Map();
    byStart.forEach((s, i) => indexById.set(s.id, i + 1));

    summaries.forEach((s) => {
        s.chatIndex = indexById.get(s.id);
        delete s.startedAtMs;
    });

    summaries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return summaries;
};

const listAllThreadDocuments = async (userId, conversationId) => {
    const baseQueries =
        conversationId === LEGACY_CONVERSATION_ID
            ? [
                  Query.equal('userId', userId),
                  Query.isNull('conversationId'),
                  Query.orderAsc('$id'),
                  Query.limit(100),
              ]
            : [
                  Query.equal('userId', userId),
                  Query.equal('conversationId', conversationId),
                  Query.orderAsc('$id'),
                  Query.limit(100),
              ];

    const all = [];
    let lastId = undefined;

    for (;;) {
        const pageQueries = lastId ? [...baseQueries, Query.cursorAfter(lastId)] : baseQueries;
        const res = await db.chatHistory.list(pageQueries);
        if (res.documents.length === 0) break;
        all.push(...res.documents);
        if (res.documents.length < 100) break;
        lastId = res.documents[res.documents.length - 1].$id;
    }

    return all;
};

/** Serialize session bootstrap so overlapping calls (Strict Mode, fast navigation) never double-run the empty-session branch. */
let initSessionMutex = Promise.resolve();

const useChatStore = create((set, get) => ({
    messages: [],
    conversationSummaries: [],
    activeConversationId: null,
    loading: false,
    summariesLoading: false,
    error: null,
    unsubscribe: null,

    resetChat: () => {
        if (get().unsubscribe) {
            get().unsubscribe();
        }
        initSessionMutex = Promise.resolve();
        set({
            messages: [],
            conversationSummaries: [],
            activeConversationId: null,
            loading: false,
            summariesLoading: false,
            error: null,
            unsubscribe: null,
        });
    },

    clearConversationSelection: () => {
        if (get().unsubscribe) {
            get().unsubscribe();
        }
        set({
            activeConversationId: null,
            messages: [],
            unsubscribe: null,
            loading: false,
            error: null,
        });
    },

    startNewConversation: () => {
        if (get().unsubscribe) {
            get().unsubscribe();
        }
        set({
            activeConversationId: ID.unique(),
            messages: [],
            unsubscribe: null,
            loading: false,
            error: null,
        });
    },

    clearChatWriteError: () => set({ error: null }),

    fetchConversationSummaries: async (userId) => {
        if (!userId) return;
        set({ summariesLoading: true, error: null });
        try {
            const baseQueries = [
                Query.equal('userId', userId),
                Query.orderAsc('$id'),
                Query.limit(100),
            ];
            const allDocs = [];
            let lastId;
            for (;;) {
                const pageQueries = lastId
                    ? [...baseQueries, Query.cursorAfter(lastId)]
                    : baseQueries;
                const response = await db.chatHistory.list(pageQueries);
                if (response.documents.length === 0) break;
                allDocs.push(...response.documents);
                if (response.documents.length < 100) break;
                lastId = response.documents[response.documents.length - 1].$id;
            }
            set({
                conversationSummaries: buildSummariesFromDocuments(allDocs),
                summariesLoading: false,
            });
        } catch (error) {
            console.error('Failed to fetch conversation summaries:', error);
            set({ error: error.message, summariesLoading: false });
        }
    },

    fetchMessagesForConversation: async (userId, conversationId, options = {}) => {
        const { quiet = false } = options;
        if (!userId || !conversationId) return;

        if (get().unsubscribe) {
            get().unsubscribe();
        }

        if (!quiet) {
            set({ loading: true, error: null, activeConversationId: conversationId });
        } else {
            set({ error: null, activeConversationId: conversationId });
        }

        try {
            const documents = (await listAllThreadDocuments(userId, conversationId)).sort(
                sortMessagesAsc
            );
            set({ messages: documents, loading: false });

            const unsubscribe = client.subscribe(
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_HISTORY}.documents`,
                (subResponse) => {
                    const { events, payload } = subResponse;
                    if (payload.userId !== userId) return;
                    const activeId = get().activeConversationId;
                    if (!messageMatchesActive(payload, userId, activeId)) return;

                    if (events.includes('databases.*.collections.*.documents.*.create')) {
                        set((state) => ({
                            messages: [...state.messages.filter((m) => m.$id !== payload.$id), payload].sort(
                                sortMessagesAsc
                            ),
                        }));
                    }
                }
            );

            set({ unsubscribe });
        } catch (error) {
            console.error('Failed to fetch chat messages:', error);
            set({ error: error.message, loading: false });
        }
    },

    /**
     * Refresh thread list and land with no conversation selected until the user clicks New.
     */
    initializeChatSession: async (userId) => {
        if (!userId) return;

        const job = initSessionMutex.then(async () => {
            await get().fetchConversationSummaries(userId);
            get().clearConversationSelection();
        });

        initSessionMutex = job.catch((err) => {
            console.error('initializeChatSession failed:', err);
        });
        await job;
    },

    addMessage: async (userId, role, content, userProfile) => {
        if (!userId) return null;

        const activeConversationId = get().activeConversationId;
        if (!activeConversationId) return null;

        set({ error: null });

        const newMessage = {
            userId,
            role,
            content,
            timestamp: new Date().toISOString(),
            userName: userProfile?.name || userProfile?.userName || '',
            userEmail: userProfile?.email || '',
        };

        if (activeConversationId !== LEGACY_CONVERSATION_ID) {
            newMessage.conversationId = activeConversationId;
        }

        try {
            const doc = await db.chatHistory.create(newMessage);

            if (messageMatchesActive(doc, userId, get().activeConversationId)) {
                set((state) => ({
                    messages: [...state.messages.filter((m) => m.$id !== doc.$id), doc].sort(sortMessagesAsc),
                }));
            }

            await get().fetchConversationSummaries(userId);
            return doc;
        } catch (error) {
            console.error('Failed to save message:', error);
            const msg = String(error?.message || error || '');
            const isMissingConversationIdAttr =
                /Unknown attribute[:\s]+"?conversationId"?/i.test(msg) ||
                (msg.includes('Unknown attribute') && msg.includes('conversationId'));

            set({
                error: isMissingConversationIdAttr ? CHAT_ERROR_MISSING_CONVERSATION_ID : msg,
            });
            if (!isMissingConversationIdAttr) {
                const fallback = { ...newMessage, $id: 'temp-' + Date.now() };
                if (messageMatchesActive(fallback, userId, get().activeConversationId)) {
                    set((state) => ({
                        messages: [...state.messages, fallback].sort(sortMessagesAsc),
                    }));
                }
            }
            return null;
        }
    },

    deleteConversation: async (userId, conversationId) => {
        if (!userId || !conversationId) return;

        try {
            const docs = await listAllThreadDocuments(userId, conversationId);
            await Promise.all(docs.map((d) => db.chatHistory.delete(d.$id)));

            const wasActive = get().activeConversationId === conversationId;

            await get().fetchConversationSummaries(userId);

            if (wasActive) {
                const { conversationSummaries } = get();
                if (conversationSummaries.length === 0) {
                    get().clearConversationSelection();
                } else {
                    await get().fetchMessagesForConversation(userId, conversationSummaries[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            set({ error: error.message });
        }
    },

    clearHistory: async () => {
        set({ messages: [] });
    },
}));

export default useChatStore;
