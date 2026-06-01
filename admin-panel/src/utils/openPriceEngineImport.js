/**
 * Build Appwrite price_history payloads from normalized OPE rows.
 * @param {{ price: number, timestamp: string }[]} normalizedRows
 * @param {{ productId: string, supermarketId: string, priceChangeReason?: string, opeStore?: string }} options
 */
export const buildOpeImportPayloads = (normalizedRows, options) => {
    const { productId, supermarketId, priceChangeReason = 'Open Price Engine import', opeStore } = options;

    if (!productId || !supermarketId) {
        return { payloads: [], skipped: normalizedRows?.length || 0 };
    }

    const reasonBase = priceChangeReason || 'Open Price Engine import';
    const reason = opeStore ? `${reasonBase} (${opeStore})` : reasonBase;

    const seen = new Set();
    const payloads = [];
    let skipped = 0;

    for (const row of normalizedRows || []) {
        if (row?.price == null || !row?.timestamp) {
            skipped += 1;
            continue;
        }
        const key = `${row.timestamp}|${row.price}`;
        if (seen.has(key)) {
            skipped += 1;
            continue;
        }
        seen.add(key);
        payloads.push({
            priceId: null,
            price: row.price,
            productId,
            supermarketId,
            timestamp: row.timestamp,
            isPromotional: false,
            priceChangeReason: reason,
        });
    }

    return { payloads, skipped };
};
