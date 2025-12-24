import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

const SCAN_HINTS = (() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128
    ]);
    return hints;
})();

const SCAN_CONSTRAINTS = {
    video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 }
    }
};

const Scanner = ({ onDetected, paused = false }) => {
    const videoRef = useRef(null);
    const readerRef = useRef(null);
    const lastCodeRef = useRef(null);
    const [error, setError] = useState(null);
    const [starting, setStarting] = useState(false);
    const [armed, setArmed] = useState(false);

    const stopReader = useCallback(() => {
        const r = readerRef.current;
        if (r && typeof r.reset === 'function') {
            try { r.reset(); } catch { }
        }
    }, []);

    const startReader = useCallback(async () => {
        if (paused || starting) return;
        setStarting(true);
        setError(null);

        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Camera not supported in this browser');
            setStarting(false);
            return;
        }

        try {
            // Explicit prompt
            const perm = await navigator.mediaDevices.getUserMedia({ video: true });
            perm.getTracks().forEach(t => t.stop());
        } catch (err) {
            setError('Camera permission denied. Please allow camera access.');
            setStarting(false);
            return;
        }

        const reader = new BrowserMultiFormatReader();
        reader.hints = SCAN_HINTS;
        readerRef.current = reader;

        const decodeCallback = (result, err) => {
            if (paused) return;
            if (err?.name === 'NotAllowedError') {
                setError('Camera permission denied. Please allow camera access.');
                return;
            }
            if (err?.name === 'AbortError' || err?.name === 'NotReadableError') {
                setError('Camera interrupted. Tap Start to retry.');
                return;
            }
            if (result && armed) {
                const text = result.getText();
                if (text && text !== lastCodeRef.current) {
                    lastCodeRef.current = text;
                    if (navigator.vibrate) navigator.vibrate(120);
                    onDetected(text);
                    setArmed(false); // single-shot after tap
                }
            }
        };

        try {
            const devices = await BrowserMultiFormatReader.listVideoInputDevices();
            const preferred = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];

            stopReader(); // ensure clean start

            if (preferred?.deviceId) {
                try {
                    await reader.decodeFromVideoDevice(preferred.deviceId, videoRef.current, decodeCallback);
                    setStarting(false);
                    return;
                } catch {
                    // fall through
                }
            }
            await reader.decodeFromConstraints(SCAN_CONSTRAINTS, videoRef.current, decodeCallback);
        } catch (err) {
            setError('Unable to start camera. Close other apps and retry.');
        } finally {
            setStarting(false);
        }
    }, [onDetected, paused, starting, stopReader]);

    useEffect(() => {
        if (!paused) startReader();
        return () => {
            stopReader();
            lastCodeRef.current = null;
            setArmed(false);
        };
    }, [paused, startReader, stopReader]);

    return (
        <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
            />
            <div className="absolute inset-0 border-2 border-red-500 opacity-50 pointer-events-none" />
            <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs">
                Align barcode within the frame
            </div>

            {(error || paused || starting || !armed) && (
                <div className="absolute inset-0 bg-black/70 text-white text-center text-sm flex flex-col items-center justify-center px-4 gap-3">
                    <div>
                        {error || (starting ? 'Starting camera…' : paused ? 'Scanner paused' : 'Tap “Ready to Scan” then point at barcode')}
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <button
                            onClick={startReader}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700"
                            disabled={starting}
                        >
                            {starting ? 'Starting…' : 'Start / Retry Camera'}
                        </button>
                        {!starting && !paused && (
                            <button
                                onClick={() => {
                                    setError(null);
                                    setArmed(true);
                                    lastCodeRef.current = null;
                                }}
                                className="px-3 py-2 bg-green-600 text-white rounded-md text-xs font-semibold hover:bg-green-700"
                            >
                                Ready to Scan (Tap once)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scanner;
