import { useEffect, useRef, useState } from 'react';

const useFreshIndicator = (lastUpdated, { minIntervalMs = 2000, activeDurationMs = 1200 } = {}) => {
    const [isFresh, setIsFresh] = useState(false);
    const lastToggleRef = useRef(0);

    useEffect(() => {
        if (!lastUpdated) return;
        const now = Date.now();
        if (now - lastToggleRef.current < minIntervalMs) return;
        lastToggleRef.current = now;
        const t0 = setTimeout(() => setIsFresh(true), 0);
        const timer = setTimeout(() => setIsFresh(false), activeDurationMs);
        return () => { clearTimeout(t0); clearTimeout(timer); };
    }, [lastUpdated, minIntervalMs, activeDurationMs]);

    return isFresh;
};

export default useFreshIndicator;
