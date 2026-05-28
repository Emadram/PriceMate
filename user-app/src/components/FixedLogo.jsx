import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

const FixedLogo = () => {
  if (typeof document === 'undefined') return null;

  const el = (
    <div
      className="fixed left-4 top-[calc(env(safe-area-inset-top,0px)+8px)] z-99999 pointer-events-auto"
      style={{ willChange: 'transform' }}
    >
      <Link to="/" className="flex items-center gap-2 bg-transparent">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/90 dark:bg-gray-900/60 shadow-lg shadow-brand-500/20 border border-gray-100/70 dark:border-gray-800/60 overflow-hidden">
          <img
            src="/LogoPriceMate.png"
            alt="PriceMate"
            className="h-full w-full object-contain p-1"
            loading="eager"
            decoding="async"
          />
        </div>
        <span className="text-sm sm:text-sm md:text-lg font-black text-gray-900 dark:text-white tracking-tighter">PriceMate</span>
      </Link>
    </div>
  );

  return createPortal(el, document.body);
};

export default FixedLogo;
