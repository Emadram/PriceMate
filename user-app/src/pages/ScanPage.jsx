import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiAlertCircle } from 'react-icons/fi';
import Scanner from '../components/Scanner';
import BackButton from '../components/BackButton';
import useProductStore from '../stores/productStore';

const ScanPage = () => {
    const { t } = useTranslation();
    const [scanResult, setScanResult] = useState(null);
    const [formatError, setFormatError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!formatError) return undefined;
        const timeoutId = setTimeout(() => setFormatError(null), 3000);
        return () => clearTimeout(timeoutId);
    }, [formatError]);

    const resetScan = useCallback(() => {
        setScanResult(null);
        setFormatError(null);
    }, []);

    const handleInvalidBarcode = useCallback((code, reason) => {
        setFormatError({ code, reason });
    }, []);

    const handleDetected = useCallback(async (code) => {
        setFormatError(null);
        setScanResult({ phase: 'loading', code });

        try {
            const product = await useProductStore.getState().prefetchProductByBarcode(code);
            if (product) {
                setScanResult({ phase: 'found', code, product });
            } else {
                setScanResult({ phase: 'not_found', code });
            }
        } catch {
            setScanResult({ phase: 'not_found', code });
        }
    }, []);

    const isScanning = !scanResult;
    const scannerPaused = Boolean(scanResult);

    const renderResultPanel = () => {
        if (!scanResult || scanResult.phase === 'loading') {
            return (
                <div className="p-8 text-center">
                    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-6" />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                        {t('scan_lookup_loading')}
                    </h3>
                    {scanResult?.code && (
                        <div className="text-gray-600 dark:text-gray-400 font-mono text-sm bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 inline-block tracking-widest">
                            {scanResult.code}
                        </div>
                    )}
                </div>
            );
        }

        if (scanResult.phase === 'not_found') {
            return (
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-6">
                        <FiAlertCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                        {t('barcode_not_in_catalog')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('barcode_not_in_catalog_subtitle')}
                    </p>
                    <div className="text-gray-800 dark:text-white font-mono text-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 mb-8 tracking-widest">
                        {scanResult.code}
                    </div>
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={resetScan}
                            className="tap-target min-h-11 bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition"
                        >
                            {t('scan_again', 'Scan Again')}
                        </button>
                        <Link
                            to="/"
                            className="tap-target min-h-11 inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                            {t('try_search_or_scan')}
                        </Link>
                    </div>
                </div>
            );
        }

        return (
            <div className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-4xl mx-auto mb-6">
                    ✓
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    {t('barcode_detected', 'Barcode Detected!')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{t('found_code', 'Found code:')}</p>
                <div className="text-gray-800 dark:text-white font-mono text-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 mb-8 tracking-widest">
                    {scanResult.code}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={resetScan}
                        className="tap-target min-h-11 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                        {t('scan_again', 'Scan Again')}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/price-comparison/${scanResult.code}?fromScan=1`, { state: { fromScan: true } })}
                        className="tap-target min-h-11 bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition"
                    >
                        {t('view_prices', 'Compare Prices')}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pt-safe pb-safe transition-colors">
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-center text-gray-800 dark:text-white">{t('scan_barcode')}</h2>
                </div>

                {isScanning ? (
                    <div className="p-6">
                        {formatError && (
                            <div
                                role="alert"
                                className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center"
                            >
                                <p className="font-bold text-red-800 dark:text-red-200">{t('invalid_barcode')}</p>
                                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                                    {t('invalid_barcode_subtitle')}
                                </p>
                                {formatError.code && (
                                    <p className="mt-2 font-mono text-xs text-red-500 dark:text-red-300 tracking-widest">
                                        {formatError.code}
                                    </p>
                                )}
                            </div>
                        )}
                        <div id="scanner-root" className="rounded-xl overflow-hidden shadow-inner bg-gray-100 dark:bg-gray-900">
                            <Scanner
                                onDetected={handleDetected}
                                onInvalidBarcode={handleInvalidBarcode}
                                paused={scannerPaused}
                            />
                        </div>
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-6 text-sm flex items-center justify-center gap-2">
                            {t('scan_point_camera', 'Point your camera at a barcode')}
                        </p>
                    </div>
                ) : (
                    renderResultPanel()
                )}

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-center">
                    <BackButton to="/" label={t('go_back_home')} />
                </div>
            </div>
        </div>
    );
};

export default ScanPage;
