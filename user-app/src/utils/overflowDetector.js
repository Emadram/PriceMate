export function startOverflowDetector({ enabled = false } = {}) {
  if (!enabled) return () => {};
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let lastReportAt = 0;

  const report = () => {
    const now = Date.now();
    if (now - lastReportAt < 1500) return; // debounce
    lastReportAt = now;

    const docEl = document.documentElement;
    const scrollWidth = docEl.scrollWidth;
    const vw = window.innerWidth;
    if (!(scrollWidth > vw + 1)) return;

    const offenders = [];
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1 || rect.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: (el.className && String(el.className).slice(0, 140)) || '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
      if (offenders.length >= 12) break;
    }

    console.warn('[OverflowDetector] Horizontal overflow detected', {
      path: window.location.pathname,
      innerWidth: vw,
      scrollWidth,
      offenders,
    });
  };

  const onResize = () => report();
  const onScroll = () => report();

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.setTimeout(report, 300);

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
  };
}

