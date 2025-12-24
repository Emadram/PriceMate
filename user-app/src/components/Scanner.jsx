import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

const Scanner = ({ onDetected, paused = false }) => {
    const videoRef = useRef(null);
    const lastCodeRef = useRef(null);
    const readerRef = useRef(null);
    const isStartingRef = useRef(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        let isActive = true;

        const startScanner = async () => {
            if (paused || isStartingRef.current) return;
            isStartingRef.current = true;
            setError(null);

            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    setError('Camera not supported in this browser');
                    isStartingRef.current = false;
                    return;
                }

                // Trigger permission prompt explicitly (Chrome desktop)
                try {
                    const permStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' } }
                    });
                    permStream.getTracks().forEach((t) => t.stop());
                } catch (permErr) {
                    console.error('Camera permission error:', permErr);
                    setError('Camera permission denied. Please allow camera access.');
                    isStartingRef.current = false;
                    return;
                }

                const devices = await BrowserMultiFormatReader.listVideoInputDevices();
                const preferredDevice = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];
                if (!preferredDevice) {
                    setError('No camera device found');
                    isStartingRef.current = false;
                    return;
                }

                // Ensure any existing stream is stopped before starting a new decode
                try {
                    if (reader && typeof reader.reset === 'function') {
                        reader.reset();
                    }
                } catch (resetErr) {
                    console.warn('ZXing pre-start reset warn:', resetErr);
                }

                await reader.decodeFromVideoDevice(preferredDevice?.deviceId, videoRef.current, (result, err) => {
                    if (!isActive || paused) return;
                    if (err?.name === 'NotAllowedError') {
                        setError('Camera permission denied. Please allow camera access and reload.');
                        return;
                    }
                    if (err?.name === 'AbortError') {
                        setError('Camera access was interrupted. Click “Scan Again” to retry.');
                        return;
                    }
                    if (result) {
                        const text = result.getText();
                        if (text && text !== lastCodeRef.current) {
                            lastCodeRef.current = text;
                            if (navigator.vibrate) navigator.vibrate(120);
                            onDetected(text);
                        }
                    }
                });
            } catch (error) {
                if (error?.name === 'NotAllowedError') {
                    setError('Camera permission denied. Please allow camera access and reload.');
                } else if (error?.name === 'AbortError') {
                    setError('Camera access was interrupted. Click “Scan Again” to retry.');
                } else {
                    console.error('ZXing init error:', error);
                    setError('Unable to start camera. Check permissions or try a different browser.');
                }
            } finally {
                isStartingRef.current = false;
            }
        };

        if (!paused) {
            startScanner();
        }

        return () => {
            isActive = false;
            lastCodeRef.current = null;
            try {
                if (reader && typeof reader.reset === 'function') {
                    reader.reset();
                }
            } catch (err) {
                // Swallow cleanup errors
            }
            isStartingRef.current = false;
        };
    }, [onDetected, paused]);

    // If paused changes to true, stop the reader; if false, it will restart via effect
    useEffect(() => {
        if (paused && readerRef.current) {
            try {
                if (typeof readerRef.current.reset === 'function') {
                    readerRef.current.reset();
                }
            } catch (err) {
                // ignore
            }
        }
        if (!paused) {
            lastCodeRef.current = null;
        }
    }, [paused]);

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
            {error && (
                <div className="absolute inset-0 bg-black/70 text-white text-center text-sm flex items-center justify-center px-4">
                    {error}
                </div>
            )}
        </div>
    );
};

export default Scanner;
