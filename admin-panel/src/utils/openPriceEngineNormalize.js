const parsePrice = (value) => {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
};

const parseTimestamp = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
};

const pickFromObject = (obj) => {
    const price =
        parsePrice(obj.price) ??
        parsePrice(obj.Price) ??
        parsePrice(obj.product_price) ??
        parsePrice(obj.amount);

    const timestamp =
        parseTimestamp(obj.date) ??
        parseTimestamp(obj.Date) ??
        parseTimestamp(obj.timestamp) ??
        parseTimestamp(obj.recorded_at) ??
        parseTimestamp(obj.price_date);

    const productLabel =
        obj.productname ||
        obj.product_name ||
        obj.name ||
        obj.product ||
        obj.Product ||
        null;

    const rawStore = obj.store || obj.Store || obj.shop || null;

    if (price == null || !timestamp) return null;

    return { price, timestamp, productLabel, rawStore };
};

/**
 * Normalize Open Price Engine historical response to import rows.
 * @param {unknown} data
 * @returns {{ price: number, timestamp: string, productLabel?: string, rawStore?: string }[]}
 */
export const normalizeOpeHistoricalResponse = (data) => {
    const items = [];

    const visit = (node) => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (typeof node === 'object') {
            const row = pickFromObject(node);
            if (row) {
                items.push(row);
                return;
            }
            Object.values(node).forEach(visit);
        }
    };

    visit(data);

    const seen = new Set();
    const deduped = [];
    for (const row of items) {
        const key = `${row.timestamp}|${row.price}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
    }

    deduped.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return deduped;
};
