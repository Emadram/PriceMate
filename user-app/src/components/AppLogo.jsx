import { useMemo, useState } from 'react';
import { FiCpu } from 'react-icons/fi';
import { APP_AI_LOGO_SRC, getAppLogoSrc } from '../utils/appLogo';

const SIZES = {
    xs: { shell: 'h-9 w-9 rounded-2xl', pad: 'p-0.5' },
    sm: { shell: 'h-10 w-10 rounded-xl', pad: 'p-1' },
    md: { shell: 'h-16 w-16 rounded-2xl', pad: 'p-2' },
    lg: { shell: 'h-32 w-32 rounded-[1.35rem]', pad: 'p-2' },
    fab: { shell: 'h-9 w-9 rounded-full', pad: 'p-0.5' },
};

const SHELL =
    'flex shrink-0 items-center justify-center overflow-hidden bg-white/90 dark:bg-gray-900/60 border border-gray-100/70 dark:border-gray-800/60 shadow-lg shadow-brand-500/20';

/**
 * @param {{
 *   variant?: 'app' | 'ai',
 *   size?: keyof typeof SIZES,
 *   className?: string,
 *   shellClassName?: string,
 *   alt?: string,
 *   withShell?: boolean,
 * }} props
 */
const AppLogo = ({
    variant = 'app',
    size = 'sm',
    className = '',
    shellClassName = '',
    alt = 'PriceMate',
    withShell = true,
    ...imgProps
}) => {
    const src = useMemo(
        () => (variant === 'ai' ? APP_AI_LOGO_SRC : getAppLogoSrc()),
        [variant]
    );
    const [failed, setFailed] = useState(false);
    const dimensions = SIZES[size] ?? SIZES.sm;

    if (variant === 'ai' && failed) {
        return (
            <div
                className={`${withShell ? SHELL : ''} ${dimensions.shell} ${shellClassName} ${className} flex items-center justify-center text-brand-600 dark:text-brand-400`}
                aria-hidden
            >
                <FiCpu className="text-lg" />
            </div>
        );
    }

    const image = (
        <img
            src={src}
            alt={alt}
            className={`h-full w-full object-contain ${dimensions.pad}`}
            loading="eager"
            decoding="async"
            onError={() => setFailed(true)}
            {...imgProps}
        />
    );

    if (!withShell) {
        return (
            <div className={`${dimensions.shell} ${className} overflow-hidden`}>{image}</div>
        );
    }

    return (
        <div className={`${SHELL} ${dimensions.shell} ${shellClassName} ${className}`}>
            {image}
        </div>
    );
};

export default AppLogo;
