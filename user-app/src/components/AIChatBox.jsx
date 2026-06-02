const PROMPT_STOPWORDS = new Set([
    'is', 'this', 'that', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'with', 'to', 'and', 'or', 'but',
    'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how', 'do', 'does', 'did', 'are', 'isnt',
    'can', 'could', 'would', 'should', 'please', 'tell', 'me', 'about', 'show', 'find', 'compare',
    'check', 'look', 'up', 'give', 'need', 'want', 'know', 'question', 'answer', 'again', 'same',
]);

const tokenizePromptIntent = (value) => {
    const text = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s]/g, ' ');

    return text
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !PROMPT_STOPWORDS.has(token))
        .filter((token, index, array) => array.indexOf(token) === index)
        .slice(0, 16);
};

const buildIntentSummary = (value) => {
    const tokens = tokenizePromptIntent(value);
    if (tokens.length === 0) return String(value || '').trim();
    return tokens.join(' ');
};

const NO_ALLERGY_PREFERENCE_VALUES = new Set([
    'none',
    'no allergy',
    'no allergies',
    'no known allergy',
    'no known allergies',
    'no_known_allergies',
    'bilinen alerjim yok',
]);
const ALLERGY_KEYWORDS = ['allergy', 'allergic', 'alerji', 'alerjik', 'intolerant', 'intolerance', 'cannot eat', "can't eat", 'cant eat', 'avoid'];
const ALLERGEN_GROUPS = [
    { label: 'peanut', terms: ['peanut', 'peanuts', 'yer fıstığı', 'yer fistik', 'fıstık', 'fistik'] },
    { label: 'tree nuts', terms: ['almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'pecan', 'badem', 'ceviz', 'fındık', 'findik', 'kaju', 'antep fıstığı'] },
    { label: 'milk', terms: ['milk', 'dairy', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'süt', 'sut', 'peynir', 'yoğurt', 'yogurt', 'tereyağ', 'tereyag', 'krema', 'kazein'] },
    { label: 'lactose', terms: ['lactose', 'laktoz', 'milk', 'dairy', 'whey', 'casein', 'süt', 'sut'] },
    { label: 'egg', terms: ['egg', 'eggs', 'yumurta'] },
    { label: 'soy', terms: ['soy', 'soya'] },
    { label: 'gluten', terms: ['gluten', 'wheat', 'buğday', 'bugday', 'barley', 'arpa', 'rye', 'çavdar', 'cavdar', 'malt'] },
    { label: 'fish', terms: ['fish', 'balık', 'balik'] },
    { label: 'shellfish', terms: ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'karides', 'yengeç', 'yengec', 'ıstakoz', 'istakoz'] },
    { label: 'sesame', terms: ['sesame', 'susam'] },
    { label: 'mustard', terms: ['mustard', 'hardal'] },
    { label: 'celery', terms: ['celery', 'kereviz'] },
    { label: 'lupin', terms: ['lupin', 'acı bakla', 'aci bakla'] },
    { label: 'sulfites', terms: ['sulfite', 'sulphite', 'sülfit', 'sulfit'] }
];
const ALLERGEN_GROUP_BY_LABEL = new Map(
    ALLERGEN_GROUPS.map((group) => [group.label, group])
);

const normalizeAllergyLabel = (value) => String(value || '').trim().toLowerCase().replace(/_/g, ' ');

const resolveAllergyPreferenceLabel = (value) => {
    const normalized = normalizeAllergyLabel(value);
    if (!normalized || NO_ALLERGY_PREFERENCE_VALUES.has(normalized)) return '';
    if (ALLERGEN_GROUP_BY_LABEL.has(normalized)) return normalized;
    if (normalized === 'nuts' || normalized === 'nut') return 'tree nuts';
    if (normalized === 'dairy') return 'milk';
    return normalized;
};

const getAllergenTermsForLabels = (labels = []) => {
    const terms = labels.flatMap((label) => {
        const resolved = resolveAllergyPreferenceLabel(label);
        const group = ALLERGEN_GROUP_BY_LABEL.get(resolved);
        return group?.terms || [resolved];
    });
    return Array.from(new Set(terms.filter(Boolean)));
};
// Simple in-memory intent cache with optional persistence to avoid repeating identical assistant calls
const DEFAULT_INTENT_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const INTENT_CACHE_FORMAT_VERSION = 'v5';
const INTENT_CACHE_STORAGE_KEY = `pricemate_intent_cache_${INTENT_CACHE_FORMAT_VERSION}`;
const INTENT_CACHE_TTL_SETTING_KEY = 'pricemate_intent_cache_ttl_ms';

const intentCache = new Map();

const makeIntentKey = (intentSummary, barcode, userKey = 'guest', allergyKey = 'none') =>
    `${INTENT_CACHE_FORMAT_VERSION}::USER:${String(userKey || 'guest').trim()}::ALLERGY:${String(allergyKey || 'none').trim()}::${String(intentSummary || '').trim()}::BARCODE:${String(barcode || '').trim()}`;

const sanitizeAssistantReply = (value) => {
    const text = String(value || '').replace(/\r\n/g, '\n').trim();
    if (!text) return '';

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const kept = [];
    let sourceAdded = false;

    for (const line of lines) {
        if (/^note\s*:/i.test(line)) {
            continue;
        }

        if (/^source\s*:/i.test(line)) {
            if (!sourceAdded) {
                kept.push('Source: PriceMate');
                sourceAdded = true;
            }
            continue;
        }

        kept.push(line);
    }

    // Keep source explicit and single-line for ingredient-style responses.
    const looksLikeIngredientCheck = /ingredients?\s*:|allergens?\s*:|suitability\s*:|checks?(?:\s*for)?\s*:/i.test(text);
    if (looksLikeIngredientCheck && !sourceAdded) {
        kept.push('Source: PriceMate');
    }

    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const truncateText = (value, max = 140) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max).trim()}...`;
};

const emphasizeImportantIngredients = (value) => {
    const text = String(value || '');
    if (!text) return '';

    const importantTerms = [
        'sugar', 'glucose', 'fructose', 'syrup', 'corn syrup', 'honey', 'dextrose', 'sucrose',
        'salt', 'sodium', 'msg', 'monosodium',
        'caffeine', 'alcohol',
        'gluten', 'wheat', 'barley', 'rye', 'malt',
        'milk', 'dairy', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt',
        'peanut', 'nuts', 'soy', 'egg', 'fish', 'shellfish', 'sesame',
        'şeker', 'seker', 'glikoz', 'fruktoz', 'şurup', 'surup', 'bal',
        'tuz', 'sodyum', 'kafein',
        'buğday', 'bugday', 'arpa', 'çavdar', 'cavdar',
        'süt', 'sut', 'laktoz', 'peynir', 'yoğurt', 'yogurt'
    ];

    const escaped = importantTerms
        .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .sort((a, b) => b.length - a.length);

    if (escaped.length === 0) return text;

    const rx = new RegExp(`\\b(${escaped.join('|')})\\b`, 'giu');
    return text.replace(rx, '**$1**');
};

const renderInlineBoldText = (value, keyPrefix = 'txt') => {
    const parts = String(value || '').split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
            return (
                <strong key={`${keyPrefix}-b-${index}`} className="font-black text-gray-900 dark:text-white">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <span key={`${keyPrefix}-t-${index}`}>{part}</span>;
    });
};

const parseIngredientCardData = (value) => {
    const text = String(value || '').replace(/\r\n/g, '\n').trim();
    if (!text) return null;

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const data = {
        product: '',
        suitability: '',
        checks: '',
        triggers: '',
        reasons: [],
        ingredients: '',
        allergens: '',
        source: '',
        tip: '',
    };

    let collectingReasons = false;

    for (const line of lines) {
        if (/^product\s*:/i.test(line)) {
            data.product = line.replace(/^product\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^suitability\s*:/i.test(line)) {
            data.suitability = line.replace(/^suitability\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^checks?(?:\s*for)?\s*:/i.test(line)) {
            data.checks = line.replace(/^checks?(?:\s*for)?\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^triggers?\s*:/i.test(line)) {
            data.triggers = line.replace(/^triggers?\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^reasons?\s*:/i.test(line)) {
            collectingReasons = true;
            const inlineReason = line.replace(/^reasons?\s*:/i, '').trim();
            if (inlineReason) data.reasons.push(inlineReason);
            continue;
        }
        if (/^ingredients?\s*:/i.test(line)) {
            data.ingredients = line.replace(/^ingredients?\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^allergens?\s*:/i.test(line)) {
            data.allergens = line.replace(/^allergens?\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^source\s*:/i.test(line)) {
            data.source = line.replace(/^source\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }
        if (/^tip\s*:/i.test(line)) {
            data.tip = line.replace(/^tip\s*:/i, '').trim();
            collectingReasons = false;
            continue;
        }

        if (collectingReasons) {
            const cleaned = line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim();
            if (cleaned) data.reasons.push(cleaned);
        }
    }

    const looksStructured = !!data.suitability && (!!data.ingredients || data.reasons.length > 0);
    if (!looksStructured) return null;
    if (!data.source) data.source = 'PriceMate';
    return data;
};

const hasFunctionalLocalStorage = () =>
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.getItem === 'function' &&
    typeof window.localStorage.setItem === 'function';

const readConfiguredTtl = () => {
    try {
        if (!hasFunctionalLocalStorage()) return DEFAULT_INTENT_CACHE_TTL_MS;
        const raw = localStorage.getItem(INTENT_CACHE_TTL_SETTING_KEY);
        if (!raw) return DEFAULT_INTENT_CACHE_TTL_MS;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INTENT_CACHE_TTL_MS;
        return parsed;
    } catch {
        return DEFAULT_INTENT_CACHE_TTL_MS;
    }
};

const persistCacheToStorage = () => {
    try {
        if (!hasFunctionalLocalStorage()) return;
        const obj = {};
        for (const [k, v] of intentCache.entries()) {
            obj[k] = v; // { value, expiresAt }
        }
        localStorage.setItem(INTENT_CACHE_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        // best-effort; don't block
        console.debug('Failed to persist intent cache', e);
    }
};

const hydrateCacheFromStorage = () => {
    try {
        if (!hasFunctionalLocalStorage()) return;
        const raw = localStorage.getItem(INTENT_CACHE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const k of Object.keys(parsed)) {
            const rec = parsed[k];
            if (!rec || !rec.expiresAt) continue;
            if (now > rec.expiresAt) continue;
            intentCache.set(k, rec);
        }
    } catch (e) {
        console.debug('Failed to hydrate intent cache', e);
    }
};

// Initialize cache from storage on module load
if (hasFunctionalLocalStorage()) {
    hydrateCacheFromStorage();
}

const getCachedIntent = (key) => {
    const rec = intentCache.get(key);
    if (!rec) return null;
    if (Date.now() > rec.expiresAt) {
        intentCache.delete(key);
        persistCacheToStorage();
        return null;
    }
    return rec.value;
};

const setCachedIntent = (key, value, ttl) => {
    try {
        const effectiveTtl = Number.isFinite(Number(ttl)) ? Number(ttl) : readConfiguredTtl();
        const rec = { value, expiresAt: Date.now() + effectiveTtl };
        intentCache.set(key, rec);
        persistCacheToStorage();
    } catch (e) {
        console.debug('Intent cache set failed', e);
    }
};

import { useState, useEffect, useRef } from 'react';
import { FiX, FiSend, FiList, FiLoader, FiExternalLink, FiPackage, FiShoppingBag, FiPlus, FiTrash2, FiChevronLeft, FiCpu, FiMapPin, FiCheckCircle, FiSearch, FiCamera, FiClipboard } from 'react-icons/fi';
import OpenAI from "openai";
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    fetchProducts,
    fetchPricesForProducts,
    fetchIngredientsByBarcode,
    searchIngredientsByName,
    resolveCatalogProductForIngredients,
    ingredientPayloadFromAppwriteProduct,
    persistIngredientPayloadToCatalogProduct,
    normalizeProduct,
    resolveOffCacheProductForIngredients,
    ingredientPayloadFromOffCache,
    buildSupermarketContextLines,
    enrichProductPricesWithSupermarkets,
    isUserLocationAvailableForStores,
    resolvePriceSupermarketMeta,
} from '../utils/productUtils';
import {
    findBestProductMatch,
    scoreProductNameMatch,
    FUZZY_MATCH_MIN_SCORE,
} from '../utils/productNameMatch';
import useUserLocation from '../hooks/useUserLocation';
import useComposerKeyboardLift from '../hooks/useComposerKeyboardLift';
import { prefersKeyboardResizeViewport, usesAiChatFixedMobileChrome } from '../utils/platform';
import {
    polishMessageSegments,
    scrubPunctuationAfterProductTags,
    tokenizeMessageContent,
} from '../utils/chatMessageContent';
import useSupermarketsStore from '../stores/supermarketsStore';
import {
    buildAiProfileCacheKey,
    buildAiCheckFingerprint,
    parseAiCheckResponse,
    readStoredAiProfile,
    readStoredAllergyProfile,
    serializeAiCheckResponse,
} from '../utils/aiCheckUtils';
import { functions as appwriteFunctions } from '../lib/appwrite';
import { createFunctionExecutionJson } from '../utils/appwriteFunctionExecution';
import useCurrencyStore from '../stores/currencyStore';
import useAuthStore from '../stores/authStore';
import useChatStore, { CHAT_ERROR_MISSING_CONVERSATION_ID } from '../stores/chatStore';
import AppLogo from './AppLogo';
import { lockDocumentScroll, releaseDocumentScrollLock } from '../utils/documentScrollLock';

const ChatScreenHeader = ({
    variant,
    title,
    subtitle,
    poweredByLabel,
    user,
    onOpenList,
    onNewChat,
    onClose,
    showDragHandle,
    headerRef,
    t,
}) => {
    const isPage = variant === 'page';
    const iosFixedChrome = isPage && usesAiChatFixedMobileChrome();

    return (
        <>
            {showDragHandle ? (
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>
            ) : null}
            <header
                ref={headerRef}
                className={`pricemate-mobile-chrome shrink-0 border-b border-gray-100 dark:border-gray-700/50 px-3.5 pb-3 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:px-5 sm:py-4 sm:pt-[calc(0.65rem+env(safe-area-inset-top,0px))] ${
                    iosFixedChrome
                        ? 'max-md:fixed max-md:inset-x-0 max-md:top-[var(--app-vv-top,0px)] max-md:z-[10001] max-md:bg-white max-md:dark:bg-gray-900'
                        : isPage
                          ? 'z-10 max-md:sticky max-md:top-0 max-md:z-20'
                          : 'z-10'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {user ? (
                        <button
                            type="button"
                            className="tap-target inline-flex h-10 w-10 items-center justify-center rounded-2xl text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 shrink-0 active:scale-95 sm:hidden"
                            onClick={onOpenList}
                            aria-label={t('ai_chat_chats')}
                        >
                            <FiList size={20} />
                        </button>
                    ) : (
                        <span className="w-10 shrink-0 sm:hidden" aria-hidden />
                    )}
                    <AppLogo variant="ai" size="xs" alt="" shellClassName="shadow-none" />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 min-w-0 leading-none">
                            <h1 className="font-black text-sm sm:text-[15px] truncate normal-case tracking-tight text-brand-700 dark:text-brand-400">
                                {title}
                            </h1>
                            {poweredByLabel ? (
                                <span className="hidden sm:inline-flex text-[9px] uppercase tracking-[0.22em] font-black bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full shrink-0">
                                    {poweredByLabel}
                                </span>
                            ) : null}
                        </div>
                        {subtitle ? (
                            <p className="mt-0.5 text-[10px] sm:text-[11px] text-brand-600/80 dark:text-brand-300/90 leading-snug truncate sm:line-clamp-2 sm:whitespace-normal">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {user ? (
                            <button
                                type="button"
                                onClick={onNewChat}
                                className={`tap-target min-h-10 min-w-10 p-2.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 rounded-2xl transition-all active:scale-95 ${isPage ? 'hidden sm:inline-flex' : 'inline-flex'} items-center justify-center`}
                                aria-label={t('ai_chat_new')}
                            >
                                <FiPlus size={20} />
                            </button>
                        ) : null}
                        {!isPage && onClose ? (
                            <button
                                type="button"
                                onClick={onClose}
                                className="tap-target min-h-10 min-w-10 p-2.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 rounded-2xl transition-all active:scale-95"
                                aria-label={t('ai_chat_close')}
                            >
                                <FiX size={22} />
                            </button>
                        ) : null}
                    </div>
                </div>
            </header>
        </>
    );
};

const AI_CHECK_FUNCTION_ID = import.meta.env.VITE_APPWRITE_FUNCTION_AI_CHECK || '';
const AI_CHECK_MODE = import.meta.env.VITE_AI_CHECK_MODE || 'legacy';

const runAiCheckFunction = async (payload) => {
    if (AI_CHECK_MODE !== 'hybrid' || !AI_CHECK_FUNCTION_ID) return null;
    try {
        const parsed = await createFunctionExecutionJson(
            appwriteFunctions,
            AI_CHECK_FUNCTION_ID,
            payload
        );
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.debug('AI check function unavailable, falling back locally:', error?.message || error);
        return null;
    }
};

const AI_DEBUG = import.meta.env.VITE_AI_DEBUG === 'true';

const extractOpenRouterError = (error) => {
    const status =
        error?.status ||
        error?.response?.status ||
        error?.cause?.status ||
        null;

    const message =
        error?.error?.message ||
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        String(error || '');

    const code =
        error?.error?.code ||
        error?.response?.data?.error?.code ||
        error?.code ||
        null;

    const provider =
        error?.error?.metadata?.provider_name ||
        error?.response?.data?.error?.metadata?.provider_name ||
        null;

    return { status, code, provider, message };
};

const clampText = (value, maxChars) => {
    const text = String(value || '');
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}…`;
};

const buildThreadForApi = (messages = [], { maxMessages = 18, maxCharsPerMessage = 1200 } = {}) => {
    const normalized = (Array.isArray(messages) ? messages : [])
        .filter(Boolean)
        .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: clampText(m.content, maxCharsPerMessage),
        }));

    if (normalized.length <= maxMessages) return normalized;
    return normalized.slice(normalized.length - maxMessages);
};

const profileHasPersonalization = (profile = {}) =>
    [
        profile.dietaryPreferences,
        profile.nutritionPriorities,
        profile.avoidIngredients,
        profile.preferredStores,
        profile.preferredBrands,
        profile.dislikedBrands,
    ].some((items) => Array.isArray(items) && items.length > 0) ||
    profile.budgetPreference !== 'balanced' ||
    profile.responseStyle !== 'balanced';

const formatAiProfileForPrompt = (profile = {}) => {
    if (!profileHasPersonalization(profile)) {
        return 'No optional AI shopping profile preferences saved.';
    }

    return [
        `Dietary preferences: ${profile.dietaryPreferences?.join(', ') || 'none'}`,
        `Nutrition priorities: ${profile.nutritionPriorities?.join(', ') || 'none'}`,
        `Avoid ingredients: ${profile.avoidIngredients?.join(', ') || 'none'}`,
        `Budget preference: ${profile.budgetPreference || 'balanced'}`,
        `Preferred stores: ${profile.preferredStores?.join(', ') || 'none'}`,
        `Preferred brands: ${profile.preferredBrands?.join(', ') || 'none'}`,
        `Disliked brands: ${profile.dislikedBrands?.join(', ') || 'none'}`,
        `Response style: ${profile.responseStyle || 'balanced'}`,
    ].join('\n');
};

const ChatProductThumb = ({ src, alt, className = 'w-full h-full' }) => {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return <FiPackage className="text-gray-400 text-lg shrink-0" aria-hidden />;
    }
    return (
        <img
            src={src}
            alt={alt || ''}
            className={`${className} object-contain max-w-full max-h-full`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
        />
    );
};

const ChatMessage = ({ msg, convert, getCurrencySymbol, allProducts = [], allSupermarkets = [], t }) => {
    const extractBarcodeFromText = (value) => {
        const match = String(value || '').match(/\[BARCODE:([\w\d-]+)\]/i);
        return match ? match[1] : '';
    };

    const storeLabelFromPrice = (price) => {
        if (!price) return t('store', 'Store');
        if (price.supermarketLabel) return price.supermarketLabel;
        const meta = resolvePriceSupermarketMeta(price, allSupermarkets);
        return meta.label || t('store', 'Store');
    };

    const renderStoreBadge = (price) => (
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 min-w-0">
            <FiShoppingBag className="shrink-0" size={10} />
            <span className="truncate max-w-[120px] sm:max-w-[140px]">{storeLabelFromPrice(price)}</span>
        </div>
    );

    const renderBarcodeProductCard = (barcode, key = 'barcode-card') => {
        const product = allProducts.find((p) => String(p.barcode || '') === String(barcode || ''));
        if (!barcode) return null;

        if (!product) {
            return (
                <Link
                    key={key}
                    to={`/price-comparison/${barcode}`}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5 text-xs font-bold text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800/30"
                >
                    View Product <FiExternalLink size={12} />
                </Link>
            );
        }

        const sortedPrices = [...(product.prices || [])].sort((a, b) => a.price - b.price);
        const best = sortedPrices.length > 0 ? sortedPrices[0] : null;

        return (
            <Link
                key={key}
                to={`/price-comparison/${barcode}`}
                className="mt-2 block rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 overflow-hidden hover:shadow-md transition-all"
            >
                <div className="flex items-center gap-3 p-2.5">
                    <div className="w-12 h-12 max-w-[3rem] bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-900/50 shrink-0">
                        <ChatProductThumb src={product.imageUrl} alt={product.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{product.name || product.productName}</p>
                        {best ? (
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                                <p className="text-xs text-green-700 dark:text-green-300 font-black shrink-0">
                                    {t('best', 'Best')}: {convert(best.price, 'TRY')} {getCurrencySymbol()}
                                </p>
                                {renderStoreBadge(best)}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">{t('no_data_yet')}</p>
                        )}
                    </div>
                </div>
            </Link>
        );
    };

    const renderIngredientCard = (data) => {
        const productBarcode = extractBarcodeFromText(data.product);
        const suitabilityLower = (data.suitability || '').toLowerCase();
        const tone =
            suitabilityLower.includes('not suitable') || suitabilityLower.includes('avoid')
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : suitabilityLower.includes('caution')
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';

        const shouldShowTriggers =
            !!data.triggers &&
            (suitabilityLower.includes('not suitable') ||
                suitabilityLower.includes('avoid') ||
                suitabilityLower.includes('caution'));

        return (
            <div className="my-1.5 rounded-2xl border border-brand-100 dark:border-brand-800/30 bg-gradient-to-br from-white to-brand-50/40 dark:from-gray-800 dark:to-brand-900/10 p-3 sm:p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">{t('ai_ingredient_check', 'Ingredient Check')}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone}`}>
                        {data.suitability || t('ai_status_unknown', 'Unknown')}
                    </span>
                </div>
                {productBarcode ? renderBarcodeProductCard(productBarcode, `ingredient-${productBarcode}`) : null}
                {data.checks && (
                    <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-300">
                        {t('ai_checks', 'Checks')}: {renderInlineBoldText(data.checks, 'ic-checks')}
                    </p>
                )}
                {shouldShowTriggers && (
                    <p className="mt-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-300">
                        {t('ai_triggers', 'Detected')}: {renderInlineBoldText(data.triggers, 'ic-triggers')}
                    </p>
                )}
                {data.reasons.length > 0 && (
                    <div className="mt-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('ai_reasons', 'Reasons')}</p>
                        <ol className="mt-1 space-y-1 text-[13px] text-gray-700 dark:text-gray-200">
                            {data.reasons.map((reason, index) => (
                                <li key={`reason-${index}`} className="leading-5">
                                    <span className="font-black mr-1.5">{index + 1}.</span>
                                    {renderInlineBoldText(reason, `ic-reason-${index}`)}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
                <details className="mt-3 rounded-2xl border border-gray-100 bg-white/70 dark:border-gray-700/70 dark:bg-gray-900/30 px-3 py-2 group">
                    <summary className="cursor-pointer list-none text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        {t('ai_ingredients_allergens', 'Ingredients & allergens')}
                    </summary>
                    <div className="mt-2 space-y-2">
                        <p className="text-[12px] leading-5 text-gray-700 dark:text-gray-200">
                            <span className="font-black text-gray-500 dark:text-gray-400">{t('ai_ingredients', 'Ingredients')}: </span>
                            {renderInlineBoldText(data.ingredients || t('ai_no_ingredients', 'No ingredients listed'), 'ic-ingredients')}
                        </p>
                        <p className="text-[12px] leading-5 text-gray-700 dark:text-gray-200">
                            <span className="font-black text-gray-500 dark:text-gray-400">{t('ai_allergens', 'Allergens')}: </span>
                            {renderInlineBoldText(data.allergens || t('ai_no_allergens', 'No allergens listed'), 'ic-allergens')}
                        </p>
                    </div>
                </details>
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {t('ai_source_pricemate', 'Source: PriceMate')}
                </p>
                {data.tip && (
                    <p className="mt-2 rounded-2xl bg-brand-50 px-3 py-2 text-[11px] font-bold text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
                        {data.tip}
                    </p>
                )}
            </div>
        );
    };

    const statusLabel = (status) => {
        if (status === 'avoid') return t('ai_status_avoid', 'Not suitable');
        if (status === 'caution') return t('ai_status_caution', 'Use caution');
        if (status === 'safe') return t('ai_status_safe', 'Likely suitable');
        if (status === 'ok') return t('available', 'Available');
        return t('ai_status_unknown', 'Unknown');
    };

    const checkLabel = (value) => {
        const labels = {
            high_sugar: t('check_sugar', 'sugar'),
            high_sodium: t('check_sodium', 'sodium'),
            high_caffeine: t('check_caffeine', 'caffeine'),
            allergy: t('condition_allergy', 'allergy'),
            gluten: t('condition_gluten', 'gluten'),
            lactose: t('condition_lactose', 'lactose'),
            pregnancy: t('condition_pregnancy', 'pregnancy'),
            ingredients: t('ai_ingredients', 'ingredients'),
        };
        return labels[value] || String(value || '').replace(/_/g, ' ');
    };

    const renderStructuredIngredientCard = (result) => {
        const product = result.product || {};
        const check = result.ingredientCheck || {};
        const checks = Array.isArray(check.checks) ? check.checks : [];
        const checkNames = check.allergenTargets?.length
            ? checks.filter((item) => item !== 'allergy')
            : checks;
        return renderIngredientCard({
            product: product.barcode
                ? `${product.name || t('unknown_product', 'Unknown Product')} [BARCODE:${product.barcode}]`
                : (product.name || t('unknown_product', 'Unknown Product')),
            suitability: statusLabel(check.status || result.status),
            checks: [
                ...checkNames.map(checkLabel),
                ...(check.allergenTargets?.length ? [`allergy (${check.allergenTargets.join(', ')})`] : []),
            ].join(', '),
            reasons: check.reasons || result.reasons || [],
            ingredients: emphasizeImportantIngredients(truncateText(check.ingredients || t('ai_no_ingredients', 'No ingredients listed'), 180)),
            allergens: emphasizeImportantIngredients(
                Array.isArray(check.allergens) && check.allergens.length > 0
                    ? truncateText(check.allergens.join(', '), 120)
                    : t('ai_no_allergens', 'No allergens listed')
            ),
            source: 'PriceMate',
        });
    };

    const renderStructuredPriceCard = (result) => {
        const product = result.product || {};
        const check = result.priceCheck || {};
        const rows = Array.isArray(check.items) ? check.items : [];
        const headline = check.type === 'highest' ? check.highest : check.best;
        const tone = result.errorCode
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';

        return (
            <div className="my-1.5 rounded-2xl border border-brand-100 dark:border-brand-800/30 bg-gradient-to-br from-white to-brand-50/40 dark:from-gray-800 dark:to-brand-900/10 p-3 sm:p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">{t('ai_price_check', 'Price Check')}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone}`}>
                        {result.stale ? t('cached', 'Cached') : statusLabel(result.status)}
                    </span>
                </div>
                {product.barcode ? renderBarcodeProductCard(product.barcode, `price-${product.barcode}`) : null}
                <div className="mt-3">
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                        {product.name || t('product', 'Product')}
                    </p>
                    {headline ? (
                        <p className="mt-1 text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                            {check.type === 'highest' ? t('highest', 'Highest') : t('best', 'Best')}: <strong>{convert(headline.price, headline.currency || 'TRY')} {getCurrencySymbol()}</strong>
                            <span className="text-gray-400"> {t('at_store', 'at')} {headline.supermarketName || t('store', 'Store')}</span>
                        </p>
                    ) : (
                        <p className="mt-1 text-[13px] font-semibold text-amber-700 dark:text-amber-300">
                            {result.reasons?.[0] || t('price_temporarily_unavailable', 'Price temporarily unavailable.')}
                        </p>
                    )}
                </div>
                {rows.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                        {rows.slice(0, 4).map((item, index) => (
                            <div
                                key={`${item.supermarketId || item.supermarketName || 'store'}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-xl bg-white/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/60 px-3 py-2"
                            >
                                <span className="min-w-0 truncate text-[12px] font-bold text-gray-700 dark:text-gray-200">
                                    {item.supermarketName || t('store', 'Store')}
                                    {item.isPreferredStore ? (
                                        <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                            {t('preferred', 'preferred')}
                                        </span>
                                    ) : null}
                                </span>
                                <span className="shrink-0 text-[13px] font-black text-gray-900 dark:text-white">
                                    {convert(item.price, item.currency || 'TRY')} {getCurrencySymbol()}
                                </span>
                            </div>
                        ))}
                        {product.barcode && rows.length > 4 && (
                            <Link
                                to={`/price-comparison/${product.barcode}`}
                                className="mt-2 inline-flex min-h-10 items-center rounded-full bg-brand-50 px-3 text-[11px] font-black uppercase tracking-widest text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                            >
                                {t('view_all_prices', 'View all prices')}
                            </Link>
                        )}
                    </div>
                )}
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {t('ai_source_pricemate', 'Source: PriceMate')}
                </p>
            </div>
        );
    };

    const renderStructuredAiCheck = (result) => {
        if (result.mode === 'price_check') return renderStructuredPriceCard(result);
        if (result.mode === 'ingredient_safety') return renderStructuredIngredientCard(result);
        return null;
    };

    const renderContent = (content) => {
        const structuredAiCheck = msg.role === 'assistant' ? parseAiCheckResponse(content) : null;
        if (structuredAiCheck) {
            return renderStructuredAiCheck(structuredAiCheck);
        }

        // First step: CLEANING
        // 1. Remove redundancy: remove lines that the cards will handle
        let text = content;
        
        // Remove individual price points followed by TRY/TL/₺
        text = text.replace(/^(?:\s*)(?:[-•*]\s?.*:\s*\d+(?:\.\d+)?\s*(?:TRY|TL|₺)\s*\n?)+/gm, '');
        
        // Remove lead-in sentences for removed lists
        text = text.replace(/(?:The prices are:|Prices are:|Available at:)\s*\n?/gi, '');
        
        // Remove empty lines created by removals
        text = text.replace(/\n\s*\n/g, '\n').trim();
        text = scrubPunctuationAfterProductTags(text);

        const ingredientCardData = msg.role === 'assistant' ? parseIngredientCardData(text) : null;
        if (ingredientCardData) {
            return renderIngredientCard(ingredientCardData);
        }

        const segments = polishMessageSegments(tokenizeMessageContent(text));
        const isMostExpensiveRequest = text.toLowerCase().includes('most expensive') || text.toLowerCase().includes('pahalı');
        const isCheapestRequest = text.toLowerCase().includes('cheapest') || text.toLowerCase().includes('en ucuz');

        return segments.map((segment, i) => {
            if (segment.type === 'text') {
                return <span key={`msg-part-${i}`}>{renderInlineBoldText(segment.value, `plain-${i}`)}</span>;
            }

            if (segment.type === 'store') {
                const storeId = segment.value;
                const store = allSupermarkets.find((s) => s.$id === storeId);
                const storeLabel = store
                    ? [store.name, store.branchName].filter(Boolean).join(' — ')
                    : t('supermarket', 'Supermarket');

                return (
                    <Link
                        key={`store-${i}-${storeId}`}
                        to={`/supermarket/${storeId}`}
                        className="inline-flex items-center gap-1.5 my-1.5 min-h-10 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-[12px] font-black text-brand-700 hover:bg-brand-100 dark:border-brand-800/50 dark:bg-brand-900/25 dark:text-brand-300 dark:hover:bg-brand-900/40"
                    >
                        <FiMapPin size={14} className="shrink-0" />
                        <span className="truncate max-w-[200px]">{storeLabel}</span>
                        <FiExternalLink size={12} className="shrink-0 opacity-70" />
                    </Link>
                );
            }

            const barcode = segment.value;
            const product = allProducts.find(p => p.barcode === barcode);

            if (product) {
                    const sortedPrices = [...(product.prices || [])].sort((a, b) => a.price - b.price);
                    const lowestPrice = sortedPrices.length > 0 ? sortedPrices[0] : null;
                    const highestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : null;
                    
                    const priceToShow = isMostExpensiveRequest ? highestPrice : lowestPrice;
                    const badgeText = isMostExpensiveRequest ? t('most_expensive', 'Most Expensive') : (isCheapestRequest ? t('cheapest', 'Cheapest') : null);
                    const badgeColor = isMostExpensiveRequest ? "bg-red-600" : "bg-green-600";

                    return (
                        <Link 
                            key={`barcode-${i}-${barcode}`}
                            to={`/price-comparison/${barcode}`}
                            className={`block my-2 ${isMostExpensiveRequest ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'} border rounded-xl overflow-hidden hover:shadow-md transition-all group`}
                        >
                            <div className="flex items-center gap-3 p-2.5">
                                <div className="w-14 h-14 max-w-[3.5rem] bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-900/50">
                                    <ChatProductThumb src={product.imageUrl} alt={product.name} className="w-full h-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-500">
                                            {product.name || product.productName}
                                        </h4>
                                        {badgeText && (
                                            <span className={`${badgeColor} text-[9px] uppercase tracking-wider text-white px-1.5 py-0.5 rounded-full font-black shadow-sm`}>{badgeText}</span>
                                        )}
                                    </div>
                                    {priceToShow ? (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{isMostExpensiveRequest ? t('high', 'High') : t('best', 'Best')}:</span>
                                                    <span className={`text-base font-black ${isMostExpensiveRequest ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                        {convert(priceToShow.price, 'TRY')} {getCurrencySymbol()}
                                                    </span>
                                                </div>
                                                {renderStoreBadge(priceToShow)}
                                            </div>
                                            {text.toLowerCase().includes('compare') && sortedPrices.length > 1 ? (
                                                <div className="space-y-1 border-t border-gray-100 dark:border-gray-700/60 pt-1.5">
                                                    {sortedPrices.slice(0, 2).map((pr, idx) => (
                                                        <div key={`${pr.supermarketId || idx}-${pr.price}`} className="flex items-center justify-between gap-2 text-[11px]">
                                                            <span className="truncate text-gray-600 dark:text-gray-300 font-semibold">{storeLabelFromPrice(pr)}</span>
                                                            <span className="shrink-0 font-black text-gray-800 dark:text-gray-100">
                                                                {convert(pr.price, 'TRY')} {getCurrencySymbol()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-gray-500 italic">{t('no_data_yet')}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                }

            return (
                    <Link 
                        key={`barcode-fallback-${i}-${barcode}`}
                        to={`/price-comparison/${barcode}`}
                        className="inline-flex items-center gap-0.5 bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded text-xs font-bold underline transition-colors"
                    >
                        {t('view_product', 'View Product')} <FiExternalLink size={10} />
                    </Link>
                );
        });
    };

    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] sm:max-w-[85%] min-w-0 overflow-hidden px-3.5 py-2.5 sm:p-3 rounded-[1.25rem] ${
                msg.role === 'user' 
                    ? 'bg-brand-600 text-white rounded-tr-none shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none'
            }`}>
                <div className="text-[15px] sm:text-sm leading-6 whitespace-pre-wrap break-words overflow-hidden">
                    {renderContent(msg.content)}
                </div>
            </div>
        </div>
    );
};

const SUGAR_THRESHOLD_G_PER_100G = 22.5;
const SODIUM_THRESHOLD_MG_PER_100G = 600;
const CAFFEINE_THRESHOLD_MG_PER_L = 150;

const DIETARY_RESTRICTION_TERMS = {
    vegan: ['milk', 'dairy', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'egg', 'honey', 'gelatin', 'süt', 'sut', 'yumurta', 'bal', 'jelatin'],
    vegetarian: ['beef', 'chicken', 'pork', 'fish', 'shellfish', 'meat', 'gelatin', 'beef gelatin', 'tavuk', 'sığır', 'sigir', 'domuz', 'balık', 'balik', 'jelatin'],
    halal: ['pork', 'bacon', 'ham', 'lard', 'alcohol', 'wine', 'beer', 'gelatin', 'domuz', 'alkol', 'şarap', 'sarap', 'bira', 'jelatin'],
    kosher: ['pork', 'bacon', 'ham', 'lard', 'shellfish', 'shrimp', 'crab', 'lobster', 'domuz', 'karides', 'yengeç', 'yengec'],
};

/** Prefer products that match the user message; fall back to a short sample (prompt cap + relevance). */
const buildRankedProductContextLines = (products, userHint, aiProfile = {}) => {
    const norm = (s) =>
        String(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9ğüşöçı]/gi, ' ');
    const words = new Set(norm(userHint).split(/\s+/).filter((w) => w.length > 2));
    const avoidWords = new Set(
        (Array.isArray(aiProfile.avoidIngredients) ? aiProfile.avoidIngredients : [])
            .flatMap((term) => norm(term).split(/\s+/))
            .filter((w) => w.length > 2)
            .slice(0, 24)
    );
    const dietaryBoostWords = new Set(
        (Array.isArray(aiProfile.dietaryPreferences) ? aiProfile.dietaryPreferences : [])
            .flatMap((pref) => {
                const key = String(pref || '').toLowerCase();
                if (key === 'vegan') return ['vegan'];
                if (key === 'vegetarian') return ['vegetarian', 'veggie'];
                return [];
            })
    );
    const scored = products.map((p) => {
        const displayName = p.name || p.productName || '';
        const blob = norm(`${displayName} ${p.categoryId?.categoryName || ''}`);
        let score = 0;
        for (const w of words) {
            if (blob.includes(w)) score++;
        }
        const fuzzyScore = scoreProductNameMatch(userHint, displayName);
        if (fuzzyScore >= FUZZY_MATCH_MIN_SCORE) {
            score += Math.round(fuzzyScore * 6);
        }
        for (const w of dietaryBoostWords) {
            if (blob.includes(w)) score += 2;
        }
        for (const w of avoidWords) {
            if (blob.includes(w)) score -= 1;
        }
        return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const picked = scored.filter((x) => x.score > 0).slice(0, 25).map((x) => x.p);
    const list = picked.length > 0 ? picked : products.slice(0, 15);
        return list
        .map((p) => {
            const category = Array.isArray(p.categoryId)
                ? p.categoryId[0]?.categoryName
                : p.categoryId?.categoryName || 'General';
            const priceDetails = p.prices
                .map((pr) => {
                    const meta = resolvePriceSupermarketMeta(pr, []);
                    const label = pr.supermarketLabel || meta.label || 'Store';
                    const storeTag = (pr.supermarketId || meta.supermarketId)
                        ? ` [STORE:${pr.supermarketId || meta.supermarketId}]`
                        : '';
                    return `${label}: ${pr.price} TRY${storeTag}`;
                })
                .join(', ');
            const barcodeTag = p.barcode || p.code || p.$id || '';
            const sourceTag = p.is_off_cache || p.is_global ? 'OpenFoodFacts' : 'PriceMate';
            return `- [SOURCE:${sourceTag}] [BARCODE:${barcodeTag}] ${p.name || p.productName}: [${category}] ${priceDetails || 'No current price'}`;
        })
        .join('\n');
};

const AIChatBox = ({ isOpen, onClose, variant = 'drawer' }) => {
    const isPageVariant = variant === 'page';
    const [composerFocused, setComposerFocused] = useState(false);
    const composerAnchoredToNav = prefersKeyboardResizeViewport();
    useComposerKeyboardLift(isPageVariant && isOpen && !composerAnchoredToNav, {
        active: composerFocused,
    });
    const { t, i18n } = useTranslation();
    const { convert, getCurrencySymbol, currency } = useCurrencyStore();
    const user = useAuthStore(state => state.user);
    const {
        messages: history,
        conversationSummaries,
        activeConversationId,
        error: chatWriteError,
        addMessage,
        loading: historyLoading,
        summariesLoading,
        initializeChatSession,
        startNewConversation,
        fetchMessagesForConversation,
        deleteConversation,
        resetChat,
        clearChatWriteError,
    } = useChatStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mobileListOpen, setMobileListOpen] = useState(false);
    const [fullProductList, setFullProductList] = useState([]);
    const [supermarketList, setSupermarketList] = useState([]);
    const { location: userLocation } = useUserLocation();
    const fetchSupermarkets = useSupermarketsStore((state) => state.fetchSupermarkets);
    const messagesEndRef = useRef(null);
    const messagesScrollRef = useRef(null);
    const headerRef = useRef(null);
    const inputRef = useRef(null);
    const formRef = useRef(null);
    const composerStackRef = useRef(null);
    const composerFocusedRef = useRef(false);

    const mobileQuickPrompts = [
        {
            key: 'cheapest',
            Icon: FiMapPin,
            label: t('ai_chat_quick_cheapest', 'Cheapest nearby'),
            description: t('ai_chat_quick_cheapest_desc', 'Find the lowest available price.'),
            prompt: t('ai_chat_prompt_cheapest_nearby', 'Find the cheapest nearby option'),
        },
        {
            key: 'ingredients',
            Icon: FiClipboard,
            label: t('ai_chat_quick_ingredients', 'Check ingredients'),
            description: t('ai_chat_quick_ingredients_desc', 'Review ingredients and key nutrition.'),
            prompt: t('ai_chat_prompt_ingredients', 'Check ingredients for me'),
        },
        {
            key: 'suitable',
            Icon: FiCheckCircle,
            label: t('ai_chat_quick_suitable', 'Suitable for me?'),
            description: t('ai_chat_quick_suitable_desc', 'Use your saved allergies and preferences.'),
            prompt: t('ai_chat_prompt_suitable', 'Is this suitable for me?'),
        },
        {
            key: 'compare',
            Icon: FiSearch,
            label: t('ai_chat_quick_compare', 'Compare prices'),
            description: t('ai_chat_quick_compare_desc', 'See stores ranked by price.'),
            prompt: t('ai_chat_prompt_compare', 'Compare prices for this product'),
        },
        {
            key: 'scan',
            Icon: FiCamera,
            label: t('ai_chat_quick_scan', 'Scan barcode'),
            description: t('ai_chat_quick_scan_desc', 'Paste or scan a barcode to check.'),
            prompt: t('ai_chat_prompt_scan_barcode', 'I scanned a product. Check this barcode: '),
        },
    ];

    const featuredQuickPrompts = mobileQuickPrompts.filter((item) =>
        ['cheapest', 'ingredients', 'compare', 'suitable'].includes(item.key)
    );

    const beginNewConversation = () => {
        startNewConversation();
        setMobileListOpen(false);
    };

    const applyQuickPrompt = (prompt) => {
        if (!activeConversationId) beginNewConversation();
        setInput(prompt);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const showQuickPrompts =
        Boolean(user) &&
        !summariesLoading &&
        !historyLoading &&
        !isLoading &&
        history.length === 0;

    const renderQuickPromptSuggestions = (showHero = true) => (
        <div className={showHero ? 'mx-auto w-full max-w-md space-y-4 pt-2' : 'mx-auto w-full max-w-md space-y-3 pt-1'}>
            {showHero && (
                <div className="rounded-[1.75rem] bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 p-5 text-white shadow-xl shadow-brand-600/20">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm shrink-0">
                            <FiCpu size={22} className="text-white/85" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black tracking-tight">{t('ai_chat_empty_title', 'What do you want to check?')}</h2>
                            <p className="text-white/80 text-xs sm:text-sm mt-0.5 leading-relaxed">
                                {t('ai_chat_empty_description')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                {featuredQuickPrompts.map((item) => {
                    const Icon = item.Icon;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => applyQuickPrompt(item.prompt)}
                            className="min-h-24 rounded-3xl border border-gray-200 bg-white px-4 py-3.5 text-left text-gray-800 shadow-sm transition active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        >
                            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                                <Icon size={17} />
                            </span>
                            <span className="block text-[12px] font-black leading-tight">{item.label}</span>
                            <span className="mt-1 block text-[10px] font-semibold leading-4 text-gray-500 dark:text-gray-400">
                                {item.description}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const maxChatIndex = conversationSummaries.reduce(
        (m, s) => Math.max(m, s.chatIndex ?? 0),
        0
    );
    const draftChatIndex = maxChatIndex + 1;

    const isDraftConversation =
        !!activeConversationId &&
        !conversationSummaries.some((s) => s.id === activeConversationId);

    const conversationRows = isDraftConversation
        ? [
              {
                  id: activeConversationId,
                  title: '',
                  updatedAt: new Date().toISOString(),
                  isDraft: true,
                  chatIndex: draftChatIndex,
              },
              ...conversationSummaries,
          ]
        : conversationSummaries;

    const labelForRow = (row) => {
        if (row.chatIndex != null) {
            return t('ai_chat_numbered', { n: row.chatIndex });
        }
        return t('ai_chat_new');
    };

    useEffect(() => {
        if (!user?.$id) {
            resetChat();
        }
    }, [user?.$id, resetChat]);

    useEffect(() => {
        if (!isOpen || !user?.$id) return;
        const run = async () => {
            try {
                await initializeChatSession(user.$id);
            } catch (e) {
                console.error('Chat sync on open failed:', e);
            }
        };
        void run();
    }, [isOpen, user?.$id, initializeChatSession]);

    useEffect(() => {
        if (!isOpen) setMobileListOpen(false);
    }, [isOpen]);

    // When the chat list overlay is open on mobile, hide global bottom tabs to
    // avoid visual overlap with the header/title on iPhone.
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        if (!isPageVariant) return undefined;

        const { body } = document;
        if (isOpen && mobileListOpen) {
            body.classList.add('pricemate-ai-chat-list-open');
        } else {
            body.classList.remove('pricemate-ai-chat-list-open');
        }
        return () => body.classList.remove('pricemate-ai-chat-list-open');
    }, [isPageVariant, isOpen, mobileListOpen]);

    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    }, [input]);

    const isPage = variant === 'page';
    const iosFixedChrome = isPage && usesAiChatFixedMobileChrome();

    useEffect(() => {
        if (!isPage || !isOpen || typeof window === 'undefined') return undefined;

        const onViewportChange = () => {
            if (composerFocusedRef.current) {
                requestAnimationFrame(() => scrollMessagesToBottom());
            }
        };

        const vv = window.visualViewport;
        vv?.addEventListener('resize', onViewportChange, { passive: true });
        vv?.addEventListener('scroll', onViewportChange, { passive: true });
        return () => {
            vv?.removeEventListener('resize', onViewportChange);
            vv?.removeEventListener('scroll', onViewportChange);
        };
    }, [isPage, isOpen]);

    useEffect(() => {
        if (!isPage || !isOpen || typeof document === 'undefined') return undefined;

        const root = document.documentElement;
        const measure = () => {
            const composerEl = composerStackRef.current;
            const headerEl = headerRef.current;
            if (composerEl) {
                const h = Math.round(composerEl.getBoundingClientRect().height || 0);
                if (h > 0) root.style.setProperty('--mobile-ai-composer-h', `${h}px`);
            }
            if (headerEl) {
                const h = Math.round(headerEl.getBoundingClientRect().height || 0);
                if (h > 0) root.style.setProperty('--mobile-ai-header-h', `${h}px`);
            }
        };

        measure();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (composerStackRef.current) ro?.observe(composerStackRef.current);
        if (headerRef.current) ro?.observe(headerRef.current);
        window.addEventListener('resize', measure, { passive: true });

        const vv = window.visualViewport;
        vv?.addEventListener('resize', measure, { passive: true });

        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
            vv?.removeEventListener('resize', measure);
            root.style.removeProperty('--mobile-ai-composer-h');
            root.style.removeProperty('--mobile-ai-header-h');
        };
    }, [isPage, isOpen, mobileListOpen, chatWriteError]);

    const scrollMessagesToBottom = () => {
        const pane = messagesScrollRef.current;
        if (!pane) return;
        pane.scrollTop = pane.scrollHeight;
    };

    const scrollMessagesToTop = () => {
        const pane = messagesScrollRef.current;
        if (!pane) return;
        pane.scrollTop = 0;
    };

    useEffect(() => {
        const hasThread = Boolean(activeConversationId);
        const hasMessages = history.length > 0;

        if (hasThread && historyLoading) return;

        if (hasThread && (hasMessages || isLoading)) {
            requestAnimationFrame(() => {
                scrollMessagesToBottom();
                requestAnimationFrame(() => scrollMessagesToBottom());
            });
            return;
        }
        requestAnimationFrame(() => scrollMessagesToTop());
    }, [history, isLoading, activeConversationId, historyLoading]);

    // Fetch context data (products and prices) to inform the AI
    useEffect(() => {
        const loadContext = async () => {
            try {
                const products = await fetchProducts(50);
                const productIds = products.map((p) => p.$id).filter(Boolean);
                const [prices, supermarkets] = await Promise.all([
                    fetchPricesForProducts(productIds),
                    fetchSupermarkets(),
                ]);

                const productsWithData = products.map((p) => normalizeProduct(p, prices));

                const enrichedProducts = enrichProductPricesWithSupermarkets(
                    productsWithData,
                    Array.isArray(supermarkets) ? supermarkets : []
                );
                setFullProductList(enrichedProducts);
                setSupermarketList(Array.isArray(supermarkets) ? supermarkets : []);
            } catch (error) {
                console.error("Error loading chat context:", error);
            }
        };
        loadContext();
    }, [fetchSupermarkets]);

    const extractBarcode = (message) => {
        const match = message.match(/\b\d{8,14}\b/);
        return match ? match[0] : null;
    };

    const extractQuotedProduct = (message) => {
        const match = message.match(/["']([^"']{3,})["']/);
        return match ? match[1].trim() : '';
    };

    const getUserAllergyPreferences = () => {
        const prefs = user?.prefs && typeof user.prefs === 'object' ? user.prefs : {};
        return readStoredAllergyProfile(prefs).allergies;
    };

    const getUserAiProfile = () => {
        const prefs = user?.prefs && typeof user.prefs === 'object' ? user.prefs : {};
        return readStoredAiProfile(prefs).profile;
    };

    const detectConditions = (message, preferredAllergies = []) => {
        const lowered = message.toLowerCase();
        const conditions = new Set();

        const hasAny = (keywords) => keywords.some((word) => lowered.includes(word));

        if (hasAny(['gluten', 'gluten free', 'gluten-free', 'celiac', 'coeliac', 'çölyak', 'glutensiz'])) {
            conditions.add('gluten');
        }

        if (hasAny(['lactose', 'laktoz', 'lactose free', 'lactose-free', 'dairy free', 'dairy-free'])) {
            conditions.add('lactose');
        }

        if (hasAny(['high sugar', 'high-sugar', 'sugar content', 'sugary', 'too much sugar', 'added sugar', 'şeker', 'seker', 'şekerli', 'sekerli'])) {
            conditions.add('high_sugar');
        }

        if (hasAny(['diabetes', 'diabetic', 'diyabet', 'low sugar', 'low-sugar'])) {
            conditions.add('diabetes');
        }

        if (hasAny(['high sodium', 'high-sodium', 'sodium', 'sodyum', 'salt', 'salty', 'tuz', 'tuzlu'])) {
            conditions.add('high_sodium');
        }

        if (hasAny(['hypertension', 'high blood pressure', 'tansiyon'])) {
            conditions.add('hypertension');
        }

        if (hasAny(['caffeine', 'high caffeine', 'caffeinated', 'kafein', 'enerji içeceği', 'enerji icecegi', 'energy drink'])) {
            conditions.add('high_caffeine');
        }

        if (hasAny(['pregnant', 'pregnancy', 'hamile', 'gebelik'])) {
            conditions.add('pregnancy');
        }

        /**
         * Factual nutrient questions (e.g. "Is the sugar in Coca-Cola high?") should run the
         * same checks without asking the user to name a medical condition first.
         */
        const sugarLevelQuestion =
            /\b(sugar|şeker|seker)\b[\s\S]{0,56}\b(high|low|much|yüksek|düşük|dusuk|fazla|çok)\b/i.test(
                lowered
            ) ||
            /\b(high|low|much|yüksek|düşük|dusuk|fazla|çok)\b[\s\S]{0,56}\b(sugar|şeker|seker)\b/i.test(
                lowered
            ) ||
            /\bhow much\b[\s\S]{0,28}\b(sugar|şeker|seker)\b/i.test(lowered) ||
            /\b(sugar|şeker|seker)\b\s*(content|level|amount)\b/i.test(lowered);

        const sodiumLevelQuestion =
            /\b(sodium|sodyum|salt|tuz)\b[\s\S]{0,56}\b(high|low|much|yüksek|düşük|dusuk|fazla|çok)\b/i.test(
                lowered
            ) ||
            /\b(high|low|much|yüksek|düşük|dusuk|fazla|çok)\b[\s\S]{0,56}\b(sodium|sodyum|salt|tuz)\b/i.test(
                lowered
            ) ||
            /\bhow much\b[\s\S]{0,28}\b(sodium|sodyum|salt|tuz)\b/i.test(lowered);

        const caffeineLevelQuestion =
            /\b(caffeine|kafein)\b[\s\S]{0,56}\b(high|low|much|yüksek|düşük|dusuk|fazla|çok)\b/i.test(
                lowered
            ) ||
            /\b(high|low|much|yüksek|düşük|dusuk|fazla|çok)\b[\s\S]{0,56}\b(caffeine|kafein)\b/i.test(
                lowered
            ) ||
            /\bhow much\b[\s\S]{0,28}\b(caffeine|kafein)\b/i.test(lowered);

        if (sugarLevelQuestion && !conditions.has('diabetes')) {
            conditions.add('high_sugar');
        }
        if (sodiumLevelQuestion && !conditions.has('hypertension')) {
            conditions.add('high_sodium');
        }
        if (caffeineLevelQuestion) {
            conditions.add('high_caffeine');
        }

        const preferenceAllergenTargets = Array.from(
            new Set(
                (Array.isArray(preferredAllergies) ? preferredAllergies : [])
                    .map((item) => resolveAllergyPreferenceLabel(item))
                    .filter(Boolean)
            )
        );

        const explicitAllergyIntent = hasAny(ALLERGY_KEYWORDS);
        const allergySafetyKeywords = [
            'ingredient', 'ingredients', 'allergen', 'allergens', 'içerik', 'icerik', 'içindekiler',
            'suitable', 'uygun', 'safe', 'güvenli', 'guvenli', 'contains', 'has', 'good for me', 'better for me'
        ];
        const allergySafetyIntent = explicitAllergyIntent || hasAny(allergySafetyKeywords);
        // Personal safety verdicts must come from the saved profile. Mentioning
        // "milk" in a question should not turn into a personal milk allergy.
        const allergenTargets = allergySafetyIntent
            ? Array.from(new Set(preferenceAllergenTargets))
            : [];

        if (allergySafetyIntent && preferenceAllergenTargets.length > 0) {
            conditions.add('allergy');
        }

        const medicalKeywords = [
            'ingredient', 'ingredients', 'allergen', 'allergens', 'içerik', 'icerik', 'içindekiler', 'suitable', 'uygun', 'safe', 'güvenli',
            'good for me', 'better for me', 'sugar', 'sugary', 'şeker', 'seker', 'sodium', 'sodyum', 'salt', 'tuz', 'caffeine', 'kafein'
        ];
        const isMedical = hasAny(medicalKeywords) || conditions.size > 0;

        return {
            conditions: Array.from(conditions),
            allergenTargets,
            isMedical
        };
    };

    const buildIngredientQuery = (message, productMatch) => {
        if (productMatch?.name || productMatch?.productName) {
            return productMatch.name || productMatch.productName;
        }

        const quoted = extractQuotedProduct(message);
        if (quoted) return quoted;

        const stopwords = new Set([
            'is', 'this', 'that', 'product', 'for', 'with', 'can', 'i', 'eat', 'drink', 'safe', 'suitable',
            'ingredients', 'ingredient', 'contains', 'has', 'please', 'need', 'check', 'about', 'my', 'me', 'the',
            'a', 'an', 'of', 'in', 'on', 'too', 'very', 'really', 'much', 'many', 'lot',
            'good', 'better', 'sugar', 'sugary', 'salt', 'sodium', 'caffeine', 'high', 'low', 'level', 'content', 'amount',
            'bu', 'şu', 'su', 'ürün', 'urun', 'icerik', 'içerik', 'içindekiler', 'uygun', 'güvenli', 'var', 'mi',
            'nedir', 'içinde', 'kadar',
        ]);

        const cleaned = message
            .replace(/\b\d{8,14}\b/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word && !stopwords.has(word))
            .join(' ')
            .trim();

        return cleaned.length >= 3 ? cleaned : '';
    };

    const evaluateSuitability = (payload, conditions, allergenTargets, aiProfile = {}) => {
        if (!payload) {
            return {
                status: 'unknown',
                reasons: [t('ai_reason_no_ingredients')],
                triggers: { allergy: [], avoidIngredients: [], dietary: {} },
            };
        }

        const ingredientBlob = `${payload.ingredientsText || ''} ${(payload.allergens || []).join(' ')}`.toLowerCase();
        const nutriments = payload.nutriments || {};
        const sugarPer100g = nutriments.sugarsPer100g;
        const sodiumMgPer100g = nutriments.sodiumMgPer100g;
        const caffeineMgPerL = nutriments.caffeineMgPerL;
        const hasIngredientBlob = ingredientBlob.trim().length > 0;
        const hasNutriments = [sugarPer100g, sodiumMgPer100g, caffeineMgPerL].some(
            (value) => value !== null && value !== undefined
        );

        if (!hasIngredientBlob && !hasNutriments) {
            return {
                status: 'unknown',
                reasons: [t('ai_reason_no_ingredients')],
                triggers: { allergy: [], avoidIngredients: [], dietary: {} },
            };
        }

        const severityRank = { safe: 0, caution: 1, avoid: 2 };
        let status = 'safe';
        const reasons = [];
        const triggers = { allergy: [], avoidIngredients: [], dietary: {} };

        const bumpStatus = (next) => {
            if (severityRank[next] > severityRank[status]) {
                status = next;
            }
        };

        const collectMatches = (terms) => {
            const matches = terms.filter((term) => ingredientBlob.includes(term.toLowerCase()));
            return Array.from(new Set(matches));
        };

        const formatMatches = (matches) => {
            if (matches.length === 0) return '';
            const limited = matches.slice(0, 6);
            return `${limited.join(', ')}${matches.length > 6 ? '...' : ''}`;
        };

        const formatNutrientLevel = (nutrientLabel, valueText, isHigh) =>
            `${nutrientLabel}: ${isHigh ? 'high' : 'within limit'} (${valueText})`;

        const profileAvoids = Array.isArray(aiProfile.avoidIngredients) ? aiProfile.avoidIngredients : [];
        const avoidMatches = collectMatches(profileAvoids);
        if (avoidMatches.length > 0) {
            reasons.push(`Preference: avoid ingredient found (${formatMatches(avoidMatches)})`);
            triggers.avoidIngredients = avoidMatches;
            bumpStatus('caution');
        }

        for (const dietary of aiProfile.dietaryPreferences || []) {
            const terms = DIETARY_RESTRICTION_TERMS[dietary] || [];
            const matches = collectMatches(terms);
            if (matches.length > 0) {
                reasons.push(`Preference (${dietary}): may not match (${formatMatches(matches)})`);
                triggers.dietary[dietary] = matches;
                bumpStatus('caution');
            }
        }

        if (conditions.includes('allergy')) {
            if (allergenTargets.length > 0) {
                const allergyTerms = getAllergenTermsForLabels(allergenTargets);
                const matches = collectMatches(allergyTerms);
                if (matches.length > 0) {
                    reasons.push(`${t('condition_allergy')}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                    triggers.allergy = matches;
                    bumpStatus('avoid');
                } else {
                    reasons.push(`${t('condition_allergy')}: ${t('ai_reason_none_found', { items: allergenTargets.join(', ') })}`);
                }
            } else if (payload.allergens?.length > 0) {
                reasons.push(`${t('condition_allergy')}: ${t('ai_reason_found', { items: formatMatches(payload.allergens) })}`);
                triggers.allergy = payload.allergens.slice(0, 10);
                bumpStatus('caution');
            }
        }

        if (conditions.includes('gluten')) {
            const glutenTerms = ['gluten', 'wheat', 'barley', 'rye', 'malt', 'buğday', 'bugday', 'arpa', 'çavdar', 'cavdar'];
            const matches = collectMatches(glutenTerms);
            if (matches.length > 0) {
                reasons.push(`${t('condition_gluten')}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                bumpStatus('avoid');
            } else {
                reasons.push(`${t('condition_gluten')}: ${t('ai_reason_none_found', { items: t('condition_gluten') })}`);
            }
        }

        if (conditions.includes('lactose')) {
            const lactoseTerms = ['milk', 'dairy', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'süt', 'sut', 'laktoz', 'peynir', 'yoğurt', 'yogurt', 'tereyağ', 'tereyag', 'krema', 'kazein'];
            const matches = collectMatches(lactoseTerms);
            if (matches.length > 0) {
                reasons.push(`${t('condition_lactose')}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                bumpStatus('avoid');
            } else {
                reasons.push(`${t('condition_lactose')}: ${t('ai_reason_none_found', { items: t('condition_lactose') })}`);
            }
        }

        const sugarTerms = ['sugar', 'glucose', 'fructose', 'syrup', 'corn syrup', 'honey', 'dextrose', 'sucrose', 'maltodextrin', 'şeker', 'seker', 'glikoz', 'fruktoz', 'şurup', 'surup', 'bal', 'dekstroz', 'sakkaroz', 'maltodekstrin'];
        const sodiumTerms = ['salt', 'sodium', 'msg', 'monosodium', 'sodium chloride', 'tuz', 'sodyum', 'monosodyum'];
        const caffeineTerms = ['caffeine', 'caffeinated', 'kafein', 'energy drink', 'enerji içeceği', 'enerji icecegi'];

        const wantsSugarCheck = conditions.includes('diabetes') || conditions.includes('high_sugar');
        const wantsSodiumCheck = conditions.includes('hypertension') || conditions.includes('high_sodium');
        const wantsCaffeineCheck = conditions.includes('high_caffeine');

        if (wantsSugarCheck) {
            const labelKey = conditions.includes('diabetes') ? 'condition_diabetes' : 'condition_high_sugar';
            if (sugarPer100g !== null && sugarPer100g !== undefined) {
                const valueText = `${Number(sugarPer100g).toFixed(1)}g/100g`;
                const isHigh = sugarPer100g >= SUGAR_THRESHOLD_G_PER_100G;
                reasons.push(`${t(labelKey)}: ${formatNutrientLevel(t('nutrient_sugar'), valueText, isHigh)}`);
                if (isHigh) bumpStatus('caution');
            } else if (hasIngredientBlob) {
                const matches = collectMatches(sugarTerms);
                if (matches.length > 0) {
                    reasons.push(`${t(labelKey)}: ${t('nutrient_sugar')} found in ingredients (${formatMatches(matches)})`);
                    bumpStatus('caution');
                } else {
                    reasons.push(`${t(labelKey)}: ${t('nutrient_sugar')} not listed`);
                }
            } else {
                reasons.push(`${t(labelKey)}: ${t('nutrient_sugar')} unknown`);
            }
        }

        if (wantsSodiumCheck) {
            const labelKey = conditions.includes('hypertension') ? 'condition_hypertension' : 'condition_high_sodium';
            if (sodiumMgPer100g !== null && sodiumMgPer100g !== undefined) {
                const valueText = `${Math.round(sodiumMgPer100g)}mg/100g`;
                const isHigh = sodiumMgPer100g >= SODIUM_THRESHOLD_MG_PER_100G;
                reasons.push(`${t(labelKey)}: ${formatNutrientLevel(t('nutrient_sodium'), valueText, isHigh)}`);
                if (isHigh) bumpStatus('caution');
            } else if (hasIngredientBlob) {
                const matches = collectMatches(sodiumTerms);
                if (matches.length > 0) {
                    reasons.push(`${t(labelKey)}: ${t('nutrient_sodium')} found in ingredients (${formatMatches(matches)})`);
                    bumpStatus('caution');
                } else {
                    reasons.push(`${t(labelKey)}: ${t('nutrient_sodium')} not listed`);
                }
            } else {
                reasons.push(`${t(labelKey)}: ${t('nutrient_sodium')} unknown`);
            }
        }

        if (wantsCaffeineCheck) {
            const labelKey = 'condition_high_caffeine';
            if (caffeineMgPerL !== null && caffeineMgPerL !== undefined) {
                const valueText = `${Math.round(caffeineMgPerL)}mg/L`;
                const isHigh = caffeineMgPerL >= CAFFEINE_THRESHOLD_MG_PER_L;
                reasons.push(`${t(labelKey)}: ${formatNutrientLevel(t('nutrient_caffeine'), valueText, isHigh)}`);
                if (isHigh) bumpStatus('caution');
            } else if (hasIngredientBlob) {
                const matches = collectMatches(caffeineTerms);
                if (matches.length > 0) {
                    reasons.push(`${t(labelKey)}: ${t('nutrient_caffeine')} found in ingredients (${formatMatches(matches)})`);
                    bumpStatus('caution');
                } else {
                    reasons.push(`${t(labelKey)}: ${t('nutrient_caffeine')} not listed`);
                }
            } else {
                reasons.push(`${t(labelKey)}: ${t('nutrient_caffeine')} unknown`);
            }
        }

        if (conditions.includes('pregnancy')) {
            const pregnancyTerms = ['alcohol', 'caffeine', 'energy drink', 'unpasteurized', 'raw', 'alkol', 'kafein', 'enerji içeceği', 'enerji icecegi', 'pastörize edilmemiş', 'pasterize edilmemis', 'çiğ', 'cig'];
            const matches = collectMatches(pregnancyTerms);
            if (matches.length > 0) {
                reasons.push(`${t('condition_pregnancy')}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                bumpStatus('caution');
            } else {
                reasons.push(`${t('condition_pregnancy')}: ${t('ai_reason_none_found', { items: t('condition_pregnancy') })}`);
            }
        }

        return { status, reasons, triggers };
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        if (!user?.$id) return;

        if (!activeConversationId) {
            beginNewConversation();
        }

        const userMessage = input.trim();
        setInput('');

        const barcodeFromMessage = extractBarcode(userMessage);
        const localProductMatch = findBestProductMatch(userMessage, fullProductList);
        const productMatch = localProductMatch?.product || null;
        const catalog = await resolveCatalogProductForIngredients(userMessage);
        const offCache = await resolveOffCacheProductForIngredients(userMessage);
        const mergedProductProfile = productMatch || catalog.product || offCache.product;
        const effectiveBarcode =
            barcodeFromMessage ||
            catalog.catalogBarcode ||
            offCache.barcode ||
            productMatch?.barcode ||
            productMatch?.code ||
            '';
        const catalogDisplayName =
            catalog.catalogName || offCache.name || productMatch?.name || productMatch?.productName || '';

        // Use store to add user message
        if (user?.$id) {
            await addMessage(user.$id, 'user', userMessage, user);
        } else {
            // Logged out users don't have persistence
            return;
        }

        setIsLoading(true);

        const userAllergyPreferences = getUserAllergyPreferences();
        const userAiProfile = getUserAiProfile();
        const { conditions, allergenTargets, isMedical } = detectConditions(userMessage, userAllergyPreferences);
        const explicitNutrientOrMedicalConditions = new Set([
            'gluten',
            'lactose',
            'diabetes',
            'hypertension',
            'high_sugar',
            'high_sodium',
            'high_caffeine',
            'pregnancy'
        ]);
        const hasExplicitNutrientOrMedicalCondition = conditions.some((condition) =>
            explicitNutrientOrMedicalConditions.has(condition)
        );
        const shouldRunDefaultIngredientCheck = isMedical && !hasExplicitNutrientOrMedicalCondition;
        const profileNutritionConditions = (userAiProfile.nutritionPriorities || []).flatMap((priority) => {
            if (priority === 'low sugar') return ['high_sugar'];
            if (priority === 'low sodium') return ['high_sodium'];
            if (priority === 'low caffeine') return ['high_caffeine'];
            return [];
        });
        const effectiveConditions = shouldRunDefaultIngredientCheck
            ? Array.from(new Set([...conditions, ...profileNutritionConditions, 'high_sugar', 'high_sodium', 'high_caffeine']))
            : Array.from(new Set([...conditions, ...profileNutritionConditions]));

        // Build intent summary and check cache to avoid duplicate API calls
        const intentSummary = buildIntentSummary(userMessage);
        const allergyKey = userAllergyPreferences.length > 0
            ? [...userAllergyPreferences].sort().join('|')
            : 'none';
        const profileKey = buildAiProfileCacheKey(userAiProfile);
        const intentKey = makeIntentKey(intentSummary, effectiveBarcode, user?.$id || 'guest', `${allergyKey}::PROFILE:${profileKey}`);

        const aiCheckResult = await runAiCheckFunction({
            query: userMessage,
            userId: user.$id,
            locale: i18n.resolvedLanguage || i18n.language || 'en',
            currency,
            allergyPrefs: userAllergyPreferences,
            userProfile: userAiProfile,
            barcodeHint: effectiveBarcode,
            nameHint: catalogDisplayName || mergedProductProfile?.name || mergedProductProfile?.productName || '',
        });

        if (aiCheckResult && aiCheckResult.mode && aiCheckResult.mode !== 'generic') {
            const structuredReply = serializeAiCheckResponse(aiCheckResult);
            if (user?.$id) {
                await addMessage(user.$id, 'assistant', structuredReply, user);
                setCachedIntent(
                    `${intentKey}::DATA:${buildAiCheckFingerprint(aiCheckResult)}`,
                    structuredReply,
                    1000 * 60
                );
            }
            setIsLoading(false);
            return;
        }

        const cachedReply = getCachedIntent(intentKey);
        if (cachedReply) {
            const sanitizedCachedReply = sanitizeAssistantReply(cachedReply);
            if (user?.$id) {
                await addMessage(user.$id, 'assistant', sanitizedCachedReply, user);
            }
            setIsLoading(false);
            return;
        }

        if (isMedical) {
            const queryName = buildIngredientQuery(userMessage, mergedProductProfile);
            const hasIngredientContent = (payload) =>
                String(payload?.ingredientsText || '').trim().length > 0;
            const hasAllergenContent = (payload) =>
                Array.isArray(payload?.allergens) && payload.allergens.length > 0;
            const pickDefined = (primary, fallback) =>
                primary !== null && primary !== undefined && primary !== '' ? primary : fallback;
            const mergeIngredientPayload = (base, extra) => {
                if (!base) return extra;
                if (!extra) return base;
                return {
                    ...base,
                    ingredientsText: hasIngredientContent(base) ? base.ingredientsText : (extra.ingredientsText || ''),
                    ingredientsList:
                        Array.isArray(base.ingredientsList) && base.ingredientsList.length > 0
                            ? base.ingredientsList
                            : (extra.ingredientsList || []),
                    allergens: hasAllergenContent(base) ? base.allergens : (extra.allergens || []),
                    nutriments: {
                        sugarsPer100g: pickDefined(base?.nutriments?.sugarsPer100g, extra?.nutriments?.sugarsPer100g ?? null),
                        sodiumMgPer100g: pickDefined(base?.nutriments?.sodiumMgPer100g, extra?.nutriments?.sodiumMgPer100g ?? null),
                        caffeineMgPerL: pickDefined(base?.nutriments?.caffeineMgPerL, extra?.nutriments?.caffeineMgPerL ?? null),
                        caffeineMgPer100g: pickDefined(base?.nutriments?.caffeineMgPer100g, extra?.nutriments?.caffeineMgPer100g ?? null),
                        saltGPer100g: pickDefined(base?.nutriments?.saltGPer100g, extra?.nutriments?.saltGPer100g ?? null),
                    },
                };
            };

            // Catalog-only policy: only answer ingredient/safety questions for products available in PriceMate.
            if (!catalog.product) {
                if (user?.$id) {
                    await addMessage(user.$id, 'assistant', t('ai_catalog_only_refusal'), user);
                }
                setIsLoading(false);
                return;
            }

            let ingredientPayload =
                ingredientPayloadFromAppwriteProduct(catalog.product) ||
                ingredientPayloadFromOffCache(offCache.product) ||
                null;

            if (!ingredientPayload && effectiveBarcode) {
                ingredientPayload = await fetchIngredientsByBarcode(effectiveBarcode);
            }

            // If we have nutrition-only data (e.g., from Appwrite) but no ingredient text,
            // enrich it from OFF so ingredients/allergens still show in the card.
            if (ingredientPayload && !hasIngredientContent(ingredientPayload)) {
                if (effectiveBarcode) {
                    const offByBarcode = await fetchIngredientsByBarcode(effectiveBarcode);
                    ingredientPayload = mergeIngredientPayload(ingredientPayload, offByBarcode);
                }

                if (!hasIngredientContent(ingredientPayload)) {
                    const fallbackSearch = catalogDisplayName || queryName || ingredientPayload?.name || '';
                    if (fallbackSearch) {
                        const offByName = await searchIngredientsByName(fallbackSearch);
                        ingredientPayload = mergeIngredientPayload(ingredientPayload, offByName);
                    }
                }
            }

            if (!ingredientPayload) {
                if (user?.$id) {
                    await addMessage(
                        user.$id,
                        'assistant',
                        t('ai_off_miss_catalog_hit', {
                            name: catalogDisplayName || catalog.product.name || '',
                            barcode: catalog.catalogBarcode || t('ai_barcode_unknown'),
                        }),
                        user
                    );
                }
                setIsLoading(false);
                return;
            }

            // Persist resolved ingredient data to catalog product so future checks can be served locally.
            if (catalog.product?.$id) {
                try {
                    await persistIngredientPayloadToCatalogProduct(catalog.product, ingredientPayload);
                } catch {
                    // best-effort only; ingredient check must still return
                }
            }

            const conditionLabels = effectiveConditions.map((condition) => t(`condition_${condition}`));
            const allergyChecksText = userAllergyPreferences.length > 0
                ? `allergy (${userAllergyPreferences.join(', ')})`
                : '';
            const baseChecksText = shouldRunDefaultIngredientCheck
                ? t('ai_default_ingredient_checks', 'sugar, sodium, caffeine')
                : conditionLabels.join(', ');
            const checksForText = [baseChecksText, allergyChecksText].filter(Boolean).join(', ');
            const resolvedProductName =
                catalogDisplayName ||
                mergedProductProfile?.name ||
                mergedProductProfile?.productName ||
                '';
            const productLabel = ingredientPayload.barcode
                ? `${ingredientPayload.name} [BARCODE:${ingredientPayload.barcode}]`
                : (resolvedProductName || ingredientPayload.name);

            const ingredientPreview = ingredientPayload.ingredientsText
                ? truncateText(ingredientPayload.ingredientsText, 140)
                : t('ai_no_ingredients');

            const { status, reasons, triggers } = evaluateSuitability(
                ingredientPayload,
                effectiveConditions,
                allergenTargets,
                userAiProfile
            );

            const allergenPreview = ingredientPayload.allergens?.length
                ? truncateText(ingredientPayload.allergens.slice(0, 4).join(', '), 90)
                : (triggers?.allergy?.length
                    ? truncateText(triggers.allergy.slice(0, 6).join(', '), 90)
                    : t('ai_no_allergens'));

            const triggerTerms = Array.from(
                new Set([
                    ...(Array.isArray(triggers?.allergy) ? triggers.allergy : []),
                    ...(Array.isArray(triggers?.avoidIngredients) ? triggers.avoidIngredients : []),
                    ...Object.values(triggers?.dietary || {}).flatMap((items) => items || []),
                ].filter(Boolean))
            );
            const triggersText = triggerTerms.length > 0
                ? emphasizeImportantIngredients(truncateText(triggerTerms.slice(0, 6).join(', '), 120))
                : '';

            const statusKey = status === 'avoid'
                ? 'ai_status_avoid'
                : status === 'caution'
                    ? 'ai_status_caution'
                    : status === 'unknown'
                        ? 'ai_status_unknown'
                        : 'ai_status_safe';

            const formattedReasons = (reasons.length > 0 ? reasons : [t('ai_reason_no_ingredients')])
                .slice(0, 2)
                .map((reason, index) => `${index + 1}. ${emphasizeImportantIngredients(truncateText(reason, 120))}`)
                .join('\n');

            const responseLines = [
                `Product: ${productLabel}`,
                `Suitability: ${t(statusKey)}`,
                `Checks: ${checksForText}`,
                ...(triggersText && (status === 'avoid' || status === 'caution')
                    ? [`Triggers: ${triggersText}`]
                    : []),
                'Reasons:',
                formattedReasons,
                `Ingredients: ${emphasizeImportantIngredients(ingredientPreview)}`,
                `Allergens: ${emphasizeImportantIngredients(allergenPreview)}`,
                'Source: PriceMate'
            ];

            if (!profileHasPersonalization(userAiProfile)) {
                responseLines.push('Tip: Add shopping preferences to personalize future answers.');
            }

            if (user?.$id) {
                const respText = sanitizeAssistantReply(responseLines.join('\n'));
                await addMessage(user.$id, 'assistant', respText, user);
                try {
                    setCachedIntent(intentKey, respText);
                } catch (e) {
                    // caching should never block the user flow
                    console.debug('Intent cache set failed', e);
                }
            }

            setIsLoading(false);
            return;
        }

        // Catalog-only policy: for product-related questions, refuse if the product is not in PriceMate.
        // We use the full-catalog resolver (Appwrite) rather than the in-chat 50-item sample.
        const loweredMessage = String(userMessage || '').toLowerCase();
        const isProductSpecific =
            /\b\d{8,14}\b/.test(loweredMessage) ||
            loweredMessage.includes('ingredient') ||
            loweredMessage.includes('ingredients') ||
            loweredMessage.includes('allergen') ||
            loweredMessage.includes('allergens') ||
            loweredMessage.includes('suitable') ||
            loweredMessage.includes('safe') ||
            loweredMessage.includes('compare') ||
            loweredMessage.includes('cheapest') ||
            loweredMessage.includes('price') ||
            loweredMessage.includes('barcode') ||
            loweredMessage.includes('içerik') ||
            loweredMessage.includes('icerik') ||
            loweredMessage.includes('içindekiler') ||
            loweredMessage.includes('uygun') ||
            loweredMessage.includes('en ucuz') ||
            loweredMessage.includes('fiyat') ||
            loweredMessage.includes('barkod');

        if (isProductSpecific) {
            try {
                const catalogOnly = await resolveCatalogProductForIngredients(userMessage);
                if (!catalogOnly?.product) {
                    if (user?.$id) {
                        await addMessage(user.$id, 'assistant', t('ai_catalog_only_refusal'), user);
                    }
                    setIsLoading(false);
                    return;
                }
            } catch {
                // If catalog lookup fails, fall back to normal behavior rather than blocking all chat.
            }
        }

        try {
            const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

            if (!apiKey) {
                throw new Error("OpenRouter API Key is missing in .env");
            }

            const openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: apiKey,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "PriceMate",
                }
            });

            const promptContext = buildRankedProductContextLines(fullProductList, userMessage, userAiProfile);
            const storeContext = buildSupermarketContextLines(supermarketList, userLocation);
            const storeLocationStatus = isUserLocationAvailableForStores(userLocation)
                ? 'available (distances in NEARBY STORES are precomputed; do not invent km values)'
                : `unavailable (${t('ai_chat_location_needed_for_distance', 'Ask the user to enable browser location to sort stores by distance.')})`;
            const intentSummary = buildIntentSummary(userMessage);
            const aiProfileContext = formatAiProfileForPrompt(userAiProfile);
            const maxGenericReplyWords = userAiProfile.responseStyle === 'detailed'
                ? 110
                : userAiProfile.responseStyle === 'concise'
                    ? 45
                    : 60;

            const prompt = `
                You are the official PriceMate assistant. Your primary goal is to help users find products and compare prices.

                RESPONSE RULES (STRICT):
                - Answer the latest user intent directly.
                - Do not repeat the user's exact sentence or echo the same question back.
                - If the same intent already appears earlier in the chat history, do not ask the user to repeat it.
                - Use the token summary below to understand the request, not to paraphrase it.
                - Keep normal replies concise: maximum 4 short lines or about ${maxGenericReplyWords} words.
                - No filler, no long intros, no repeated disclaimers.

                USER AI SHOPPING PROFILE:
                ${aiProfileContext}
                - Use these preferences to rank suggestions and tailor tone.
                - Dietary preferences are preferences, not allergy safety verdicts.
                - If no optional profile preferences are saved, add at most one short line: "Add shopping preferences to personalize future answers."
                
                WEBSITE PRODUCT DATA (sample; catalog has many more items):
                ${promptContext}

                NEARBY STORES (PriceMate supermarkets; sorted by distance when user location is available):
                User location for distance sorting: ${storeLocationStatus}
                ${storeContext}

                STORE LOCATION RULES:
                - When the user asks for the closest/nearest store, nearest branch, or "near me", use NEARBY STORES order.
                - Name the top 1–3 matches with distance when listed; do not invent distances.
                - If user location is unavailable, tell them to enable location in the browser; list stores without inventing km values.
                - When mentioning a specific store, include [STORE:<id>] from NEARBY STORES (same pattern as [BARCODE:...]).
                - Do not invent stores or coordinates not listed in NEARBY STORES.

                CLOSEST + CHEAPEST:
                - When the user wants the nearest store, closest option, or cheapest price, name the product first (ask if missing).
                - Combine NEARBY STORES (distance) with WEBSITE PRODUCT DATA (price): prefer a store that is reasonably close and has a low price.
                - Give one clear recommendation in 1–2 sentences, then at most two alternatives with store name, price, and distance when known.

                COMPARE / RANK BY PRICE:
                - When the user wants to compare or rank supermarkets for one product, use only prices from WEBSITE PRODUCT DATA.
                - List supermarkets for that product from cheapest to most expensive (up to 5 lines), e.g. "1. Store — 12.50 TRY [STORE:id]".
                - If the product is unclear, ask which product before ranking.

                PRODUCT + STORE RULES:
                - When mentioning a product that has prices in WEBSITE PRODUCT DATA, always name the supermarket for the price you cite (e.g. "at Migros").
                - For "cheapest" answers, use the lowest-price store from the data; do not invent store names.
                - Prefer a short sentence plus [BARCODE:...]; include the store name in the sentence when stating a price.
                - Treat minor spelling, spacing, and brand shorthand as the same product when WEBSITE PRODUCT DATA or a resolved barcode indicates a match (e.g. "coco cola", "coca cola", "coke" → Coca-Cola).
                - Do not ask the user to re-type the brand if a catalog product was already resolved in the message context.
                - If no reasonable catalog match exists, ask for a barcode or a more specific product name—do not guess.

                PRODUCT LIMITS (STRICT):
                - Mention at most three [BARCODE:...] products per reply.
                - Never dump long lists. If the request is broad (category, "cheapest X", "show me Y") and many items could match,
                  choose only the best few matches from WEBSITE PRODUCT DATA above, then add one short friendly sentence inviting the user
                  to narrow down (brand, exact name, pack size, or barcode) so you can refine—warm tone, not lecturing.
                - If nothing in the sample fits well, say so briefly and ask them be more specific instead of inventing barcodes.

                INGREDIENT / NUTRITION QUESTIONS:
                - When the user names a product (e.g. Coca-Cola), look it up in WEBSITE PRODUCT DATA first and use its [BARCODE:...] line.
                - For questions like "is the sugar high?", "how much salt?", or "is it high in caffeine?", answer using that product's barcode:
                  tie the answer to the catalog match when possible instead of asking which health condition they mean.
                - If the product is not available in the PriceMate catalog, refuse and ask the user to ask about an available product (or share its barcode).
                - If the data is insufficient for a nutrient, say unknown and suggest scanning or checking the label.

                RESPONSE FORMAT FOR INGREDIENT IMPACT QUESTIONS:
                Product: <name + [BARCODE:...]>
                Suitability: <Likely suitable | Use caution | Not suitable | Unknown>
                Checks For: <short list>
                Reasons: <at most 2 short points>
                Ingredients: <brief ingredient summary>
                Allergens: <brief allergen summary>
                Source: PriceMate

                INSTRUCTIONS:
                1. Answer questions about products, prices, shopping, and ingredient suitability within the PriceMate app.
                2. If the user asks about something unrelated, politely say you only assist with product-related queries.
                3. Recommend specific products using the data provided—respect the PRODUCT LIMITS above.
                4. If the user asks for "cheapest" or "best deal", highlight at most a few; for "compare" or "rank", use a numbered cheapest-first list (see COMPARE / RANK BY PRICE).
                5. If the user asks for "most expensive" or "premium", highlight at most a few; do not list everything.
                6. For category-style questions, suggest at most three relevant items from the sample, then briefly ask the user to be more specific if the catalog is huge.
                7. For every product you mention, you must include its barcode ID in square brackets like this: [BARCODE:123456].
                8. Do not use [ID:123456], only use the word BARCODE in the brackets.
                9. Do not put punctuation (especially a period) immediately after [BARCODE:...] or [STORE:...]—the app shows a product card there.
                10. Minimize text. Do not describe features or give long intros. Just a short sentence and the barcode(s).
                11. Do not repeat price lists (e.g., "- Store: X TRY"). The UI will show the card automatically.
                12. Use the exact product names from the context.
                13. If ingredient suitability data is provided, summarize it briefly and do not refuse to answer.
                14. If you are unsure, ask the user for the barcode or exact product name instead of giving a generic refusal.
                15. For ingredient safety answers, treat Open Food Facts as the source of truth and mention it in the source line.
                16. Never restate the full user question; keep the answer short and direct.
            `;

            const resolvedDisplayName =
                catalogDisplayName ||
                localProductMatch?.matchedName ||
                mergedProductProfile?.name ||
                mergedProductProfile?.productName ||
                '';
            let openRouterMessage = `Intent: ${intentSummary || userMessage}`;
            if (effectiveBarcode) {
                openRouterMessage += `\nKnown barcode: [BARCODE:${effectiveBarcode}]`;
            }
            if (resolvedDisplayName && effectiveBarcode) {
                openRouterMessage += `\nResolved catalog product: ${resolvedDisplayName} [BARCODE:${effectiveBarcode}]`;
            }

            const threadForApi = useChatStore
                .getState()
                .messages;
            if (
                threadForApi.length > 0 &&
                threadForApi[threadForApi.length - 1].role === 'user'
            ) {
                threadForApi[threadForApi.length - 1] = {
                    role: 'user',
                    content: openRouterMessage,
                };
            }

            const boundedThread = buildThreadForApi(threadForApi, {
                maxMessages: 18,
                maxCharsPerMessage: 1200,
            });

            const completion = await openai.chat.completions.create({
                model: "google/gemini-2.0-flash-001",
                messages: [{ role: "system", content: clampText(prompt, 12000) }, ...boundedThread],
            });

            const text = completion.choices[0]?.message?.content || "No response received.";
            const sanitizedText = sanitizeAssistantReply(text);

            if (user?.$id) {
                await addMessage(user.$id, 'assistant', sanitizedText, user);
                try {
                    setCachedIntent(intentKey, sanitizedText);
                } catch (e) {
                    console.debug('Intent cache set failed', e);
                }
            }
        } catch (error) {
            const detail = extractOpenRouterError(error);
            console.error("AI Error details:", error, detail);
            let errorMessage = "Sorry, I can't connect to the AI right now. ";
            if (detail.message?.includes("API Key") || detail.message?.includes("api key")) {
                errorMessage += "There's an issue with the API Key configuration.";
            } else if (detail.status === 401 || detail.status === 403) {
                errorMessage += "Authentication failed (API key / referer).";
            } else if (detail.status === 400) {
                errorMessage += "Request rejected (bad request / model / prompt too large).";
            } else if (detail.status === 413) {
                errorMessage += "Request too large. Please try a shorter message.";
            } else if (detail.status === 429) {
                errorMessage += "Rate limit exceeded. Please wait a moment.";
            } else if (!detail.status && /failed to fetch|networkerror|load failed/i.test(detail.message || '')) {
                errorMessage += "Network/CORS blocked the request from the browser.";
            } else {
                errorMessage += "Please try again in a few moments.";
            }

            if (AI_DEBUG) {
                const bits = [
                    detail.status ? `status=${detail.status}` : null,
                    detail.code ? `code=${detail.code}` : null,
                    detail.provider ? `provider=${detail.provider}` : null,
                ].filter(Boolean);
                errorMessage += `\n(Debug) ${bits.join(' ')}\n(Debug) ${clampText(detail.message, 220)}`;
            }
            
            if (user?.$id) {
                await addMessage(user.$id, 'assistant', errorMessage, user);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const effectiveOnClose = typeof onClose === 'function' ? onClose : () => {};
    const composerPadClass = isPage
        ? 'px-4 py-3 sm:px-5 sm:py-4'
        : 'px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px)+var(--bottom-nav-h,0px))] sm:px-5 sm:py-4';

    const composerMobileBottom = iosFixedChrome
        ? 'max-md:bottom-[calc(var(--bottom-nav-h,0px)+env(safe-area-inset-bottom,0px)+var(--keyboard-inset-bottom,0px))]'
        : '';

    const composerStackClass = isPage
        ? iosFixedChrome
            ? `shrink-0 border-t border-gray-100/80 dark:border-gray-700/50 max-md:fixed max-md:inset-x-0 max-md:z-[10000] ${composerMobileBottom} max-md:bg-white max-md:dark:bg-gray-900 ${mobileListOpen ? 'max-md:hidden' : ''}`
            : `shrink-0 border-t border-gray-100/80 dark:border-gray-700/50 ${mobileListOpen ? 'max-md:hidden' : ''}`
        : 'shrink-0';

    const composerFormClass = isPage
        ? `${composerPadClass} max-md:bg-white max-md:dark:bg-gray-900 border-t border-gray-100/80 dark:border-gray-700/50 sm:bg-white sm:dark:bg-gray-800 sm:border-gray-100 sm:dark:border-gray-700`
        : `${composerPadClass} bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700`;

    const handleComposerFocus = () => {
        composerFocusedRef.current = true;
        setComposerFocused(true);
        requestAnimationFrame(() => scrollMessagesToBottom());
    };

    const handleComposerBlur = () => {
        composerFocusedRef.current = false;
        setComposerFocused(false);
    };

    const renderConversationList = (afterPick) => {
        if (!user?.$id) return null;
        return (
            <div className="flex flex-col h-full min-h-0 bg-gray-100 dark:bg-gray-900/80">
                <div className="flex-1 overflow-y-auto p-3 sm:p-2 space-y-2.5 sm:space-y-2">
                    {summariesLoading && conversationRows.length === 0 ? (
                        <div className="flex justify-center p-4">
                            <FiLoader className="animate-spin text-brand-600" />
                        </div>
                    ) : (
                        conversationRows.map((row) => {
                            const selected = row.id === activeConversationId;
                            return (
                                <div
                                    key={row.id}
                                    className={`group relative rounded-2xl border ${
                                        selected
                                            ? 'border-brand-500 bg-white dark:bg-gray-800 shadow-sm'
                                            : 'border-transparent bg-transparent hover:bg-white/60 dark:hover:bg-gray-800/60'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!row.isDraft) {
                                                fetchMessagesForConversation(user.$id, row.id);
                                            }
                                            afterPick?.();
                                        }}
                                        className="w-full min-h-16 sm:min-h-14 text-left p-4 pr-11 sm:p-3 sm:pr-9"
                                    >
                                        <span className="block text-[13px] sm:text-[12px] font-black text-gray-900 dark:text-white line-clamp-2 leading-tight">
                                            {labelForRow(row)}
                                        </span>
                                    </button>
                                    {!row.isDraft && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(t('ai_chat_delete_confirm'))) {
                                                    deleteConversation(user.$id, row.id);
                                                    afterPick?.();
                                                }
                                            }}
                                            className="absolute right-2 top-1/2 min-h-10 min-w-10 -translate-y-1/2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-80 group-hover:opacity-100 flex items-center justify-center"
                                            aria-label={t('ai_chat_delete_thread')}
                                        >
                                            <FiTrash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {!isPage && (
                <div
                    className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px] sm:hidden"
                    onClick={effectiveOnClose}
                    aria-hidden="true"
                />
            )}
            <div
                className={
                    isPage
                        ? 'w-full flex flex-col flex-1 h-full min-h-0 overflow-hidden'
                        : 'fixed bottom-0 left-0 right-0 z-[9999] flex h-[85dvh] max-h-[85dvh] w-full touch-pan-y flex-col overflow-hidden rounded-t-2xl border-0 bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300 dark:border-gray-700 dark:bg-gray-800 sm:inset-auto sm:bottom-4 sm:right-4 sm:z-[2000] sm:h-[min(640px,90vh)] sm:max-h-none sm:w-[400px] sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-2xl sm:slide-in-from-bottom-5 sm:slide-in-from-right md:w-[448px]'
                }
            >
            <ChatScreenHeader
                variant={isPage ? 'page' : 'drawer'}
                title={t('ai_chat_title', 'PriceMate AI')}
                subtitle={t('ai_chat_subtitle', 'Compare prices and ingredients.')}
                poweredByLabel={t('ai_chat_powered_by', 'Powered by Gemini')}
                user={user}
                onOpenList={() => setMobileListOpen(true)}
                onNewChat={beginNewConversation}
                onClose={effectiveOnClose}
                showDragHandle={!isPage}
                headerRef={headerRef}
                t={t}
            />

            <div className="flex flex-1 min-h-0">
                {user && (
                    <aside className="hidden sm:flex w-[7.25rem] shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 min-h-0">
                        {renderConversationList()}
                    </aside>
                )}

                <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
                    {user && mobileListOpen && (
                        <div className="absolute inset-0 z-20 flex flex-col sm:hidden bg-white dark:bg-gray-800">
                            <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
                                <button
                                    type="button"
                                    onClick={() => setMobileListOpen(false)}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                                    aria-label={t('ai_chat_back')}
                                >
                                    <FiChevronLeft size={22} />
                                </button>
                                <span className="font-black text-sm uppercase tracking-widest text-gray-700 dark:text-gray-200">
                                    {t('ai_chat_chats')}
                                </span>
                                <div className="ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => { beginNewConversation(); setMobileListOpen(false); }}
                                        className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700"
                                        aria-label={t('ai_chat_new')}
                                    >
                                        <FiPlus size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-hidden">{renderConversationList(() => setMobileListOpen(false))}</div>
                        </div>
                    )}

                    <div className="relative flex-1 min-h-0 flex flex-col">
                    <div
                        ref={messagesScrollRef}
                        className={
                            isPage
                                ? iosFixedChrome
                                    ? 'flex-1 overflow-y-auto overscroll-contain px-4 pt-2.5 pb-3 space-y-3.5 bg-gray-50 dark:bg-gray-900 min-h-0 max-md:pt-[var(--mobile-ai-header-h,4.5rem)] max-md:pb-[calc(var(--mobile-ai-composer-h,5.5rem)+var(--keyboard-inset-bottom,0px))]'
                                    : 'flex-1 overflow-y-auto overscroll-contain scroll-pb-[var(--mobile-ai-composer-h,5.5rem)] px-4 pt-2.5 pb-3 max-md:pb-[var(--mobile-ai-composer-h,5.5rem)] space-y-3.5 bg-gray-50 dark:bg-gray-900 min-h-0'
                                : 'flex-1 overflow-y-auto overscroll-contain scroll-pb-[calc(var(--bottom-nav-h,0px)+7.5rem)] px-4 pt-2.5 pb-[calc(0.875rem+var(--bottom-nav-h,0px))] sm:px-5 sm:pt-3 sm:pb-[calc(1rem+var(--bottom-nav-h,0px))] space-y-3.5 bg-gray-50 dark:bg-gray-900 min-h-0'
                        }
                    >
                        {!user && (
                            <div className="p-4 rounded-[1.5rem] bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-center">
                                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                                    {t('ai_chat_login_hint', 'Log in to save your chat history and get personalized recommendations.')}
                                </p>
                            </div>
                        )}
                        {user && !activeConversationId && summariesLoading && (
                            <div className="flex justify-center py-12">
                                <FiLoader className="animate-spin text-brand-600" />
                            </div>
                        )}
                        {showQuickPrompts && renderQuickPromptSuggestions(!activeConversationId)}
                        {user && activeConversationId && historyLoading && (
                            <div className="flex justify-center py-12">
                                <FiLoader className="animate-spin text-brand-600" />
                            </div>
                        )}
                        {user && activeConversationId && !historyLoading && !showQuickPrompts && (
                            <>
                                {history.map((msg, idx) => (
                                    <ChatMessage
                                        key={msg.$id || idx}
                                        msg={msg}
                                        convert={convert}
                                        getCurrencySymbol={getCurrencySymbol}
                                        allProducts={fullProductList}
                                        allSupermarkets={supermarketList}
                                        t={t}
                                    />
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none">
                                            <FiLoader className="animate-spin text-brand-600" />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {!isPage && (
                            <div
                                className="sticky bottom-0 z-[1] -mt-20 h-20 pointer-events-none bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent dark:from-gray-900 dark:via-gray-900/90"
                                aria-hidden
                            />
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div
                        ref={composerStackRef}
                        data-testid="ai-chat-composer-stack"
                        className={composerStackClass}
                    >
                        {user && chatWriteError && (
                            <div className={`shrink-0 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800/40 flex gap-2 items-start justify-between ${isPage ? 'max-md:bg-red-50 max-md:dark:bg-red-900/20' : 'max-md:pricemate-ai-composer-overlay'}`}>
                                <p className="text-xs text-red-800 dark:text-red-200 flex-1 leading-relaxed">
                                    {chatWriteError === CHAT_ERROR_MISSING_CONVERSATION_ID
                                        ? t('chat_error_schema_conversation_id')
                                        : chatWriteError}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => clearChatWriteError()}
                                    className="text-xs font-bold text-red-700 dark:text-red-300 shrink-0 px-1"
                                    aria-label={t('chat_error_dismiss')}
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        <form
                            ref={formRef}
                            onSubmit={handleSend}
                            data-testid="ai-chat-composer-form"
                            className={composerFormClass}
                        >
                            <div className="relative flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    data-ai-composer-input
                                    rows={1}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onFocus={handleComposerFocus}
                                    onBlur={handleComposerBlur}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            formRef.current?.requestSubmit();
                                        }
                                    }}
                                placeholder={
                                    !user
                                        ? t('ai_chat_login_placeholder')
                                        : t('ai_chat_input_placeholder')
                                }
                                disabled={isLoading || !user}
                                    className="flex-1 max-h-32 min-h-12 resize-none bg-gray-50 dark:bg-gray-900 border-none rounded-[1.25rem] py-3.5 px-4 text-[16px] sm:text-sm leading-6 sm:leading-5 focus:ring-2 focus:ring-brand-500 transition-all dark:text-white disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                disabled={
                                    !input.trim() || isLoading || !user
                                }
                                    className="min-h-12 min-w-12 bg-brand-600 hover:bg-brand-700 text-white px-4 rounded-[1.15rem] transition-all active:scale-90 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-brand-200 dark:shadow-none flex items-center justify-center"
                                >
                                    <FiSend />
                                </button>
                            </div>
                        </form>
                    </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default AIChatBox;
