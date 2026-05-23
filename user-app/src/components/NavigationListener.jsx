import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useNavHistoryStore from '../stores/navHistoryStore';

const NavigationListener = () => {
  const location = useLocation();
  const prevRef = useRef(null);

  const push = useNavHistoryStore((s) => s.push);
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && prev !== location.pathname) {
      // push previous location so BackButton can use it
      push(prev);
    }
    prevRef.current = location.pathname;
  }, [location.pathname, push]);

  return null;
};

export default NavigationListener;
