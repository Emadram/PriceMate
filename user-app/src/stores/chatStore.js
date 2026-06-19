import { create } from 'zustand';
import { db, Query, client, DATABASE_ID, COLLECTIONS, ID } from '../lib/appwrite';
import { applyTitleOverlay } from '../utils/aiMemoryUtils';
import { CHAT_MESSAGES_TTL_MS, CHAT_SUMMARIES_TTL_MS } from '../utils/cacheTtls';

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

const listAllThreadDocuments = async (userId, conversationId, { select } = {}) => {
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
    if (select) baseQueries.push(Query.select(select));

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

const listAllMemoryDocuments = async (userId, conversationId = null) => {
    if (!userId || !db.aiChatMemory) return [];
    const baseQueries = [
        Query.equal('userId', userId),
        Query.orderAsc('$id'),
        Query.limit(100),
    ];
    if (conversationId && conversationId !== LEGACY_CONVERSATION_ID) {
        baseQueries.unshift(Query.equal('conversationId', conversationId));
    }

    const all = [];
    let lastId;
    for (;;) {
        const pageQueries = lastId ? [...baseQueries, Query.cursorAfter(lastId)] : baseQueries;
        const res = await db.aiChatMemory.list(pageQueries);
        if (res.documents.length === 0) break;
        all.push(...res.documents);
        if (res.documents.length < 100) break;
        lastId = res.documents[res.documents.length - 1].$id;
    }
    return all;
};

const deleteMemoryDocuments = async (userId, conversationId = null) => {
    try {
        const docs = await listAllMemoryDocuments(userId, conversationId);
        await Promise.all(docs.map((doc) => db.aiChatMemory.delete(doc.$id)));
        return true;
    } catch (error) {
        const msg = String(error?.message || '');
        if (error?.code === 404 || /not found|collection/i.test(msg)) return false;
        throw error;
    }
};

/** Serialize session bootstrap so overlapping calls (Strict Mode, fast navigation) never double-run the empty-session branch. */
let initSessionMutex = Promise.resolve();

const messagesCache = new Map();

const messagesCacheKey = (userId, conversationId) => `${userId}:${conversationId}`;

const getCachedMessages = (userId, conversationId) => {
    const entry = messagesCache.get(messagesCacheKey(userId, conversationId));
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CHAT_MESSAGES_TTL_MS) {
        messagesCache.delete(messagesCacheKey(userId, conversationId));
        return null;
    }
    return entry.messages;
};

const setCachedMessages = (userId, conversationId, messages) => {
    messagesCache.set(messagesCacheKey(userId, conversationId), {
        messages,
        fetchedAt: Date.now(),
    });
};

const SUMMARIES_TTL_MS = CHAT_SUMMARIES_TTL_MS;

const patchSummaryAfterMessage = (summaries, conversationId, timestamp) => {
    const idx = summaries.findIndex((s) => s.id === conversationId);
    if (idx < 0) return summaries;

    const next = [...summaries];
    next[idx] = { ...next[idx], updatedAt: timestamp };
    next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return next;
};

const lastConversationStorageKey = (userId) => `pricemate_last_conversation_${userId}`;

const readLastConversationId = (userId) => {
    if (!userId || typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const value = window.localStorage.getItem(lastConversationStorageKey(userId));
        return value && String(value).trim() ? String(value).trim() : null;
    } catch {
        return null;
    }
};

const writeLastConversationId = (userId, conversationId) => {
    if (!userId || !conversationId || typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(lastConversationStorageKey(userId), conversationId);
    } catch {
        // ignore quota / private mode
    }
};

const resolveConversationToRestore = (summaries, storedId) => {
    if (!summaries?.length) return null;
    const ids = new Set(summaries.map((s) => s.id));
    if (storedId && ids.has(storedId)) return storedId;
    return summaries[0]?.id ?? null;
};

