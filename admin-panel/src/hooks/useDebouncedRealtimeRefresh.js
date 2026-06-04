import { useEffect, useRef } from 'react';
import { client } from '../lib/appwrite';

const DEFAULT_DEBOUNCE_MS = 1500;

/**
 * Subscribes to Appwrite realtime channel(s) and debounces refresh callbacks.
 * Skips refresh when the document is hidden (optional).
 */
export function useDebouncedRealtimeRefresh(channels, onRefresh, debounceMs = DEFAULT_DEBOUNCE_MS) {
  const timerRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const channelList = Array.isArray(channels) ? channels : [channels];
    if (!channelList.length || typeof onRefreshRef.current !== 'function') return undefined;

    const scheduleRefresh = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onRefreshRef.current?.();
      }, debounceMs);
    };

    const unsubs = channelList.map((channel) =>
      client.subscribe(channel, scheduleRefresh)
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore teardown errors
        }
      });
    };
  }, [channels, debounceMs]);
}

export default useDebouncedRealtimeRefresh;
