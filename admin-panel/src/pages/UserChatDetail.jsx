import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useChatHistoryStore, LEGACY_THREAD_KEY, messageThreadKey } from '../stores/chatHistoryStore';
import {
    FiArrowLeft,
    FiUser,
    FiCpu,
    FiClock,
    FiMessageSquare,
    FiTrash2,
} from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import AdminPageHeader from '../components/AdminPageHeader';

const UserChatDetail = () => {
    const { userId, threadKey: threadKeyParam } = useParams();
    const navigate = useNavigate();
    const decodedThreadKey = threadKeyParam ? decodeURIComponent(threadKeyParam) : '';
    const { groupedHistory, loading, fetchHistory, deleteMessage, deleteUserHistory, deleteThread } =
        useChatHistoryStore();
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadThread = useCallback(async () => {
        if (!groupedHistory[userId]) {
            await fetchHistory();
        }
        setLastUpdated(new Date().toISOString());
    }, [userId, groupedHistory, fetchHistory]);

    useEffect(() => {
        const t = setTimeout(() => loadThread(), 0);
        return () => clearTimeout(t);
    }, [loadThread]);

    const allMessages = groupedHistory[userId] || [];
    const messages = allMessages.filter((m) => messageThreadKey(m) === decodedThreadKey);

    const userInfo =
        allMessages.find((msg) => msg.userName || msg.userEmail) || allMessages[0] || {};
    const displayName =
        userInfo.userName || userInfo.userEmail || `User ${userId?.slice(0, 8) || ''}`;

    const threadTitle =
        decodedThreadKey === LEGACY_THREAD_KEY
            ? 'Earlier chats'
            : (() => {
                  const firstUser = messages.find((m) => m.role === 'user');
                  const raw = firstUser?.text?.trim() || '';
                  if (!raw) return `Conversation`;
                  return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
              })();

    if (loading && allMessages.length === 0) {
        return (
            <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar">
                <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700">
                    <div className="max-w-4xl mx-auto px-8 pt-4">
                        <Link
                            to={`/chat-history/${userId}`}
                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-700 dark:text-brand-300 hover:gap-3 transition-all"
                        >
                            <FiArrowLeft size={14} /> Back to conversations
                        </Link>
                    </div>
                    <AdminPageHeader
                        title="Conversation"
                        subtitle={threadTitle}
                        lastUpdated={lastUpdated}
                        onRefresh={loadThread}
                        loading={loading}
                        sticky={false}
                    />
                    <div className="max-w-4xl mx-auto px-8 pb-4 flex flex-wrap items-center gap-3">
                            <div className="bg-slate-900 text-white px-5 py-4 rounded-2xl flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <FiUser className="text-lg" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        User
                                    </p>
                                    <p className="text-sm font-bold truncate max-w-[180px]">{displayName}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('Delete this conversation only?')) {
                                        deleteThread(userId, decodedThreadKey);
                                        navigate(`/chat-history/${userId}`);
                                    }
                                }}
                                className="text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2.5 rounded-2xl border border-red-100 dark:border-red-900/40"
                            >
                                Delete conversation
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('Delete all AI chat logs for this user?')) {
                                        deleteUserHistory(userId);
                                        navigate('/chat-history');
                                    }
                                }}
                                className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-red-600 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600"
                            >
                                Delete all for user
                            </button>
                    </div>
                </div>

                <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6 pb-20">
                    {messages.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <FiMessageSquare className="mx-auto text-4xl text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                No messages in this thread
                            </h3>
                            <p className="text-gray-500 mt-2 mb-6">It may have been deleted or the link is invalid.</p>
                            <Link
                                to={`/chat-history/${userId}`}
                                className="text-brand-700 dark:text-brand-300 font-bold text-sm uppercase tracking-widest"
                            >
                                Back to conversations
                            </Link>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={msg.id || index}
                                className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'} group`}
                            >
                                <div
                                    className={`flex gap-4 max-w-[85%] ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}
                                >
                                    <div
                                        className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                                            msg.role === 'assistant'
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                : 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                                        }`}
                                    >
                                        {msg.role === 'assistant' ? <FiCpu /> : <FiUser />}
                                    </div>

                                    <div className="space-y-2">
                                        <div
                                            className={`p-6 rounded-[2rem] text-sm md:text-base leading-relaxed font-medium shadow-sm border border-slate-100 dark:border-gray-700 ${
                                                msg.role === 'assistant'
                                                    ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 rounded-tl-none'
                                                    : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 rounded-tr-none'
                                            }`}
                                        >
                                            {msg.text}
                                        </div>
                                        <div
                                            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ${
                                                msg.role === 'assistant' ? 'justify-start' : 'justify-end'
                                            }`}
                                        >
                                            <FiClock />
                                            {new Date(msg.timestamp).toLocaleString()}
                                            <button
                                                type="button"
                                                onClick={() => deleteMessage(msg.id, userId)}
                                                className="ml-2 text-red-500 hover:text-red-600"
                                                title="Delete message"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </main>
            </div>
        </div>
    );
};

export default UserChatDetail;
