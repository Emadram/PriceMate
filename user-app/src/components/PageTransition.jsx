import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const DURATION = 160; // ms for cross-fade

const PageTransition = ({ children }) => {
  const location = useLocation();
  const prevChildrenRef = useRef(children);
  const prevKeyRef = useRef(location.pathname);
  const [prevChildren, setPrevChildren] = useState(null);
  const [isNewVisible, setIsNewVisible] = useState(true);
  const [isPrevVisible, setIsPrevVisible] = useState(false);

  useEffect(() => {
    const currentKey = location.pathname;
    const previousKey = prevKeyRef.current;

    if (previousKey === currentKey) {
      // same route
      return;
    }

    // store previous children and show both layers (schedule state changes on RAF to avoid sync setState in effect)
    const prev = prevChildrenRef.current || null;
    const rafSetPrev = requestAnimationFrame(() => setPrevChildren(prev));

    // set refs for next cycle
    prevChildrenRef.current = children;
    prevKeyRef.current = currentKey;

    // Start cross-fade: show previous then fade it out while fading new in
    const rafShow = requestAnimationFrame(() => {
      setIsPrevVisible(true);
      setIsNewVisible(false);
    });

    // Next frame, fade new in and prev out
    const rafTransition = requestAnimationFrame(() => {
      setIsNewVisible(true);
      setIsPrevVisible(false);
    });

    // Clear prev after animation
    const timeout = setTimeout(() => {
      setPrevChildren(null);
    }, DURATION + 20);

    return () => {
      cancelAnimationFrame(rafSetPrev);
      cancelAnimationFrame(rafShow);
      cancelAnimationFrame(rafTransition);
      clearTimeout(timeout);
    };
  }, [children, location.pathname]);

  // Initial mount: prevChildrenRef already initialized with children

  return (
    <div className="relative w-full h-full">
      {prevChildren && (
        <div
          aria-hidden
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: isPrevVisible ? 1 : 0,
            transition: `opacity ${DURATION}ms linear`,
            pointerEvents: 'none'
          }}
        >
          {prevChildren}
        </div>
      )}

      <div
        className="relative w-full h-full"
        style={{
          opacity: isNewVisible ? 1 : 0,
          transition: `opacity ${DURATION}ms linear`
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransition;
