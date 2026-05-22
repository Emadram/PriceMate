import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  // force remount when location.pathname changes by using key
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="w-full h-full">
      <div
        className={`w-full h-full transition-opacity ease-linear`
        }
        style={{ opacity: visible ? 1 : 0, transitionDuration: '120ms' }}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransition;
