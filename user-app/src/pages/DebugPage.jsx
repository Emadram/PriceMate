import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiPlay, FiCheckCircle, FiXCircle, FiAlertTriangle } from 'react-icons/fi';
import runDiagnostics from '../utils/diagnostics';

const DebugPage = () => {
    const navigate = useNavigate();
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState(null);

    const handleRunTests = async () => {
        setRunning(true);
        setResults(null);

        // Run diagnostics
        const testResults = await runDiagnostics();

        setResults(testResults);
        setRunning(false);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'PASS':
                return <FiCheckCircle className="text-green-600 text-xl" />;
            case 'FAIL':
                return <FiXCircle className="text-red-600 text-xl" />;
            case 'WARN':
                return <FiAlertTriangle className="text-yellow-600 text-xl" />;
            default:
                return <FiAlertTriangle className="text-gray-600 text-xl" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PASS':
                return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            case 'FAIL':
                return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'WARN':
                return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
            default:
                return 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2 mb-3"
                    >
                        <FiArrowLeft /> Back to Home
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                        System Diagnostics
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Test database connectivity and data relationships
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                        Run Diagnostic Tests
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This will test database connections, data availability, and relationship configurations.
                        Check the browser console for detailed logs.
                    </p>
                    <button
                        onClick={handleRunTests}
                        disabled={running}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 font-semibold"
                    >
                        <FiPlay /> {running ? 'Running Tests...' : 'Run Diagnostics'}
                    </button>

                    <Link
                        to="/data-inspector"
                        className="mt-3 inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                        → View Detailed Data Inspector
                    </Link>
                </div>

                {results && (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className={`rounded-xl shadow-lg p-6 border-2 ${results.success
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                            }`}>
                            <h3 className="text-lg font-bold mb-2">
                                {results.success ? '✅ Diagnostics Passed' : '❌ Issues Detected'}
                            </h3>
                            {results.summary && (
                                <div className="space-y-1 text-sm">
                                    <p>Products in database: <strong>{results.summary.productsCount || 0}</strong></p>
                                    <p>Prices in database: <strong>{results.summary.pricesCount || 0}</strong></p>
                                </div>
                            )}
                        </div>

                        {/* Test Results */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                                Test Results
                            </h3>
                            <div className="space-y-3">
                                {results.tests.map((test, index) => (
                                    <div
                                        key={index}
                                        className={`rounded-lg border-2 p-4 ${getStatusColor(test.status)}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {getStatusIcon(test.status)}
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-800 dark:text-white">
                                                    {test.name}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                    {test.message}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recommendations */}
                        {!results.success && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-lg p-6 border-2 border-blue-500">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
                                    💡 Recommended Actions
                                </h3>
                                <div className="space-y-2 text-sm">
                                    {results.summary?.pricesCount === 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                                            <p className="font-semibold text-red-600 mb-1">
                                                🔴 CRITICAL: No prices in database
                                            </p>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Go to Admin Panel → Prices and add some prices for your products.
                                            </p>
                                        </div>
                                    )}
                                    {results.summary?.productsCount === 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                                            <p className="font-semibold text-red-600 mb-1">
                                                🔴 CRITICAL: No products in database
                                            </p>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Go to Admin Panel → Products and add some products first.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Console Note */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-300 dark:border-gray-700">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                📝 <strong>Note:</strong> Detailed logs have been written to the browser console.
                                Press F12 to view complete diagnostic information.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DebugPage;
