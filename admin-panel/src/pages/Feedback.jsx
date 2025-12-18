import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';

const Feedback = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeedback();
    }, []);

    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.FEEDBACK
            );
            setFeedback(response.documents);
        } catch (error) {
            console.error('Error fetching feedback:', error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-blue-600 hover:text-blue-800">← Dashboard</Link>
                        <h1 className="text-2xl font-bold text-gray-800">Feedback</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="text-center py-8">Loading...</div>
                ) : (
                    <div className="space-y-4">
                        {feedback.map((item) => (
                            <div key={item.$id} className="bg-white rounded-lg shadow p-6">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                        {item.type}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        User: {item.user_id?.substring(0, 8)}...
                                    </span>
                                </div>
                                <p className="text-gray-700 mt-3">{item.message}</p>
                                <div className="mt-4 text-xs text-gray-400">
                                    Status: {item.status || 'open'}
                                </div>
                            </div>
                        ))}
                        {feedback.length === 0 && (
                            <div className="text-center py-8 text-gray-500 bg-white rounded-lg">
                                No feedback submitted yet
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Feedback;
