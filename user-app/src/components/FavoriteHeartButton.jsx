import { FiHeart } from 'react-icons/fi';

const FavoriteHeartButton = ({
    pressed,
    onClick,
    disabled = false,
    ariaLabel,
    className = '',
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed}
        aria-label={ariaLabel ?? (pressed ? 'Remove from favorites' : 'Add to favorites')}
        className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
            pressed
                ? 'border-red-200 bg-red-50 text-red-500 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400'
                : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-red-200 hover:text-red-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-red-500/30'
        } disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
        <FiHeart size={22} className={pressed ? 'fill-current' : ''} strokeWidth={2} />
    </button>
);

export default FavoriteHeartButton;
