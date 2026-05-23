import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useNavHistoryStore from '../stores/navHistoryStore';

const SCROLL_KEY_PREFIX = 'pricemate-scroll:';

const NavigationListener = () => {
  const location = useLocation();
  const prevRef = useRef(null);

  const push = useNavHistoryStore((s) => s.push);

  useEffect(() => {
    const prev = prevRef.current;
    // Save previous page scroll position before leaving
    if (prev && prev !== location.pathname) {
      try {
        sessionStorage.setItem(`${SCROLL_KEY_PREFIX}${prev}`, String(window.scrollY || window.pageYOffset || 0));
      } catch (e) {
        // ignore storage errors
      }
      // push previous location so BackButton can use it
      push(prev);
    }

    prevRef.current = location.pathname;

    // Restore scroll for the current path if we have it, otherwise default to top
    try {
      const stored = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${location.pathname}`);
      if (stored !== null) {
        const pos = parseInt(stored, 10) || 0;
        // small timeout to allow route content to render
        window.setTimeout(() => window.scrollTo(0, pos), 30);
      } else {
        window.setTimeout(() => window.scrollTo(0, 0), 30);
      }
    } catch (e) {
      window.setTimeout(() => window.scrollTo(0, 0), 30);
    }

    // Also save scroll on unload for the active path
    const handleBeforeUnload = () => {
      try {
        sessionStorage.setItem(`${SCROLL_KEY_PREFIX}${location.pathname}`, String(window.scrollY || window.pageYOffset || 0));
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [location.pathname, push]);

  return null;
};

export default NavigationListener;
