import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiMessageSquare, FiSend, FiCheckCircle } from 'react-icons/fi';
import { db } from '../lib/appwrite';
import useAuthStore from '../stores/authStore';
import BackButton from '../components/BackButton';

const FeedbackPage = () => {
    const user = useAuthStore((state) => state.user);

    if (!user) return <Navigate to="/login" />;
    const [formData, setFormData] = useState({
        type: 'general',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await db.feedback.create(
                {
                    userId: user.$id,
                    type: formData.type,
                    message: formData.message,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            );

            setSubmitted(true);
            setFormData({ type: 'general', message: '' });
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        }

        setSubmitting(false);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#F5F5F7] dark:bg-black text-gray-900 dark:text-gray-100 flex flex-col">
                <header className="bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-white/5 p-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <BackButton to="/profile" label="Back to profile" />
                        <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <FiMessageSquare className="text-blue-500" />
                            Send Feedback
                        </h1>
                        <div className="w-10" />
                    </div>
                </header>
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft p-8 text-center max-w-md w-full">
                        <div className="flex justify-center mb-4">
                            <FiCheckCircle className="text-green-600 text-6xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-600 mb-2">Thank You!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Your feedback has been submitted.
                        </p>
                        <div className="flex justify-center">
                            <BackButton to="/profile" label="Back to profile" className="!w-auto !h-auto !rounded-xl px-5 py-2.5 gap-2 !inline-flex" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black text-gray-900 dark:text-gray-100 pb-20 transition-colors">
            <header className="bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-white/5 p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <BackButton to="/profile" label="Back to profile" />
                    <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <FiMessageSquare className="text-blue-500" />
                        Send Feedback
                    </h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4">
                <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Feedback Type
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                            >
                                <option value="general">General</option>
                                <option value="bug">Bug Report</option>
                                <option value="feature">Feature Request</option>
                                <option value="complaint">Complaint</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Message
                            </label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                rows="6"
                                placeholder="Tell us what you think..."
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 flex items-center justify-center gap-2"
                        >
                            <FiSend /> {submitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default FeedbackPage;
