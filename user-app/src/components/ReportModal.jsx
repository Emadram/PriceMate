import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiAlertTriangle, FiCheckCircle, FiLoader, FiSend } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/appwrite';
import useAuthStore from '../stores/authStore';
import useDocumentScrollLock from '../hooks/useDocumentScrollLock';

const ReportModal = ({ isOpen, onClose, targetName, targetType = 'supermarket' }) => {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const [step, setStep] = useState(1);
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [panelMaxHeight, setPanelMaxHeight] = useState(null);
    const closeTimerRef = useRef(null);
    const panelRef = useRef(null);
    const formId = 'report-modal-form';

    useDocumentScrollLock(isOpen);

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

    useEffect(() => {
        if (!isOpen || typeof window === 'undefined') return undefined;

        const updatePanelHeight = () => {
            const vv = window.visualViewport;
            const navH = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-h') || '0'
            ) || 0;
            if (!vv) {
                setPanelMaxHeight(null);
                return;
            }
            const topInset = Math.max(0, vv.offsetTop);
            const available = Math.max(
                200,
                Math.floor(vv.height - topInset - navH - 16)
            );
            setPanelMaxHeight(available);
        };

        updatePanelHeight();
        const vv = window.visualViewport;
        vv?.addEventListener('resize', updatePanelHeight);
        vv?.addEventListener('scroll', updatePanelHeight);
        window.addEventListener('resize', updatePanelHeight);

        return () => {
            vv?.removeEventListener('resize', updatePanelHeight);
            vv?.removeEventListener('scroll', updatePanelHeight);
            window.removeEventListener('resize', updatePanelHeight);
            setPanelMaxHeight(null);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const marketReasons = [
        t('report_reason_incorrect_prices', 'Incorrect Prices'),
        t('report_reason_out_of_stock', 'Out of Stock Products'),
        t('report_reason_wrong_location', 'Wrong Location'),
        t('report_reason_store_closed', 'Store Closed'),
        t('report_reason_other', 'Other Issue'),
    ];

    const productReasons = [
        t('report_reason_wrong_price', 'Wrong Price Listed'),
        t('report_reason_missing_image', 'Missing Image'),
        t('report_reason_wrong_category', 'Wrong Category'),
        t('report_reason_incorrect_details', 'Incorrect Product Details'),
        t('report_reason_inappropriate', 'Inappropriate Content'),
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
        if (!selectedReason || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        const context = targetName ? `${targetType === 'product' ? t('product') : t('store')}: ${targetName}` : '';
        const message = [context, selectedReason, details.trim()].filter(Boolean).join(' - ');

        try {
            await db.feedback.create({
                userId: user?.$id,
                message,
                status: 'pending',
                createdAt: new Date().toISOString(),
            });

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

    const panelStyle = panelMaxHeight
        ? { maxHeight: `${panelMaxHeight}px` }
        : undefined;

    const canSubmit = Boolean(selectedReason) && !isSubmitting;

    const modal = (
        <div
            className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[var(--bottom-nav-h,0px)] sm:pb-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
        >
            <div
                ref={panelRef}
                style={panelStyle}
                className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-md flex flex-col max-h-[min(90dvh,calc(100dvh-var(--bottom-nav-h,0px)-env(safe-area-inset-top,0px)-0.5rem))] sm:max-h-[90dvh] overflow-hidden transform transition-all animate-in slide-in-from-bottom-4 sm:zoom-in duration-300 mb-0 sm:mb-0"
            >
                <div className="flex justify-between items-center p-4 sm:p-6 border-b dark:border-gray-700 shrink-0">
                    <h3
                        id="report-modal-title"
                        className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
                    >
                        <FiAlertTriangle className="text-red-500 shrink-0" />
                        {t('report_issue', 'Report Issue')}
                    </h3>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="tap-target h-11 w-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition"
                        aria-label={t('close', 'Close')}
                    >
                        <FiX size={24} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 pb-2">
                    {step === 1 ? (
                        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
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
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-2 ring-red-400/40'
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
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition resize-none"
                                    rows={3}
                                    placeholder={t('tell_us_more', 'Tell us more...')}
                                />
                            </div>
                        </form>
                    ) : (
                        <div className="text-center py-6 sm:py-8">
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

                {step === 1 && (
                    <div
                        data-testid="report-modal-footer"
                        className="shrink-0 relative border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-6"
                    >
                        <div
                            className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-900 dark:via-gray-900/90"
                            aria-hidden
                        />
                        {!selectedReason && (
                            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                                {t('report_choose_reason_hint', 'Choose a reason above to continue')}
                            </p>
                        )}
                        <button
                            type="submit"
                            form={formId}
                            disabled={!canSubmit}
                            className={`w-full min-h-14 rounded-2xl font-black text-base uppercase tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                                canSubmit
                                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-red-500/40 hover:from-red-700 hover:to-red-600 ring-2 ring-red-400/60 scale-[1.01] active:scale-[0.99]'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 shadow-none cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? (
                                <FiLoader className="animate-spin shrink-0" size={22} />
                            ) : (
                                <FiSend className="shrink-0" size={22} strokeWidth={2.5} />
                            )}
                            {isSubmitting
                                ? t('sending_request', 'Sending Request...')
                                : t('send_report', 'Send Report')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modal, document.body);
    }

    return modal;
};

export default ReportModal;
