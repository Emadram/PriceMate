import { useState } from 'react';
import { FiX, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

const ReportModal = ({ isOpen, onClose, supermarketName }) => {
    const [step, setStep] = useState(1);
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');

    if (!isOpen) return null;

    const reasons = [
        'Incorrect Prices',
        'Out of Stock Products',
        'Wrong Location',
        'Store Closed',
        'Other Issue'
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        // Mock submission
        setStep(2);
        setTimeout(() => {
            onClose();
            setStep(1);
            setSelectedReason('');
            setDetails('');
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FiAlertTriangle className="text-red-500" />
                        Report Issue
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Help us improve <strong>{supermarketName}</strong> by reporting an issue.
                            </p>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    What's wrong?
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {reasons.map((reason) => (
                                        <button
                                            key={reason}
                                            type="button"
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
                                    Additional Details (Optional)
                                </label>
                                <textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                                    rows="3"
                                    placeholder="Tell us more..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={!selectedReason}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30"
                            >
                                Submit Report
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
                                <FiCheckCircle size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Report Received
                            </h4>
                            <p className="text-gray-600 dark:text-gray-400">
                                Thank you for your feedback! We'll review this issue shortly.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportModal;
