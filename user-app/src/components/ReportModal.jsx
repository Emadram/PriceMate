import { useEffect, useRef, useState } from 'react';
import { FiX, FiAlertTriangle, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/appwrite';
import useAuthStore from '../stores/authStore';

const ReportModal = ({ isOpen, onClose, targetName, targetType = 'supermarket' }) => {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const [step, setStep] = useState(1);
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const closeTimerRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedReason('');
            setDetails('');
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen, targetName, targetType]);

    useEffect(() => () => {
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current);
        }
    }, []);

    if (!isOpen) return null;

    const marketReasons = [
        t('report_reason_incorrect_prices', 'Incorrect Prices'),
        t('report_reason_out_of_stock', 'Out of Stock Products'),
        t('report_reason_wrong_location', 'Wrong Location'),
        t('report_reason_store_closed', 'Store Closed'),
        t('report_reason_other', 'Other Issue')
    ];

    const productReasons = [
        t('report_reason_wrong_price', 'Wrong Price Listed'),
        t('report_reason_missing_image', 'Missing Image'),
        t('report_reason_wrong_category', 'Wrong Category'),
        t('report_reason_incorrect_details', 'Incorrect Product Details'),
        t('report_reason_inappropriate', 'Inappropriate Content')
    ];

    const reasons = targetType === 'product' ? productReasons : marketReasons;

    const closeModal = () => {
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setStep(1);
        setSelectedReason('');
        setDetails('');
        setError(null);
        setIsSubmitting(false);
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const context = targetName ? `${targetType === 'product' ? t('product') : t('store')}: ${targetName}` : '';
        const message = [context, selectedReason, details.trim()].filter(Boolean).join(' - ');

        try {
            await db.feedback.create(
                {
                    userId: user?.$id,
                    message,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                }
            );

            setStep(2);
            closeTimerRef.current = window.setTimeout(() => {
                closeModal();
            }, 3000);

        } catch (err) {
            console.error('Error submitting report:', err);
            setError(err.message || t('report_submit_failed', 'Failed to submit report. Please try again.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in duration-300">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FiAlertTriangle className="text-red-500" />
                        {t('report_issue', 'Report Issue')}
                    </h3>
                    <button
                        onClick={closeModal}
                        className="tap-target h-11 w-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('report_help_text', { target: targetName, defaultValue: 'Help us improve {{target}} by reporting an issue.' })}
                            </p>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
                                    <FiAlertTriangle className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('whats_wrong', "What's wrong?")}
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {reasons.map((reason) => (
                                        <button
                                            key={reason}
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={() => setSelectedReason(reason)}
                                            className={`text-left px-4 py-3 rounded-xl border transition-all ${selectedReason === reason
                                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('additional_details_optional', 'Additional Details (Optional)')}
                                </label>
                                <textarea
                                    value={details}
                                    disabled={isSubmitting}
                                    onChange={(e) => setDetails(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                                    rows="3"
                                    placeholder={t('tell_us_more', 'Tell us more...')}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={!selectedReason || isSubmitting}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <FiLoader className="animate-spin" /> : null}
                                {isSubmitting ? t('sending_request', 'Sending Request...') : t('submit_report', 'Submit Report')}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
                                <FiCheckCircle size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {t('report_received', 'Report Received')}
                            </h4>
                            <p className="text-gray-600 dark:text-gray-400">
                                {t('report_received_description', "Thank you for your feedback! We'll review this issue shortly.")}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportModal;
