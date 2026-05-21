import { useEffect, useRef, useState } from 'react';

const useFreshIndicator = (lastUpdated, { minIntervalMs = 2000, activeDurationMs = 1200 } = {}) => {
    const [isFresh, setIsFresh] = useState(false);
    const lastToggleRef = useRef(0);
    const offTimerRef = useRef(null);

    useEffect(() => {
        if (!lastUpdated) return;
        const now = Date.now();
        if (!isFresh && now - lastToggleRef.current >= minIntervalMs) {
            lastToggleRef.current = now;
            setTimeout(() => setIsFresh(true), 0);
        }

        if (offTimerRef.current) {
            clearTimeout(offTimerRef.current);
        }

        offTimerRef.current = setTimeout(() => {
            setIsFresh(false);
            offTimerRef.current = null;
        }, activeDurationMs);

        return () => {
            if (offTimerRef.current) {
                clearTimeout(offTimerRef.current);
                offTimerRef.current = null;
            }
        };
    }, [lastUpdated, minIntervalMs, activeDurationMs, isFresh]);

    useEffect(() => {
        return () => {
            if (offTimerRef.current) {
                clearTimeout(offTimerRef.current);
            }
        };
    }, []);

    return isFresh;
};

export default useFreshIndicator;
