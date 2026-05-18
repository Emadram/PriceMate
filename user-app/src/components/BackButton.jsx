import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

const BackButton = ({ to, label = 'Go Back', className = '', onClick }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (onClick) {
            onClick();
            return;
        }
        if (to) {
            navigate(to);
            return;
        }
        navigate(-1);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            title={label}
            className={`tap-target h-11 w-11 rounded-full flex items-center justify-center border border-gray-200/70 dark:border-gray-700/70 bg-white/90 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 shadow-sm transition-all hover:bg-white dark:hover:bg-gray-700/80 hover:shadow-md active:scale-95 ${className}`}
        >
            <FiArrowLeft size={18} />
        </button>
    );
};

export default BackButton;
