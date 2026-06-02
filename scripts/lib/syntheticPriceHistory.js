import { resolveAnchorPrice } from './groceryPriceAnchors.js';

export const SYNTHETIC_REASON = 'synthetic_seed';
export const PROMO_REASON = 'promotion';

/** Month-start inflation multipliers relative to end anchor (TRY grocery ~2023–2025). */
const INFLATION_KNOTS = [
    { year: 2023, month: 1, mult: 0.58 },
    { year: 2024, month: 1, mult: 0.78 },
    { year: 2025, month: 1, mult: 0.92 },
];

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

/**
 * Seeded PRNG (mulberry32).
 * @param {number} seed
 */
export const createRng = (seed) => {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * @param {string} key
 * @returns {number}
 */
export const hashSeed = (key) => {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

/**
 * @param {Date} date
 * @param {Date} endDate
 * @returns {number}
 */
export const inflationMultiplierAt = (date, endDate) => {
    const endMult = 1;
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const monthIndex = y * 12 + m;

    const knots = [
        ...INFLATION_KNOTS.map((k) => ({
            monthIndex: k.year * 12 + k.month,
            mult: k.mult,
        })),
        {
            monthIndex: endDate.getUTCFullYear() * 12 + (endDate.getUTCMonth() + 1),
            mult: endMult,
        },
    ].sort((a, b) => a.monthIndex - b.monthIndex);

    if (monthIndex <= knots[0].monthIndex) return knots[0].mult;
    if (monthIndex >= knots[knots.length - 1].monthIndex) return endMult;

    for (let i = 0; i < knots.length - 1; i++) {
        const a = knots[i];
        const b = knots[i + 1];
        if (monthIndex >= a.monthIndex && monthIndex <= b.monthIndex) {
            const t = (monthIndex - a.monthIndex) / (b.monthIndex - a.monthIndex || 1);
            return a.mult + t * (b.mult - a.mult);
        }
    }
    return endMult;
};

/**
 * @param {Date} start
 * @param {Date} end
 * @param {number} minPoints
 * @returns {Date[]}
 */
export const buildTimeline = (start, end, minPoints = 50) => {
    const timestamps = [];
    let cursor = start.getTime();
    const endMs = end.getTime();

    while (cursor <= endMs) {
        timestamps.push(new Date(cursor));
        cursor += MS_WEEK;
    }

    if (timestamps.length < minPoints) {
        const step = Math.max(MS_DAY, Math.floor((endMs - start.getTime()) / Math.max(1, minPoints - 1)));
        timestamps.length = 0;
        cursor = start.getTime();
        while (cursor <= endMs) {
            timestamps.push(new Date(cursor));
            cursor += step;
            if (timestamps.length > minPoints + 10) break;
        }
        const last = timestamps[timestamps.length - 1];
        if (!last || last.getTime() !== endMs) {
            timestamps.push(new Date(endMs));
        }
    }

    return timestamps;
};

/**
 * @param {Date} date
 * @param {string} category
 * @returns {number}
 */
const seasonalityFactor = (date, category) => {
    const month = date.getUTCMonth();
    const wave = Math.sin((month / 12) * Math.PI * 2);
    const summerCategories = new Set(['snacks', 'soft_drinks', 'water', 'confectionery']);
    const amp = summerCategories.has(category) ? 0.025 : 0.012;
    return 1 + wave * amp;
};

/**
 * @param {number} value
 * @returns {number}
 */
const roundPrice = (value) => Math.round(value * 100) / 100;

/**
 * @param {object} options
 * @param {string} options.productId
 * @param {{ supermarketId: string, priceId: string, currentPrice: number|null }[]} options.stores
 * @param {{ name?: string, unit?: string, brand?: string }} [options.productMeta]
 * @param {Date} options.startDate
 * @param {Date} options.endDate
 * @param {number} [options.minPoints]
 * @param {number} [options.storeBias]
 * @returns {object[]}
 */
export const generateSyntheticHistory = (options) => {
    const {
        productId,
        stores,
        productMeta = {},
        startDate,
        endDate,
        minPoints = 50,
        storeBias = 0.03,
    } = options;

    if (!stores?.length) return [];

    const rng = createRng(hashSeed(productId));
    const timeline = buildTimeline(startDate, endDate, minPoints);
    if (timeline.length === 0) return [];

    const storeAnchors = stores
        .filter((store) => store.priceId)
        .map((store, idx, arr) => {
            const { anchor, band } = resolveAnchorPrice(store.currentPrice, productMeta);
            const bias = 1 + (idx - (arr.length - 1) / 2) * storeBias;
            return {
                supermarketId: store.supermarketId,
                priceId: store.priceId,
                endAnchor: roundPrice(anchor),
                walkAnchor: roundPrice(anchor * bias),
                band,
            };
        });

    if (storeAnchors.length === 0) return [];

    const payloads = [];
    const storeCount = storeAnchors.length;
    const lastByStore = new Map();

    for (let i = 0; i < timeline.length; i++) {
        const ts = timeline[i];
        const storeIdx = i % storeCount;
        const { supermarketId, priceId, walkAnchor, band } = storeAnchors[storeIdx];

        const infl = inflationMultiplierAt(ts, endDate);
        const seasonal = seasonalityFactor(ts, band.category);
        let target = walkAnchor * infl * seasonal;

        const prev = lastByStore.get(supermarketId);
        if (prev != null) {
            const maxStep = 0.04;
            const rawStep = (target - prev) / prev;
            const clampedStep = Math.max(-maxStep, Math.min(maxStep, rawStep));
            target = prev * (1 + clampedStep);
        }

        target *= 1 + (rng() - 0.5) * 0.03;

        const isPromo = rng() < 0.08 && i > 0 && i < timeline.length - 1;
        if (isPromo) {
            target *= 1 - (0.08 + rng() * 0.07);
        }

        const price = roundPrice(Math.max(band.min * 0.5, target));
        lastByStore.set(supermarketId, price);

        payloads.push({
            priceId,
            price,
            productId,
            supermarketId,
            timestamp: ts.toISOString(),
            isPromotional: isPromo,
            priceChangeReason: isPromo ? PROMO_REASON : SYNTHETIC_REASON,
        });
    }

    for (const { supermarketId, endAnchor } of storeAnchors) {
        const rows = payloads.filter((p) => p.supermarketId === supermarketId);
        if (rows.length === 0) continue;
        const last = rows[rows.length - 1];
        last.price = roundPrice(endAnchor);
        last.isPromotional = false;
        last.priceChangeReason = SYNTHETIC_REASON;
    }

    return payloads;
};

/**
 * @param {object[]} payloads
 * @returns {number}
 */
export const countPromoPoints = (payloads) =>
    payloads.filter((p) => p.isPromotional).length;
