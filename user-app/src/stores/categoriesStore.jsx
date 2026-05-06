import { create } from 'zustand';
import { fetchCategories } from '../utils/productUtils';
import { CATEGORY_ICON_ELEMENTS } from '../constants/categoryIconMap';

const resolveCategoryLabel = (category) => {
    if (!category) return '';
    if (typeof category === 'string') return category;
    return category.categoryName || category.name || '';
};

/** Keys allowed for keyword fallback (excludes `default`) */
const CATEGORY_ICON_KEYS_ONLY = Object.keys(CATEGORY_ICON_ELEMENTS).filter((k) => k !== 'default');

const getIconFromCategoryName = (categoryName) => {
    if (!categoryName) return CATEGORY_ICON_ELEMENTS.default;

    const label = categoryName.toLowerCase().replace(/\s/g, '-');

    if (CATEGORY_ICON_ELEMENTS[label]) return CATEGORY_ICON_ELEMENTS[label];

    const sortedKeys = [...CATEGORY_ICON_KEYS_ONLY].sort((a, b) => b.length - a.length);
    const fallbackKey = sortedKeys.find((k) => label.includes(k));
    if (fallbackKey) return CATEGORY_ICON_ELEMENTS[fallbackKey];

    return CATEGORY_ICON_ELEMENTS.default;
};

const useCategoriesStore = create((set, get) => ({
    categories: [],
    loading: false,
    error: null,

    fetchCategories: async () => {
        set({ loading: true, error: null });
        try {
            const allCategories = await fetchCategories();
            set({ categories: allCategories, loading: false });
        } catch (error) {
            console.error('Failed to fetch categories:', error);
            set({ error: error.message, loading: false });
        }
    },

    getIconForCategory: (category) => {
        const iconKey =
            typeof category === 'object' && category?.icon
                ? String(category.icon).trim().toLowerCase()
                : '';
        if (iconKey && CATEGORY_ICON_ELEMENTS[iconKey]) {
            return CATEGORY_ICON_ELEMENTS[iconKey];
        }

        return getIconFromCategoryName(resolveCategoryLabel(category));
    },
}));

export default useCategoriesStore;