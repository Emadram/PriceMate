const QUERY_STOPWORDS = new Set([
    'is', 'this', 'that', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'with', 'to', 'and', 'or', 'but',
    'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how', 'do', 'does', 'did', 'are', 'was', 'were',
    'can', 'could', 'would', 'should', 'please', 'tell', 'me', 'about', 'show', 'find', 'compare', 'check',
    'look', 'up', 'give', 'need', 'want', 'know', 'product', 'price', 'prices', 'cheapest', 'expensive',
    'ingredients', 'ingredient', 'contains', 'has', 'safe', 'suitable', 'high', 'low', 'level', 'sugar',
    'salt', 'sodium', 'caffeine', 'barcode', 'scan', 'much', 'many', 'very', 'really', 'lot',
    'bu', 'şu', 'su', 'mi', 'mı', 'mu', 'mü', 'var', 'içinde', 'nedir', 'içerik', 'icerik', 'uygun',
    'en', 'ucuz', 'fiyat', 'barkod', 'içindekiler', 'içindeki',
]);

/** Extra terms common in price/location prompts but not product names. */
const PRICE_LOCATION_PROMPT_STOPWORDS = new Set([
    'supermarket', 'supermarkets', 'store', 'stores', 'market', 'markets', 'branch', 'branches',
    'closest', 'nearest', 'nearby', 'near', 'location', 'available', 'named', 'which', 'use', 'did', 'not',
    'name', 'ask', 'one', 'your', 'when', 'from', 'them', 'across', 'rank', 'ranked', 'first',
    'option', 'options', 'deals', 'deal', 'best', 'lowest', 'highest', 'premium',
    'yakın', 'yakin', 'yakınımdaki', 'yakinimdaki', 'magaza', 'mağaza', 'sube', 'şube', 'konum',
    'kullan', 'urun', 'ürün', 'hangi', 'adını', 'adini', 'yazmadıysam', 'yazmadim', 'yazmadım',
    'didnt', "didn't", 'write', 'wrote', 'without', 'specify', 'specific',
]);

/** @type {Record<string, string[]>} */
export const PRODUCT_NAME_ALIASES = {
    coke: ['coca cola', 'cocacola', 'coca-cola'],
    'coca cola': ['cocacola', 'coca-cola'],
    'coco cola': ['cocacola', 'coca cola', 'coca-cola'],
    'coca-cola': ['cocacola', 'coca cola'],
    cola: ['coca cola', 'cocacola'],
    cocacola: ['coca cola', 'coca-cola', 'coke'],
};

export const FUZZY_MATCH_MIN_SCORE = 0.82;
export const FUZZY_MATCH_MIN_NAME_LENGTH = 4;

export const normalizeProductKey = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9ğüşöçı]/gi, '');

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const levenshteinDistance = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
    for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[a.length][b.length];
};

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1 similarity ratio
 */
export const productNameSimilarity = (a, b) => {
    const left = normalizeProductKey(a);
    const right = normalizeProductKey(b);
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.includes(right) || right.includes(left)) {
        const shorter = Math.min(left.length, right.length);
        const longer = Math.max(left.length, right.length);
        return shorter / longer;
    }
    const dist = levenshteinDistance(left, right);
    const maxLen = Math.max(left.length, right.length);
    return maxLen === 0 ? 0 : 1 - dist / maxLen;
};

/**
 * @param {string} message
 * @returns {{ words: string[], joined: string, aliasKeys: string[] }}
 */
export const tokenizeProductQuery = (message) => {
    const lowered = String(message || '')
        .toLowerCase()
        .replace(/\b\d{8,14}\b/g, ' ');

    const words = lowered
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && !QUERY_STOPWORDS.has(w));

    const joined = normalizeProductKey(words.join(' '));
    const aliasKeys = new Set();

    const phrase = words.join(' ').trim();
    if (phrase && PRODUCT_NAME_ALIASES[phrase]) {
        aliasKeys.add(phrase);
    }
    if (joined && PRODUCT_NAME_ALIASES[joined]) {
        aliasKeys.add(joined);
    }
    for (const w of words) {
        if (PRODUCT_NAME_ALIASES[w]) aliasKeys.add(w);
    }

    return {
        words: [...new Set(words)],
        joined,
        aliasKeys: [...aliasKeys],
    };
};

const getProductDisplayName = (product) =>
    product?.name || product?.productName || product?.product_name || '';

/**
 * @param {string} query
 * @param {string} productName
 * @returns {number} 0–1
 */
