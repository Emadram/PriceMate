import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiMessageSquare, FiSend, FiCheckCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/appwrite';
import useAuthStore from '../stores/authStore';
import BackButton from '../components/BackButton';
import { MobileHeader, MobilePage } from '../components/MobilePageLayout';

const FeedbackPage = () => {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const [formData, setFormData] = useState({
        type: 'general',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!user) return <Navigate to="/login" />;

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
            alert(t('feedback_submit_failed'));
        }

        setSubmitting(false);
    };

    if (submitted) {
        return (
            <MobilePage className="flex flex-col">
                <MobileHeader
                    title={t('send_feedback')}
                    icon={FiMessageSquare}
                    left={<BackButton to="/profile" label={t('back_to_profile')} />}
                />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft p-8 text-center max-w-md w-full">
                        <div className="flex justify-center mb-4">
                            <FiCheckCircle className="text-green-600 text-6xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-600 mb-2">{t('feedback_thank_you')}</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            {t('feedback_submitted')}
                        </p>
                        <div className="flex justify-center">
                            <BackButton to="/profile" label={t('back_to_profile')} className="!w-auto !h-auto !rounded-xl px-5 py-2.5 gap-2 !inline-flex" />
                        </div>
                    </div>
                </div>
            </MobilePage>
        );
    }

    return (
        <MobilePage className="transition-colors">
            <MobileHeader
                title={t('send_feedback')}
                icon={FiMessageSquare}
                left={<BackButton to="/profile" label={t('back_to_profile')} />}
            />

            <main className="max-w-4xl mx-auto p-4">
                <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('feedback_type')}
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                            >
                                <option value="general">{t('feedback_type_general')}</option>
                                <option value="bug">{t('feedback_type_bug')}</option>
                                <option value="feature">{t('feedback_type_feature')}</option>
                                <option value="complaint">{t('feedback_type_complaint')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('message')}
                            </label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                rows="6"
                                placeholder={t('feedback_placeholder')}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="tap-target w-full min-h-11 bg-brand-600 text-white py-3 rounded-lg hover:bg-brand-700 transition font-medium disabled:bg-gray-400 flex items-center justify-center gap-2"
                        >
                            <FiSend /> {submitting ? t('feedback_submitting') : t('feedback_submit')}
                        </button>
                    </form>
                </div>
            </main>
        </MobilePage>
    );
};

export default FeedbackPage;
