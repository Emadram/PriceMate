/**
 * TRY grocery price bands (approx. May 2025 retail) for synthetic history when
 * no current shelf price exists. Used only as fallback; prefer prices_collection.
 */

/** @typedef {{ min: number, max: number, mid: number, category: string }} PriceBand */

/** @type {Array<{ pattern: RegExp, band: PriceBand }>} */
const KEYWORD_BANDS = [
    { pattern: /\b(water|su)\b/i, band: { min: 8, max: 18, mid: 12, category: 'water' } },
    { pattern: /\b(chip|chips|cips|snack|kraker)\b/i, band: { min: 18, max: 40, mid: 28, category: 'snacks' } },
    { pattern: /\b(cola|coca|pepsi|fanta|sprite|gazoz|soda|soft\s*drink)\b/i, band: { min: 15, max: 55, mid: 32, category: 'soft_drinks' } },
    { pattern: /\b(milk|süt|yogurt|yoğurt|ayran|kefir)\b/i, band: { min: 30, max: 55, mid: 38, category: 'dairy' } },
    { pattern: /\b(bread|ekmek|sourdough|focaccia|bagel)\b/i, band: { min: 25, max: 55, mid: 35, category: 'bread' } },
    { pattern: /\b(rice|pirinç|bulgur|makarna|pasta)\b/i, band: { min: 35, max: 95, mid: 55, category: 'grains' } },
    { pattern: /\b(oil|zeytin|olive|ayçiçek|sunflower)\b/i, band: { min: 85, max: 180, mid: 120, category: 'oil' } },
    { pattern: /\b(egg|yumurta)\b/i, band: { min: 60, max: 140, mid: 90, category: 'eggs' } },
    { pattern: /\b(cheese|peynir|butter|tereyağ)\b/i, band: { min: 45, max: 220, mid: 95, category: 'dairy_premium' } },
    { pattern: /\b(chicken|tavuk|meat|et|beef|kıyma)\b/i, band: { min: 80, max: 350, mid: 160, category: 'meat' } },
    { pattern: /\b(coffee|kahve|tea|çay)\b/i, band: { min: 40, max: 250, mid: 85, category: 'beverages_dry' } },
    { pattern: /\b(chocolate|çikolata|candy|şeker)\b/i, band: { min: 15, max: 120, mid: 45, category: 'confectionery' } },
];

const DEFAULT_BAND = { min: 15, max: 120, mid: 42, category: 'general' };

/**
 * @param {string} name
 * @param {string} [unit]
 * @param {string} [brand]
 * @returns {PriceBand}
 */
export const resolvePriceBand = (name = '', unit = '', brand = '') => {
    const haystack = `${name} ${unit} ${brand}`.trim();
    for (const { pattern, band } of KEYWORD_BANDS) {
        if (pattern.test(haystack)) return { ...band };
    }
    return { ...DEFAULT_BAND };
};

/**
 * @param {number} value
 * @param {PriceBand} band
 * @returns {number}
 */
export const clampToBand = (value, band) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return band.mid;
    if (n < band.min * 0.25) return band.mid;
    if (n > band.max * 4) return band.mid;
    return Math.min(band.max * 1.15, Math.max(band.min * 0.85, n));
};

/**
 * Anchor when no current price: band mid with slight hash from name length.
 * @param {PriceBand} band
 * @param {string} [seedKey]
 * @returns {number}
 */
export const heuristicAnchorPrice = (band, seedKey = '') => {
    const hash = [...seedKey].reduce((a, c) => a + c.charCodeAt(0), 0);
    const spread = (band.max - band.min) * 0.35;
    const offset = ((hash % 100) / 100 - 0.5) * spread;
    return Math.round((band.mid + offset) * 100) / 100;
};

/**
 * @param {number|null|undefined} currentPrice
 * @param {{ name?: string, unit?: string, brand?: string }} productMeta
 * @returns {{ anchor: number, band: PriceBand, source: 'current' | 'heuristic' }}
 */
export const resolveAnchorPrice = (currentPrice, productMeta = {}) => {
    const band = resolvePriceBand(
        productMeta.name || '',
        productMeta.unit || '',
        productMeta.brand || ''
    );
    const parsed = Number(currentPrice);
    if (Number.isFinite(parsed) && parsed > 0) {
        return {
            anchor: clampToBand(parsed, band),
            band,
            source: 'current',
        };
    }
    return {
        anchor: heuristicAnchorPrice(band, productMeta.name || 'product'),
        band,
        source: 'heuristic',
    };
};