export const scoreProductNameMatch = (query, productName) => {
    const rawName = String(productName || '').trim();
    if (!rawName) return 0;

    const loweredQuery = String(query || '').toLowerCase();
    const loweredName = rawName.toLowerCase();

    if (loweredQuery.includes(loweredName)) {
        return Math.min(1, loweredName.length / Math.max(loweredQuery.length, 1));
    }

    const { words, joined, aliasKeys } = tokenizeProductQuery(query);
    const nName = normalizeProductKey(rawName);

    if (nName.length >= FUZZY_MATCH_MIN_NAME_LENGTH && joined.length >= FUZZY_MATCH_MIN_NAME_LENGTH) {
        if (joined.includes(nName) || nName.includes(joined)) {
            return Math.max(joined.length, nName.length) / Math.max(joined.length, nName.length, 1);
        }
    }

    let best = productNameSimilarity(joined, nName);

    for (const word of words) {
        if (word.length < 3) continue;
        best = Math.max(best, productNameSimilarity(word, nName));
        if (loweredName.includes(word)) {
            best = Math.max(best, word.length / Math.max(nName.length, 1));
        }
    }

    for (const aliasKey of aliasKeys) {
        const targets = PRODUCT_NAME_ALIASES[aliasKey] || [];
        for (const target of targets) {
            const nTarget = normalizeProductKey(target);
            if (nName.includes(nTarget) || nTarget.includes(nName)) {
                best = Math.max(best, 0.95);
            }
            best = Math.max(best, productNameSimilarity(nTarget, nName));
        }
    }

    if (/\bcoke\b/i.test(loweredQuery) && nName.includes('coca') && nName.includes('cola')) {
        best = Math.max(best, 0.95);
    }

    return best;
};

/**
 * @param {string} query
 * @param {object[]} products
 * @param {{ minScore?: number, minNameLength?: number }} [options]
 * @returns {{ product: object, score: number, matchedName: string } | null}
 */
export const findBestProductMatch = (query, products, options = {}) => {
    const minScore = options.minScore ?? FUZZY_MATCH_MIN_SCORE;
    const minNameLength = options.minNameLength ?? FUZZY_MATCH_MIN_NAME_LENGTH;
    const list = Array.isArray(products) ? products : [];

    let best = null;
    let bestScore = 0;
    let bestNameLen = 0;

    for (const product of list) {
        const matchedName = getProductDisplayName(product);
        const nName = normalizeProductKey(matchedName);
        if (nName.length < minNameLength) continue;

        const score = scoreProductNameMatch(query, matchedName);
        if (score < minScore) continue;

        if (score > bestScore || (score === bestScore && nName.length > bestNameLen)) {
            best = product;
            bestScore = score;
            bestNameLen = nName.length;
        }
    }

    if (!best) return null;
    return { product: best, score: bestScore, matchedName: getProductDisplayName(best) };
};

/**
 * Search terms for catalog Query.search (words + joined + alias targets).
 * @param {string} message
 * @returns {string[]}
 */
export const hasBarcodeInMessage = (message) => /\b\d{8,14}\b/.test(String(message || ''));

export const isPriceOrCompareIntent = (message) => {
    const text = String(message || '').toLowerCase();
    return /\b(cheapest|cheap|price|prices|compare|rank|en ucuz|fiyat|near me|closest|nearest|en yakın|en yakin|yakınımdaki|yakinimdaki|lowest|highest|best deal|best price)\b/i.test(
        text
    );
};

/**
 * Product-like tokens left after generic query and price/location stopwords.
 */
export const getExplicitProductTokens = (message) => {
    const { words } = tokenizeProductQuery(message);
    return words.filter((word) => !PRICE_LOCATION_PROMPT_STOPWORDS.has(word) && word.length >= 3);
};

/**
 * True when the user named a specific product (barcode, clear name match), not a generic price/location ask.
 * @param {string} message
 * @param {object[]} [products]
 * @param {{ minScore?: number }} [options]
 */
export const messageExplicitlyNamesProduct = (message, products = [], options = {}) => {
    const text = String(message || '').trim();
    if (!text) return false;
    if (hasBarcodeInMessage(text)) return true;

    const explicitTokens = getExplicitProductTokens(text);
    if (explicitTokens.length === 0) return false;

    const list = Array.isArray(products) ? products : [];
    for (const product of list) {
        const productKey = normalizeProductKey(getProductDisplayName(product));
        if (!productKey) continue;
        const tokenHit = explicitTokens.some((token) => {
            const normalized = normalizeProductKey(token);
            return normalized.length >= 3 && productKey.includes(normalized);
        });
        if (tokenHit) return true;
    }

    const match = findBestProductMatch(text, products, options);
    if (!match?.product) return false;

    const productKey = normalizeProductKey(match.matchedName);
    const hasTokenInName = explicitTokens.some((token) => {
        const normalized = normalizeProductKey(token);
        return normalized.length >= 3 && (productKey.includes(normalized) || normalized.includes(productKey));
    });
    if (hasTokenInName) return true;

    return match.score >= 0.92;
};

export const buildCatalogSearchTerms = (message) => {
    const { words, joined, aliasKeys } = tokenizeProductQuery(message);
    const terms = new Set(words);

    if (joined.length >= FUZZY_MATCH_MIN_NAME_LENGTH) {
        terms.add(joined);
    }

    for (const key of aliasKeys) {
        terms.add(key);
        for (const target of PRODUCT_NAME_ALIASES[key] || []) {
            terms.add(target);
            const n = normalizeProductKey(target);
            if (n.length >= FUZZY_MATCH_MIN_NAME_LENGTH) terms.add(n);
        }
    }

    return [...terms].sort((a, b) => b.length - a.length);
};
