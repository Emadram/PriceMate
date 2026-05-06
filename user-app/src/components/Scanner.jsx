import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const Scanner = ({ onDetected, paused = false }) => {
    const videoRef = useRef(null);
    const lastCodeRef = useRef(null);
    const readerRef = useRef(null);
    const controlsRef = useRef(null);
    const isStartingRef = useRef(false);
    const streamRef = useRef(null);
    const trackRef = useRef(null);
    const onDetectedRef = useRef(onDetected);
    const candidateRef = useRef({ text: null, count: 0, firstTs: 0, lastTs: 0 });
    const [error, setError] = useState(null);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [zoomAvailable, setZoomAvailable] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });

    // Reduce false positives by requiring the same code to be detected across multiple frames.
    const REQUIRED_MATCHES = 3;
    const MATCH_WINDOW_MS = 1200;

    const triggerHaptic = () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(100); // 100ms vibration
        }
    };

    useEffect(() => {
        onDetectedRef.current = onDetected;
    }, [onDetected]);

    const hints = useMemo(() => {
        // Restrict to common product barcode formats to reduce misreads and speed up decoding.
        const possibleFormats = [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39
        ];

        const h = new Map();
        h.set(DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
        h.set(DecodeHintType.TRY_HARDER, true);
        return h;
    }, []);

    const stopStream = () => {
        try {
            controlsRef.current?.stop?.();
        } catch {
            // ignore
        }
        controlsRef.current = null;

        try {
            readerRef.current?.reset?.();
        } catch {
            // ignore
        }

        try {
            const s = streamRef.current;
            if (s && typeof s.getTracks === 'function') {
                s.getTracks().forEach((t) => {
                    try {
                        t.stop();
                    } catch {
                        // ignore
                    }
                });
            }
        } catch {
            // ignore
        }

        streamRef.current = null;
        trackRef.current = null;
    };

    const tuneTrackIfPossible = async () => {
        const videoEl = videoRef.current;
        const stream = videoEl?.srcObject;
        if (!stream || !(stream instanceof MediaStream)) return;

        const [track] = stream.getVideoTracks();
        if (!track) return;

        streamRef.current = stream;
        trackRef.current = track;

        // Camera capabilities vary a lot by device/browser; apply the safe ones opportunistically.
        const caps = track.getCapabilities?.() || {};

        // Continuous focus/exposure/white balance (where supported) tends to help barcode reads.
        const adv = [];
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            adv.push({ focusMode: 'continuous' });
        }
        if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
            adv.push({ exposureMode: 'continuous' });
        }
        if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
            adv.push({ whiteBalanceMode: 'continuous' });
        }

        try {
            if (adv.length) {
                await track.applyConstraints({ advanced: adv });
            }
        } catch {
            // ignore: not all browsers accept these constraints
        }

        const hasTorch = !!caps.torch;
        setTorchAvailable(hasTorch);
        if (!hasTorch) setTorchOn(false);

        if (typeof caps.zoom === 'object' && caps.zoom) {
            const min = typeof caps.zoom.min === 'number' ? caps.zoom.min : 1;
            const max = typeof caps.zoom.max === 'number' ? caps.zoom.max : 1;
            const step = typeof caps.zoom.step === 'number' ? caps.zoom.step : 0.1;
            setZoomAvailable(max > min);
            setZoomRange({ min, max, step });

            // Start slightly zoomed-in if it’s available; helps small/far barcodes.
            const defaultZoom = Math.min(max, Math.max(min, 1.8));
            setZoom(defaultZoom);
            try {
                await track.applyConstraints({ advanced: [{ zoom: defaultZoom }] });
            } catch {
                // ignore
            }
        } else {
            setZoomAvailable(false);
            setZoom(1);
            setZoomRange({ min: 1, max: 1, step: 0.1 });
        }
    };

    const setTorch = async (nextOn) => {
        const track = trackRef.current;
        if (!track) return;
        try {
            await track.applyConstraints({ advanced: [{ torch: !!nextOn }] });
            setTorchOn(!!nextOn);
        } catch {
            // ignore
        }
    };

    const setZoomLevel = async (nextZoom) => {
        const track = trackRef.current;
        if (!track) return;
        const z = Number(nextZoom);
        if (!Number.isFinite(z)) return;
        try {
            await track.applyConstraints({ advanced: [{ zoom: z }] });
            setZoom(z);
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        const reader = new BrowserMultiFormatReader(hints, 150);
        readerRef.current = reader;
        let isActive = true;

        const startScanner = async () => {
            if (paused || isStartingRef.current) return;
            isStartingRef.current = true;
            setError(null);
            candidateRef.current = { text: null, count: 0, firstTs: 0, lastTs: 0 };
            setTorchAvailable(false);
            setTorchOn(false);
            setZoomAvailable(false);
            setZoom(1);
            setZoomRange({ min: 1, max: 1, step: 0.1 });

            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    setError('Camera not supported in this browser');
                    isStartingRef.current = false;
                    return;
                }

                // Stop any existing stream/decoder cleanly before starting again.
                stopStream();

                const devices = await BrowserMultiFormatReader.listVideoInputDevices();
                const preferredDevice = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];
                if (!preferredDevice) {
                    setError('No camera device found');
                    isStartingRef.current = false;
                    return;
                }

                const constraints = {
                    audio: false,
                    video: {
                        deviceId: preferredDevice?.deviceId ? { exact: preferredDevice.deviceId } : undefined,
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    }
                };

                const onDecode = (result, err) => {
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
                        const trimmed = typeof text === 'string' ? text.trim() : '';
                        if (!trimmed) return;

                        const now = Date.now();
                        const c = candidateRef.current;

                        // Drop stale candidates if there's a long gap between matches.
                        if (c.text && now - c.lastTs > MATCH_WINDOW_MS) {
                            candidateRef.current = { text: null, count: 0, firstTs: 0, lastTs: 0 };
                        }

                        if (candidateRef.current.text === trimmed && now - candidateRef.current.firstTs <= MATCH_WINDOW_MS) {
                            candidateRef.current.count += 1;
                            candidateRef.current.lastTs = now;
                        } else {
                            candidateRef.current = { text: trimmed, count: 1, firstTs: now, lastTs: now };
                        }

                        if (
                            candidateRef.current.count >= REQUIRED_MATCHES &&
                            trimmed !== lastCodeRef.current
                        ) {
                            triggerHaptic();
                            lastCodeRef.current = trimmed;
                            candidateRef.current = { text: null, count: 0, firstTs: 0, lastTs: 0 };
                            if (navigator.vibrate) navigator.vibrate(120);
                            onDetectedRef.current?.(trimmed);
                        }
                    }
                };

                // Prefer decodeFromConstraints so we can request better resolution and then tune the track.
                if (typeof reader.decodeFromConstraints === 'function') {
                    controlsRef.current = await reader.decodeFromConstraints(constraints, videoRef.current, onDecode);
                } else {
                    // Fallback for older API shapes.
                    controlsRef.current = await reader.decodeFromVideoDevice(preferredDevice?.deviceId, videoRef.current, onDecode);
                }

                // Give the video element a moment to receive its MediaStream, then tune constraints (AF/torch/zoom).
                setTimeout(() => {
                    if (!isActive || paused) return;
                    tuneTrackIfPossible();
                }, 250);
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
            candidateRef.current = { text: null, count: 0, firstTs: 0, lastTs: 0 };
            try {
                stopStream();
            } catch (err) {
                // Swallow cleanup errors
            }
            isStartingRef.current = false;
        };
    }, [hints, paused]);

    // If paused changes to true, stop the reader; if false, it will restart via effect
    useEffect(() => {
        if (paused) stopStream();
        if (!paused) {
            lastCodeRef.current = null;
            candidateRef.current = { text: null, count: 0, firstTs: 0, lastTs: 0 };
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
            {/* Viewfinder */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-36 border-2 border-white/60 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>

            {/* Controls */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                <div className="text-white text-xs bg-black/40 px-2 py-1 rounded">
                    Hold steady • fill the box
                </div>
                {torchAvailable && (
                    <button
                        type="button"
                        onClick={() => setTorch(!torchOn)}
                        className="text-white text-xs bg-black/55 hover:bg-black/70 px-3 py-2 rounded-lg transition"
                    >
                        {torchOn ? 'Torch: On' : 'Torch: Off'}
                    </button>
                )}
            </div>

            {zoomAvailable && (
                <div className="absolute bottom-9 left-3 right-3 bg-black/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                        <div className="text-white text-xs whitespace-nowrap">Zoom</div>
                        <input
                            type="range"
                            min={zoomRange.min}
                            max={zoomRange.max}
                            step={zoomRange.step}
                            value={zoom}
                            onChange={(e) => setZoomLevel(e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs">
                Align the barcode inside the box
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
