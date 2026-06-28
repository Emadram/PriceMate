export const AI_CHECK_RESPONSE_PREFIX = 'PRICEMATE_AI_CHECK::';

export const NO_KNOWN_ALLERGIES_MARKER = 'no_known_allergies';
export const AI_PROFILE_VERSION = 1;

export const AI_PROFILE_DEFAULTS = {
    version: AI_PROFILE_VERSION,
    updatedAt: '',
    dietaryPreferences: [],
    nutritionPriorities: [],
    avoidIngredients: [],
    budgetPreference: 'balanced',
    preferredStores: [],
    preferredBrands: [],
    dislikedBrands: [],
    responseStyle: 'balanced',
};

const DIETARY_VALUES = new Set(['vegetarian', 'vegan', 'halal', 'kosher']);
const NUTRITION_VALUES = new Set(['low sugar', 'low sodium', 'low caffeine', 'high protein']);
const BUDGET_VALUES = new Set(['lowest_price', 'balanced', 'quality_first']);
const RESPONSE_STYLE_VALUES = new Set(['concise', 'balanced', 'detailed']);

const NO_ALLERGY_VALUES = new Set([
    'none',
    'no allergy',
    'no allergies',
    'no known allergy',
    'no known allergies',
    NO_KNOWN_ALLERGIES_MARKER,
    'bilinen alerjim yok',
]);

const ALLERGEN_GROUPS = [
    { label: 'milk', terms: ['milk', 'dairy', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'lactose', 'süt', 'sut', 'laktoz', 'peynir', 'yoğurt', 'tereyağ', 'tereyag', 'krema', 'kazein'] },
    { label: 'lactose', terms: ['lactose', 'laktoz', 'milk', 'dairy', 'whey', 'casein', 'süt', 'sut'] },
    { label: 'peanut', terms: ['peanut', 'peanuts', 'yer fıstığı', 'yer fistigi', 'fıstık', 'fistik'] },
    { label: 'tree nuts', terms: ['almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'pecan', 'nuts', 'badem', 'ceviz', 'fındık', 'findik', 'kaju'] },
    { label: 'egg', terms: ['egg', 'eggs', 'yumurta'] },
    { label: 'soy', terms: ['soy', 'soya'] },
    { label: 'gluten', terms: ['gluten', 'wheat', 'barley', 'rye', 'malt', 'bugday', 'arpa', 'cavdar'] },
    { label: 'fish', terms: ['fish', 'balik'] },
    { label: 'shellfish', terms: ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'karides'] },
    { label: 'sesame', terms: ['sesame', 'susam'] },
];

const ALLERGEN_BY_LABEL = new Map(ALLERGEN_GROUPS.map((group) => [group.label, group]));

export const serializeAiCheckResponse = (payload) =>
    `${AI_CHECK_RESPONSE_PREFIX}${JSON.stringify(payload || {})}`;

export const parseAiCheckResponse = (value) => {
    const text = String(value || '');
    if (!text.startsWith(AI_CHECK_RESPONSE_PREFIX)) return null;
    try {
        const parsed = JSON.parse(text.slice(AI_CHECK_RESPONSE_PREFIX.length));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

export const classifyAiCheckIntent = (query) => {
    const text = String(query || '').toLowerCase();
    const has = (items) => items.some((item) => text.includes(item));
    if (has([
        'ingredient', 'ingredients', 'allergen', 'allergens', 'contains', 'safe', 'suitable',
        'good for me', 'better for me', 'nutrition', 'sugar', 'sodium', 'salt', 'caffeine', 'gluten', 'lactose',
        'icerik', 'icindekiler', 'alerji', 'alerjen', 'uygun', 'guvenli'
    ])) {
        return 'ingredient_safety';
    }
    if (has(['price', 'cheapest', 'cheap', 'expensive', 'cost', 'deal', 'fiyat', 'ucuz', 'pahali'])) {
        return 'price_check';
    }
    return 'generic';
};

export const normalizeAllergyPreference = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/_/g, ' ');
    if (!normalized || NO_ALLERGY_VALUES.has(normalized)) return '';
    if (ALLERGEN_BY_LABEL.has(normalized)) return normalized;
    if (normalized === 'dairy') return 'milk';
    if (normalized === 'nut' || normalized === 'nuts') return 'tree nuts';
    for (const group of ALLERGEN_GROUPS) {
        if (group.terms.includes(normalized)) return group.label;
    }
    return normalized;
};

export const normalizeAllergyProfile = (value = []) => {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(/[,\n|]+/);

    return Array.from(
        new Set(
            raw
                .map((item) => normalizeAllergyPreference(item))
                .filter(Boolean)
        )
    );
};

const normalizeLooseList = (value = []) => {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(/[,\n|]+/);

    return Array.from(
        new Set(
            raw
                .map((item) => String(item || '').trim().toLowerCase())
                .filter(Boolean)
        )
    );
};

const normalizeAllowedList = (value, allowedValues) =>
    normalizeLooseList(value).filter((item) => allowedValues.has(item));

const normalizeFreeTextList = (value) =>
    normalizeLooseList(value)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter((item) => item.length >= 2)
        .slice(0, 12);

const normalizeChoice = (value, allowedValues, fallback) => {
    const normalized = String(value || '').trim().toLowerCase();
    return allowedValues.has(normalized) ? normalized : fallback;
};

export const normalizeAiProfile = (profile = {}) => {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
        ...AI_PROFILE_DEFAULTS,
        version: AI_PROFILE_VERSION,
        updatedAt: source.updatedAt || '',
        dietaryPreferences: normalizeAllowedList(source.dietaryPreferences, DIETARY_VALUES),
        nutritionPriorities: normalizeAllowedList(source.nutritionPriorities, NUTRITION_VALUES),
        avoidIngredients: normalizeFreeTextList(source.avoidIngredients),
        budgetPreference: normalizeChoice(source.budgetPreference, BUDGET_VALUES, AI_PROFILE_DEFAULTS.budgetPreference),
        preferredStores: normalizeFreeTextList(source.preferredStores),
        preferredBrands: normalizeFreeTextList(source.preferredBrands),
        dislikedBrands: normalizeFreeTextList(source.dislikedBrands),
        responseStyle: normalizeChoice(source.responseStyle, RESPONSE_STYLE_VALUES, AI_PROFILE_DEFAULTS.responseStyle),
    };
};

