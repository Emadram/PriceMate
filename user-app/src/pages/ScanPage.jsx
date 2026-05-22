import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';
import { fetchGlobalProductWithRetries } from '../utils/productUtils';

const prefetchInflight = new Map();
import BackButton from '../components/BackButton';

const ScanPage = () => {
    const [scannedCode, setScannedCode] = useState(null);
    const navigate = useNavigate();

    const handleDetected = (code) => {
        setScannedCode(code);

        // Kick off a background prefetch for faster navigation and to warm caches.
        if (!code) return;
        if (prefetchInflight.has(code)) return;
        const p = (async () => {
            try {
                    await fetchGlobalProductWithRetries(code);
                } catch {
                    // swallow; best-effort
                } finally {
                prefetchInflight.delete(code);
            }
        })();
        prefetchInflight.set(code, p);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pt-safe pb-safe transition-colors">
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-center text-gray-800 dark:text-white">Scan Barcode</h2>
                </div>

                {!scannedCode ? (
                    <div className="p-6">
                        <div className="rounded-xl overflow-hidden shadow-inner bg-gray-100 dark:bg-gray-900">
                            <Scanner onDetected={handleDetected} paused={!!scannedCode} />
                        </div>
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-6 text-sm flex items-center justify-center gap-2">
                            Point your camera at a barcode
                        </p>
                    </div>
                ) : (
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-4xl mx-auto mb-6">
                            ✓
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Barcode Detected!</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Found code:</p>
                        <div className="text-gray-800 dark:text-white font-mono text-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 mb-8 tracking-widest">
                            {scannedCode}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setScannedCode(null)}
                                className="tap-target min-h-11 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                            >
                                Scan Again
                            </button>
                            <button
                                onClick={() => navigate(`/product/${scannedCode}`, { state: { fromScan: true } })}
                                className="tap-target min-h-11 bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition"
                            >
                                View Product
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-center">
                    <BackButton to="/" label="Back to Home" />
                </div>
            </div>
        </div>
    );
};

export default ScanPage;
