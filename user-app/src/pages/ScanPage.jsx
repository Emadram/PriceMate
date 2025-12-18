import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';

const ScanPage = () => {
    const [scannedCode, setScannedCode] = useState(null);
    const navigate = useNavigate();

    const handleDetected = (code) => {
        setScannedCode(code);
        // TODO: Fetch product details using the code
        // For now, just show the code
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold text-center">Scan Barcode</h2>
                </div>

                {!scannedCode ? (
                    <div className="p-4">
                        <Scanner onDetected={handleDetected} />
                        <p className="text-center text-gray-500 mt-4 text-sm">
                            Point your camera at a barcode
                        </p>
                    </div>
                ) : (
                    <div className="p-6 text-center">
                        <div className="text-green-500 text-5xl mb-4">✓</div>
                        <h3 className="text-xl font-semibold mb-2">Barcode Detected!</h3>
                        <p className="text-gray-700 font-mono text-lg bg-gray-100 p-2 rounded mb-6">
                            {scannedCode}
                        </p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => setScannedCode(null)}
                                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                            >
                                Scan Again
                            </button>
                            <button
                                onClick={() => navigate(`/product/${scannedCode}`)}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                View Product
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-4 border-t bg-gray-50 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-600 hover:underline"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScanPage;
