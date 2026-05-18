import useCategoriesStore from '../stores/categoriesStore';
import { getExpandedCategoryDoc } from '../utils/productUtils';

const CategoryIconLabel = ({ categoryId, fallbackName = 'Other', className = '' }) => {
    const getIconForCategory = useCategoriesStore((s) => s.getIconForCategory);

    const doc = getExpandedCategoryDoc(categoryId);
    const label = doc?.categoryName || doc?.name || fallbackName || 'Other';
    const payload = doc
        ? { categoryName: label, icon: doc.icon }
        : (fallbackName || 'Other');

    const iconEl = getIconForCategory(payload);

    return (
        <span
            className={`inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 ${className}`}
        >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg text-brand-600 dark:bg-gray-800 dark:text-brand-500">
                {iconEl}
            </span>
            <span className="truncate">{label}</span>
        </span>
    );
};

export default CategoryIconLabel;
