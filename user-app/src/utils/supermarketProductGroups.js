const getRelationshipId = (field) => {
    if (!field) return null;
    if (Array.isArray(field)) return field[0]?.$id || field[0] || null;
    if (typeof field === 'object') return field.$id || null;
    if (typeof field === 'string') return field;
    return null;
};

const getRelationshipName = (field, ...keys) => {
    if (!field || typeof field !== 'object') return '';
    for (const key of keys) {
        const value = field[key];
        if (value && typeof value === 'string') return value;
    }
    return '';
};

/**
 * Resolve category key + display label for a supermarket price row.
 */
export const getProductCategoryMeta = (price, t) => {
    const product = price?.products || {};
    const categoryRel = product.categoryId;
    const categoryId = getRelationshipId(categoryRel);
    const label =
        product.category ||
        getRelationshipName(categoryRel, 'categoryName', 'name') ||
        (typeof t === 'function' ? t('other', 'Other') : 'Other');
    const key = categoryId || String(label).toLowerCase().trim() || 'other';
    return { key, label: String(label).trim() || 'Other', categoryId: categoryRel || null };
};

/**
 * Group supermarket profile products by category; omit empty groups.
 * @param {Array} products
 * @param {(key: string, fallback?: string) => string} t
 */
export const groupSupermarketProductsByCategory = (products, t) => {
    const sections = new Map();

    for (const price of products || []) {
        const { key, label, categoryId } = getProductCategoryMeta(price, t);
        if (!sections.has(key)) {
            sections.set(key, { key, label, categoryId, products: [] });
        }
        sections.get(key).products.push(price);
    }

    return Array.from(sections.values())
        .filter((section) => section.products.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};
