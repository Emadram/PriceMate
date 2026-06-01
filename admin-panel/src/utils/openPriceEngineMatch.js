/**
 * Normalize product labels for fuzzy OPE catalog matching.
 * @param {string} value
 */
export const normalizeProductLabel = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

/**
 * Score how well an OPE product name matches a search query (0–100).
 * @param {string} query
 * @param {string} name
 */
export const scoreProductMatch = (query, name) => {
    const q = normalizeProductLabel(query);
    const n = normalizeProductLabel(name);
    if (!q || !n) return 0;
    if (n === q) return 100;
    if (n.includes(q)) return 95;

    const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
    if (!tokens.length) return 0;

    const hits = tokens.filter((t) => n.includes(t)).length;
    if (hits === 0) return 0;
    return Math.round((hits / tokens.length) * 85);
};

/**
 * @param {string} query
 * @param {string[]} names
 * @param {number} [minScore]
 */
export const rankProductNames = (query, names, minScore = 40) => {
    const scored = (names || [])
        .map((name) => ({
            name: String(name).trim(),
            score: scoreProductMatch(query, name),
        }))
        .filter((row) => row.name && row.score >= minScore)
        .sort((a, b) => b.score - a.score);

    return scored;
};

/**
 * Build a few catalog name variants for historical retries.
 * @param {string} productname
 */
export const buildProductNameVariants = (productname) => {
    const base = String(productname || '').trim();
    if (!base) return [];

    const variants = new Set([base]);
    variants.add(base.replace(/-/g, ' ').replace(/\s+/g, ' ').trim());
    variants.add(base.replace(/\s+/g, '-').trim());
    const collapsed = base.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
    if (collapsed) variants.add(collapsed);

    return [...variants].filter(Boolean).slice(0, 4);
};
