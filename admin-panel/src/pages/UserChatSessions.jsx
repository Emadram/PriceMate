import { useCallback, useEffect, useState } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    FiMessageSquare,
    FiUser,
    FiClock,
    FiSearch,
    FiChevronRight,
    FiTrash2,
    FiArrowLeft,
} from 'react-icons/fi';
import {
    useChatHistoryStore,
    groupMessagesByThread,
    LEGACY_THREAD_KEY,
} from '../stores/chatHistoryStore';
import Sidebar from '../components/Sidebar';
import { client, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';

const threadLabel = (threadKey, threadMessages) => {
    if (threadKey === LEGACY_THREAD_KEY) return 'Earlier chats';
    const firstUser = threadMessages?.find((m) => m.role === 'user');
    const raw = firstUser?.text?.trim() || '';
    if (!raw) return `Conversation ${threadKey.slice(0, 8)}…`;
    return raw.length > 56 ? `${raw.slice(0, 56)}…` : raw;
};

const UserChatSessions = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const {
        groupedHistory,
        loading,
        fetchHistory,
        deleteThread,
        deleteUserHistory,
    } = useChatHistoryStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const isFresh = useFreshIndicator(lastUpdated);

    const refreshData = useCallback(async () => {
        await fetchHistory();
        setLastUpdated(new Date().toISOString());
    }, [fetchHistory]);

    useEffect(() => {
        const t = setTimeout(() => refreshData(), 0);
        return () => clearTimeout(t);
    }, [refreshData]);

    useEffect(() => {
        const channel = `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_HISTORY}.documents`;
        const unsubscribe = client.subscribe(channel, () => {
            setTimeout(() => refreshData(), 0);
        });
        return () => unsubscribe();
    }, [refreshData]);

    // `isFresh` indicator handled by useFreshIndicator to avoid rapid flicker

    const messages = groupedHistory[userId] || [];
    const identityMsg =
        messages.find((msg) => msg.userName || msg.userEmail) || messages[0] || {};
    const displayName =
        identityMsg.userName ||
        identityMsg.userEmail ||
        `User ${userId?.slice(0, 8) || ''}`;

    const byThread = groupMessagesByThread(messages);
    const threadEntries = Object.entries(byThread).map(([threadKey, threadMessages]) => {
        const last = threadMessages[threadMessages.length - 1];
        return {
            threadKey,
            label: threadLabel(threadKey, threadMessages),
            messageCount: threadMessages.length,
            lastActive: last?.timestamp || new Date().toISOString(),
        };
    }).sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

    const filteredThreads = threadEntries.filter(
        (t) =>
            t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.threadKey.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && messages.length === 0) {
        return (
            <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar transition-all duration-300">
                <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-8 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link
                            to="/chat-history"
                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3 hover:gap-3 transition-all"
                        >
                            <FiArrowLeft size={14} /> All AI chat logs
                        </Link>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                Conversations
                            </h1>
                            <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                Live
                            </span>
                            <span
                                className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest transition-colors ${isFresh ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                Updated{' '}
                                {lastUpdated
                                    ? new Date(lastUpdated).toLocaleTimeString('en-US', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                      })
                                    : '--:--'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-medium tracking-tight">
                            {displayName} · {threadEntries.length} conversation
                            {threadEntries.length !== 1 ? 's' : ''} · {messages.length} message
                            {messages.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="relative group max-w-md w-full hidden md:block">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search conversations…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm('Delete all AI chat logs for this user?')) {
                                    deleteUserHistory(userId);
                                    navigate('/chat-history');
                                }
                            }}
                            className="text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2.5 rounded-2xl border border-red-100 dark:border-red-900/40"
                        >
                            Delete all for user
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <FiMessageSquare className="text-gray-200 dark:text-gray-700 mb-6" size={64} />
                            <h3 className="text-xl font-black text-gray-800 dark:text-white">No messages</h3>
                            <p className="text-gray-400 mt-2 max-w-sm text-center font-medium">
                                This user has no stored AI conversations yet.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredThreads.map((t) => (
                                <div
                                    key={t.threadKey}
                                    className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-left transition-all hover:border-blue-400 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                <FiMessageSquare size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-2">
                                                    {t.label}
                                                </h3>
                                                <p className="text-[10px] font-mono text-gray-400 truncate mt-1">
                                                    {t.threadKey === LEGACY_THREAD_KEY
                                                        ? 'legacy thread'
                                                        : t.threadKey}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm('Delete this conversation only?')) {
                                                    deleteThread(userId, t.threadKey);
                                                }
                                            }}
                                            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                                            title="Delete conversation"
                                        >
                                            <FiTrash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                            <FiClock /> {new Date(t.lastActive).toLocaleString()}
                                        </span>
                                        <span>
                                            {t.messageCount} msg{t.messageCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                `/chat-history/${userId}/${encodeURIComponent(t.threadKey)}`
                                            )
                                        }
                                        className="mt-4 w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400"
                                    >
                                        Open conversation
                                        <FiChevronRight className="transition-transform group-hover:translate-x-1" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default UserChatSessions;