export const buildStoredAiProfilePrefs = (profile = {}) => ({
    aiProfile: {
        ...normalizeAiProfile(profile),
        updatedAt: new Date().toISOString(),
    },
});

export const readStoredAiProfile = (prefs = {}) => {
    const source = prefs && typeof prefs === 'object' ? prefs : {};
    const profile = normalizeAiProfile(source.aiProfile || {});
    const hasSignal = [
        profile.dietaryPreferences,
        profile.nutritionPriorities,
        profile.avoidIngredients,
        profile.preferredStores,
        profile.preferredBrands,
        profile.dislikedBrands,
    ].some((items) => items.length > 0) ||
        profile.budgetPreference !== AI_PROFILE_DEFAULTS.budgetPreference ||
        profile.responseStyle !== AI_PROFILE_DEFAULTS.responseStyle;

    return {
        profile,
        hasSignal,
        updatedAt: profile.updatedAt || '',
    };
};

export const buildAiProfileCacheKey = (profile = {}) => {
    const normalized = normalizeAiProfile(profile);
    return [
        normalized.dietaryPreferences.join(',') || 'diet:none',
        normalized.nutritionPriorities.join(',') || 'nutrition:none',
        normalized.avoidIngredients.join(',') || 'avoid:none',
        normalized.budgetPreference,
        normalized.preferredStores.join(',') || 'stores:none',
        normalized.preferredBrands.join(',') || 'brands:none',
        normalized.dislikedBrands.join(',') || 'disliked:none',
        normalized.responseStyle,
    ].join('|');
};

export const buildStoredAllergyPrefs = (allergies = []) => ({
    aiAllergies: normalizeAllergyProfile(allergies),
    aiAllergyProfileSet: true,
    aiAllergyProfileUpdatedAt: new Date().toISOString(),
});

export const readStoredAllergyProfile = (prefs = {}) => {
    const source = prefs && typeof prefs === 'object' ? prefs : {};
    const allergies = normalizeAllergyProfile(source.aiAllergies || []);
    return {
        allergies,
        hasKnownAllergies: allergies.length > 0,
        isSet: source.aiAllergyProfileSet === true || Array.isArray(source.aiAllergies),
        updatedAt: source.aiAllergyProfileUpdatedAt || '',
    };
};

export const getAllergenTermsForLabels = (labels = []) =>
    Array.from(new Set(labels.flatMap((label) => {
        const normalized = normalizeAllergyPreference(label);
        if (['diabetes', 'hypertension', 'pregnancy', 'kidney', 'gout', 'hypercholesterolemia', 'gerd', 'ibs', 'pku', 'hemochromatosis', 'thyroid'].includes(normalized)) return '';
        if (normalized === 'celiac' || normalized === 'gluten') {
            const group = ALLERGEN_BY_LABEL.get('gluten');
            return group ? group.terms : ['gluten'];
        }
        if (normalized === 'allergy') {
            return ALLERGEN_GROUPS.flatMap((g) => g.terms);
        }
        const group = ALLERGEN_BY_LABEL.get(normalized);
        return group ? group.terms : [normalized];
    }).filter(Boolean)));

export const buildAiCheckFingerprint = (result) => {
    if (!result) return 'none';
    const product = result.product || {};
    return [
        result.mode || 'unknown',
        product.barcode || product.id || product.name || 'product',
        result.status || 'status',
        result.asOf || 'no-date',
        result.stale ? 'stale' : 'fresh',
    ].join(':');
};
