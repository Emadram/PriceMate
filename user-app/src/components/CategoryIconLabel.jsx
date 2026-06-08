import useCategoriesStore from '../stores/categoriesStore';
import { getExpandedCategoryDoc } from '../utils/productUtils';

const CategoryIconLabel = ({ categoryId, fallbackName = 'Other', className = '', variant = 'compact' }) => {
    const getIconForCategory = useCategoriesStore((s) => s.getIconForCategory);

    const doc = getExpandedCategoryDoc(categoryId);
    const label = doc?.categoryName || doc?.name || fallbackName || 'Other';
    const payload = doc
        ? { categoryName: label, icon: doc.icon }
        : (fallbackName || 'Other');

    const iconEl = getIconForCategory(payload);
    const isSection = variant === 'section';

    return (
        <span
            className={`inline-flex min-w-0 max-w-full items-center gap-2 ${
                isSection
                    ? 'text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight'
                    : 'text-xs font-medium text-gray-500 dark:text-gray-400'
            } ${className}`}
        >
            <span
                className={`inline-flex shrink-0 items-center justify-center rounded-xl ${
                    isSection
                        ? 'h-9 w-9 sm:h-10 sm:w-10 text-xl bg-brand-50 text-brand-600 shadow-sm ring-1 ring-brand-100/80 dark:bg-brand-900/25 dark:text-brand-400 dark:ring-brand-800/40'
                        : 'h-6 w-6 text-lg bg-gray-50 text-brand-600 dark:bg-gray-800 dark:text-brand-500'
                }`}
            >
                {iconEl}
            </span>
            <span className="truncate">{label}</span>
        </span>
    );
};

export default CategoryIconLabel;