const useChatStore = create((set, get) => ({
    messages: [],
    conversationSummaries: [],
    activeConversationId: null,
    loading: false,
    summariesLoading: false,
    error: null,
    unsubscribe: null,
    summariesUserId: null,
    summariesFetchedAt: null,

    resetChat: () => {
        if (get().unsubscribe) {
            get().unsubscribe();
        }
        initSessionMutex = Promise.resolve();
        messagesCache.clear();
        set({
            messages: [],
            conversationSummaries: [],
            activeConversationId: null,
            loading: false,
            summariesLoading: false,
            error: null,
            unsubscribe: null,
            summariesUserId: null,
            summariesFetchedAt: null,
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
        const newId = ID.unique();
        set({
            activeConversationId: newId,
            messages: [],
            unsubscribe: null,
            loading: false,
            error: null,
        });
        return newId;
    },

    clearChatWriteError: () => set({ error: null }),

    fetchConversationSummaries: async (userId, { force = false } = {}) => {
        if (!userId) return;

        const { summariesUserId, summariesFetchedAt, summariesLoading } = get();
        if (
            !force &&
            summariesUserId === userId &&
            summariesFetchedAt &&
            Date.now() - summariesFetchedAt < SUMMARIES_TTL_MS
        ) {
            return;
        }
        if (summariesLoading && !force) return;

        set({ summariesLoading: true, error: null });
        try {
            const SUMMARY_SELECT = ['$id', 'userId', 'role', 'conversationId', 'timestamp', '$createdAt'];
            const baseQueries = [
                Query.equal('userId', userId),
                Query.orderAsc('$id'),
                Query.limit(100),
                Query.select(SUMMARY_SELECT),
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
            let summaries = buildSummariesFromDocuments(allDocs);
            try {
                if (db.aiChatMemory) {
                    const titleDocs = [];
                    let lastId;
                    for (;;) {
                        const queries = [
                            Query.equal('userId', userId),
                            Query.equal('memoryType', 'conversation_title'),
                            Query.orderAsc('$id'),
                            Query.limit(100),
                        ];
                        if (lastId) queries.push(Query.cursorAfter(lastId));
                        const res = await db.aiChatMemory.list(queries);
                        if (res.documents.length === 0) break;
                        titleDocs.push(...res.documents);
                        if (res.documents.length < 100) break;
                        lastId = res.documents[res.documents.length - 1].$id;
                    }
                    summaries = applyTitleOverlay(summaries, titleDocs);
                }
            } catch {
                // best-effort; title overlay failure must never break the conversation list
            }
            set({
                conversationSummaries: summaries,
                summariesLoading: false,
                summariesUserId: userId,
                summariesFetchedAt: Date.now(),
            });
        } catch (error) {
            console.error('Failed to fetch conversation summaries:', error);
            set({ error: error.message, summariesLoading: false });
        }
    },

    fetchMessagesForConversation: async (userId, conversationId, options = {}) => {
        const { quiet = false, force = false } = options;
        if (!userId || !conversationId) return;

        if (get().unsubscribe) {
            get().unsubscribe();
        }

        const cachedMessages = !force ? getCachedMessages(userId, conversationId) : null;
        if (cachedMessages) {
            if (!quiet) {
                set({ loading: true, error: null, activeConversationId: conversationId });
            } else {
                set({ error: null, activeConversationId: conversationId });
            }
            set({ messages: cachedMessages, loading: false });
            writeLastConversationId(userId, conversationId);
        } else if (!quiet) {
            set({ loading: true, error: null, activeConversationId: conversationId });
        } else {
            set({ error: null, activeConversationId: conversationId });
        }

        const subscribeToThread = () => {
            const unsubscribe = client.subscribe(
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_HISTORY}.documents`,
                (subResponse) => {
                    const { events, payload } = subResponse;
                    if (payload.userId !== userId) return;
                    const activeId = get().activeConversationId;
                    if (!messageMatchesActive(payload, userId, activeId)) return;

                    if (events.includes('databases.*.collections.*.documents.*.create')) {
                        set((state) => {
                            const nextMessages = [...state.messages.filter((m) => m.$id !== payload.$id), payload].sort(
                                sortMessagesAsc
                            );
                            setCachedMessages(userId, activeId, nextMessages);
                            return { messages: nextMessages };
                        });
                    }
                }
            );
            set({ unsubscribe });
        };

        if (cachedMessages) {
            subscribeToThread();
            return;
        }

        try {
            const documents = (await listAllThreadDocuments(userId, conversationId)).sort(
                sortMessagesAsc
            );
            setCachedMessages(userId, conversationId, documents);
            set({ messages: documents, loading: false });
            writeLastConversationId(userId, conversationId);
            subscribeToThread();
        } catch (error) {
            console.error('Failed to fetch chat messages:', error);
            set({ error: error.message, loading: false });
        }
    },

    /**
     * Refresh thread list and restore the last active conversation (or most recent thread).
     */
    initializeChatSession: async (userId, { forceSummaries = false } = {}) => {
        if (!userId) return;

        const job = initSessionMutex.then(async () => {
            await get().fetchConversationSummaries(userId, { force: forceSummaries });
            const summaries = get().conversationSummaries;
            const storedId = readLastConversationId(userId);
            const targetId = resolveConversationToRestore(summaries, storedId);

            if (targetId) {
                await get().fetchMessagesForConversation(userId, targetId, { quiet: true });
            } else {
                get().clearConversationSelection();
            }
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

            writeLastConversationId(userId, activeConversationId);

            const hasSummary = get().conversationSummaries.some(
                (s) => s.id === activeConversationId
            );
            if (!hasSummary) {
                await get().fetchConversationSummaries(userId, { force: true });
            } else {
                set((state) => ({
                    conversationSummaries: patchSummaryAfterMessage(
                        state.conversationSummaries,
                        activeConversationId,
                        doc.timestamp || doc.$createdAt
                    ),
                    summariesFetchedAt: Date.now(),
                }));
            }
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
            const docs = await listAllThreadDocuments(userId, conversationId, { select: ['$id'] });
            await Promise.all(docs.map((d) => db.chatHistory.delete(d.$id)));
            await deleteMemoryDocuments(userId, conversationId);

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

    clearConversationMemory: async (userId, conversationId) => {
        if (!userId || !conversationId || conversationId === LEGACY_CONVERSATION_ID) return false;
        try {
            await deleteMemoryDocuments(userId, conversationId);
            return true;
        } catch (error) {
            console.error('Failed to clear conversation memory:', error);
            set({ error: error.message });
            return false;
        }
    },

    clearHistory: async () => {
        set({ messages: [] });
    },
}));

export default useChatStore;
