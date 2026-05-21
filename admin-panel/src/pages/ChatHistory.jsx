import { useCallback, useEffect, useState } from 'react';
import useFreshIndicator from '../hooks/useFreshIndicator';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiUser, FiClock, FiSearch, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import { useChatHistoryStore, groupMessagesByThread } from '../stores/chatHistoryStore';
import Sidebar from '../components/Sidebar';
import { client, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';

const ChatHistory = () => {
    const { groupedHistory, loading, fetchHistory, deleteUserHistory } = useChatHistoryStore();
    const navigate = useNavigate();
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

    const userSessions = Object.entries(groupedHistory || {}).map(([uid, messages]) => {
        const lastMsg = messages[messages.length - 1] || {};
        const identityMsg = messages.find((msg) => msg.userName || msg.userEmail) || {};
        const displayName =
            identityMsg.userName || identityMsg.userEmail || `User ${uid.slice(0, 8)}`;
        const displayUsername = identityMsg.userName || '';
        const threads = groupMessagesByThread(messages);
        const conversationCount = Object.keys(threads).length;
        return {
            userId: uid,
            messageCount: messages.length,
            conversationCount,
            lastActive: lastMsg.timestamp || new Date().toISOString(),
            displayName,
            displayUsername,
            userEmail: identityMsg.userEmail || '',
        };
    }).sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

    const filteredSessions = userSessions.filter(session => 
        (session.userId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (session.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (session.displayUsername?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (session.userEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
            <Sidebar />
            
            <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar transition-all duration-300">
                <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-8 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">AI Chat Logs</h1>
                            <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Live
                            </span>
                            <span className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest transition-colors ${isFresh ? 'text-green-600' : 'text-gray-400'}`}>
                                Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-medium tracking-tight">Monitoring system intelligence and user queries</p>
                    </div>
                    
                    <div className="relative group max-w-md w-full ml-8 hidden md:block">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find interaction or user..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 pl-11 pr-4 w-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-gray-800 dark:text-gray-100"
                        />
                    </div>
                </header>

                <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                    <div className="flex flex-col gap-1 mb-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Active Users</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white">{userSessions.length}</p>
                        <p className="text-xs text-gray-400">
                            Total: {userSessions.reduce((acc, s) => acc + s.conversationCount, 0)} conversations ·{' '}
                            {userSessions.reduce((acc, s) => acc + s.messageCount, 0)} messages
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredSessions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredSessions.map((session) => (
                                <div
                                    key={session.userId}
                                    className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-left transition-all hover:border-blue-400 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <FiUser size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{session.displayName}</h3>
                                                {session.displayUsername ? (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{session.displayUsername}</p>
                                                ) : (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                                        {session.userEmail || `ID: ${session.userId.slice(0, 12)}...`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm('Delete all logs for this user?')) {
                                                    deleteUserHistory(session.userId);
                                                }
                                            }}
                                            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            title="Delete logs"
                                        >
                                            <FiTrash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                            <FiClock /> {new Date(session.lastActive).toLocaleString()}
                                        </span>
                                        <span>
                                            {session.conversationCount} conv. · {session.messageCount} msg.
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/chat-history/${session.userId}`)}
                                        className="mt-4 w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400"
                                    >
                                        View conversations
                                        <FiChevronRight className="transition-transform group-hover:translate-x-1" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <FiMessageSquare className="text-gray-200 dark:text-gray-700 mb-6" size={64} />
                            <h3 className="text-xl font-black text-gray-800 dark:text-white">No AI chat logs</h3>
                            <p className="text-gray-400 mt-2 max-w-sm text-center font-medium">Logs will appear here once users interact with the AI assistant in the mobile application.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ChatHistory;
