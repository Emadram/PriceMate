import { useEffect, useRef } from 'react';
import Quagga from 'quagga';

const Scanner = ({ onDetected }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        if (scannerRef.current) {
            Quagga.init(
                {
                    inputStream: {
                        type: 'LiveStream',
                        target: scannerRef.current,
                        constraints: {
                            facingMode: 'environment', // Use back camera
                            width: 640,
                            height: 480,
                        },
                    },
                    locator: {
                        patchSize: 'medium',
                        halfSample: true,
                    },
                    numOfWorkers: 2,
                    decoder: {
                        readers: ['ean_reader', 'ean_8_reader', 'upc_reader'], // Common barcode types
                    },
                    locate: true,
                },
                (err) => {
                    if (err) {
                        console.error('Error initializing Quagga:', err);
                        return;
                    }
                    Quagga.start();
                }
            );

            Quagga.onDetected((data) => {
                if (data && data.codeResult) {
                    onDetected(data.codeResult.code);
                    Quagga.stop(); // Stop scanning after detection
                }
            });

            return () => {
                Quagga.stop();
            };
        }
    }, [onDetected]);

    return (
        <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
            <div ref={scannerRef} className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
            <div className="absolute inset-0 border-2 border-red-500 opacity-50 pointer-events-none" />
            <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs">
                Align barcode within the frame
            </div>
        </div>
    );
};

export default Scanner;
