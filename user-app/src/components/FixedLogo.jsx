import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import AppLogo from './AppLogo';

const FixedLogo = () => {
  if (typeof document === 'undefined') return null;

  const el = (
    <div
      className="fixed left-4 top-[calc(env(safe-area-inset-top,0px)+8px)] z-99999 pointer-events-auto"
      style={{ willChange: 'transform' }}
    >
      <Link to="/" className="flex items-center gap-2 bg-transparent">
        <AppLogo size="sm" />
        <span className="text-sm sm:text-sm md:text-lg font-black text-gray-900 dark:text-white tracking-tighter">PriceMate</span>
      </Link>
    </div>
  );

  return createPortal(el, document.body);
};

export default FixedLogo;
