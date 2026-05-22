import { useState, useEffect, useRef } from 'react';
import { FiX, FiSend, FiMessageSquare, FiLoader, FiExternalLink, FiPackage, FiShoppingBag, FiPlus, FiTrash2, FiChevronLeft } from 'react-icons/fi';
import OpenAI from "openai";
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    fetchProducts,
    fetchAllPrices,
    fetchIngredientsByBarcode,
    searchIngredientsByName,
    resolveCatalogProductForIngredients,
    ingredientPayloadFromAppwriteProduct,
    fetchOffCacheSnapshot,
    normalizeOffCacheDoc,
    resolveOffCacheProductForIngredients,
    ingredientPayloadFromOffCache,
} from '../utils/productUtils';
import useCurrencyStore from '../stores/currencyStore';
import useAuthStore from '../stores/authStore';
import useChatStore, { CHAT_ERROR_MISSING_CONVERSATION_ID } from '../stores/chatStore';

const ChatMessage = ({ msg, convert, getCurrencySymbol, allProducts = [] }) => {
    const renderContent = (content) => {
        // First step: CLEANING
        // 1. Remove redundancy: remove lines that the cards will handle
        let text = content;
        
        // Remove individual price points followed by TRY/TL/₺
        text = text.replace(/^(?:\s*)(?:[-•*]\s?.*:\s*\d+(?:\.\d+)?\s*(?:TRY|TL|₺)\s*\n?)+/gm, '');
        
        // Remove lead-in sentences for removed lists
        text = text.replace(/(?:The prices are:|Prices are:|Available at:)\s*\n?/gi, '');
        
        // Remove empty lines created by removals
        text = text.replace(/\n\s*\n/g, '\n').trim();

        // 2. PARSING TAGS
        const barcodeRegex = /\[(?:BARCODE|ID):([\w\d-]+)\]/g;
        const parts = text.split(barcodeRegex);
        
        const isMostExpensiveRequest = text.toLowerCase().includes('most expensive') || text.toLowerCase().includes('pahalı');
        const isCheapestRequest = text.toLowerCase().includes('cheapest') || text.toLowerCase().includes('en ucuz');

        return parts.map((part, i) => {
            if (i % 2 === 0) {
                return part;
            } else {
                const barcode = part;
                const product = allProducts.find(p => p.barcode === barcode);

                if (product) {
                    const sortedPrices = [...(product.prices || [])].sort((a, b) => a.price - b.price);
                    const lowestPrice = sortedPrices.length > 0 ? sortedPrices[0] : null;
                    const highestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : null;
                    
                    const priceToShow = isMostExpensiveRequest ? highestPrice : lowestPrice;
                    const badgeText = isMostExpensiveRequest ? "Most Expensive" : (isCheapestRequest ? "Cheapest" : null);
                    const badgeColor = isMostExpensiveRequest ? "bg-red-600" : "bg-green-600";

                    return (
                        <Link 
                            key={i}
                            to={`/price-comparison/${barcode}`}
                            className={`block my-2 ${isMostExpensiveRequest ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'} border rounded-xl overflow-hidden hover:shadow-md transition-all group`}
                        >
                            <div className="flex items-center gap-3 p-2.5">
                                <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-900/50">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                    ) : (
                                        <FiPackage className="text-gray-400 text-xl" />
                                    )}
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
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{isMostExpensiveRequest ? 'High:' : 'Best:'}</span>
                                                <span className={`text-base font-black ${isMostExpensiveRequest ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {convert(priceToShow.price, 'TRY')} {getCurrencySymbol()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                <FiShoppingBag className="shrink-0" size={10} />
                                                <span className="truncate max-w-[70px]">
                                                    {Array.isArray(priceToShow.supermarkets) ? priceToShow.supermarkets[0]?.name : (priceToShow.supermarketName || "Store")}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-gray-500 italic">No price info</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                }

                // Fallback to simpler link if product data isn't found
                return (
                    <Link 
                        key={i}
                        to={`/price-comparison/${barcode}`}
                        className="inline-flex items-center gap-0.5 bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded text-xs font-bold underline transition-colors"
                    >
                        View Product <FiExternalLink size={10} />
                    </Link>
                );
            }
        });
    };

    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl ${
                msg.role === 'user' 
                    ? 'bg-brand-600 text-white rounded-tr-none shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none'
            }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {renderContent(msg.content)}
                </div>
            </div>
        </div>
    );
};

const SUGAR_THRESHOLD_G_PER_100G = 22.5;
const SODIUM_THRESHOLD_MG_PER_100G = 600;
const CAFFEINE_THRESHOLD_MG_PER_L = 150;

/** Prefer products that match the user message; fall back to a short sample (prompt cap + relevance). */
const buildRankedProductContextLines = (products, userHint) => {
    const norm = (s) =>
        String(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9ğüşöçı]/gi, ' ');
    const words = new Set(norm(userHint).split(/\s+/).filter((w) => w.length > 2));
    const scored = products.map((p) => {
        const blob = norm(`${p.name || ''} ${p.productName || ''}`);
        let score = 0;
        for (const w of words) {
            if (blob.includes(w)) score++;
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
                    const smName = Array.isArray(pr.supermarkets)
                        ? pr.supermarkets[0]?.name
                        : pr.supermarketName || pr.supermarkets?.name || 'Store';
                    return `${smName}: ${pr.price} TRY`;
                })
                .join(', ');
            const barcodeTag = p.barcode || p.code || p.$id || '';
            const sourceTag = p.is_off_cache || p.is_global ? 'OpenFoodFacts' : 'PriceMate';
            return `- [SOURCE:${sourceTag}] [BARCODE:${barcodeTag}] ${p.name || p.productName}: [${category}] ${priceDetails || 'No current price'}`;
        })
        .join('\n');
};

const AIChatBox = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
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
    const messagesEndRef = useRef(null);

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

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isLoading, activeConversationId, summariesLoading]);

    // Fetch context data (products and prices) to inform the AI
    useEffect(() => {
        const loadContext = async () => {
            try {
                const [products, prices, offCache] = await Promise.all([
                    fetchProducts(50), 
                    fetchAllPrices(),
                    fetchOffCacheSnapshot(20)
                ]);
                
                // Keep the structural product list for the component to use
                const productsWithData = products.map(p => {
                    const productPrices = prices.filter(pr => {
                        const pid = Array.isArray(pr.products) ? pr.products[0]?.$id : (pr.productID || pr.products?.$id);
                        return pid === p.$id;
                    });
                    return { ...p, prices: productPrices };
                });

                const offCacheProducts = (offCache || [])
                    .map((doc) => normalizeOffCacheDoc(doc))
                    .filter(Boolean)
                    .map((p) => ({ ...p, prices: [] }));

                setFullProductList([...productsWithData, ...offCacheProducts]);
            } catch (error) {
                console.error("Error loading chat context:", error);
            }
        };
        loadContext();
    }, []);

    const extractBarcode = (message) => {
        const match = message.match(/\b\d{8,14}\b/);
        return match ? match[0] : null;
    };

    const normalizeProductKey = (value) =>
        String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9ğüşöçı]/gi, '');

    const findProductMatch = (message, extraCandidates = []) => {
        const lowered = message.toLowerCase();
        let best = null;
        let bestLength = 0;
        const nMsg = normalizeProductKey(lowered);

        const consider = (product, scoreLength) => {
            if (scoreLength > bestLength) {
                best = product;
                bestLength = scoreLength;
            }
        };

        const primaryList = fullProductList;
        const secondaryList = Array.isArray(extraCandidates) ? extraCandidates : [];

        primaryList.forEach((product) => {
            const rawName = product.name || product.productName || '';
            const name = rawName.toLowerCase();
            if (!name) return;

            if (lowered.includes(name)) {
                consider(product, name.length);
                return;
            }

            const nName = normalizeProductKey(rawName);
            if (nName.length >= 4 && nMsg.includes(nName)) {
                consider(product, nName.length);
            }
        });

        if (!best && secondaryList.length > 0) {
            secondaryList.forEach((product) => {
                const rawName = product.name || product.productName || '';
                const name = rawName.toLowerCase();
                if (!name) return;

                if (lowered.includes(name)) {
                    consider(product, name.length);
                    return;
                }

                const nName = normalizeProductKey(rawName);
                if (nName.length >= 4 && nMsg.includes(nName)) {
                    consider(product, nName.length);
                }
            });
        }

        if (!best && /\bcoke\b/i.test(lowered)) {
            const cokeMatch =
                primaryList.find((p) => {
                    const n = normalizeProductKey(p.name || p.productName || '');
                    return n.includes('coca') && n.includes('cola');
                }) ||
                primaryList.find((p) =>
                    normalizeProductKey(p.name || p.productName || '').includes('coca')
                );
            if (cokeMatch) best = cokeMatch;
        }

        return best;
    };

    const extractQuotedProduct = (message) => {
        const match = message.match(/["']([^"']{3,})["']/);
        return match ? match[1].trim() : '';
    };

    const detectConditions = (message) => {
        const lowered = message.toLowerCase();
        const conditions = new Set();

        const hasAny = (keywords) => keywords.some((word) => lowered.includes(word));

        if (hasAny(['gluten', 'celiac', 'coeliac', 'çölyak', 'glutensiz'])) {
            conditions.add('gluten');
        }

        if (hasAny(['lactose', 'laktoz', 'dairy', 'süt', 'sut', 'yoğurt', 'yogurt', 'peynir'])) {
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

        const allergyKeywords = ['allergy', 'allergic', 'alerji', 'alerjik'];
        const allergenGroups = [
            { label: 'peanut', terms: ['peanut', 'peanuts', 'yer fıstığı', 'yer fistik', 'fıstık', 'fistik'] },
            { label: 'tree nuts', terms: ['almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'pecan', 'badem', 'ceviz', 'fındık', 'findik', 'kaju', 'antep fıstığı'] },
            { label: 'milk', terms: ['milk', 'dairy', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'süt', 'sut', 'laktoz', 'peynir', 'yoğurt', 'yogurt', 'tereyağ', 'tereyag', 'krema', 'kazein'] },
            { label: 'egg', terms: ['egg', 'eggs', 'yumurta'] },
            { label: 'soy', terms: ['soy', 'soya'] },
            { label: 'wheat', terms: ['wheat', 'buğday', 'bugday', 'gluten', 'barley', 'arpa', 'rye', 'çavdar', 'cavdar', 'malt'] },
            { label: 'fish', terms: ['fish', 'balık', 'balik'] },
            { label: 'shellfish', terms: ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'karides', 'yengeç', 'yengec', 'ıstakoz', 'istakoz'] },
            { label: 'sesame', terms: ['sesame', 'susam'] },
            { label: 'mustard', terms: ['mustard', 'hardal'] },
            { label: 'celery', terms: ['celery', 'kereviz'] },
            { label: 'lupin', terms: ['lupin', 'acı bakla', 'aci bakla'] },
            { label: 'sulfites', terms: ['sulfite', 'sulphite', 'sülfit', 'sulfit'] }
        ];

        const allergenTargets = allergenGroups
            .filter((group) => group.terms.some((term) => lowered.includes(term)))
            .map((group) => group.label);

        if (hasAny(allergyKeywords) || allergenTargets.length > 0) {
            conditions.add('allergy');
        }

        const medicalKeywords = [
            'ingredient', 'ingredients', 'allergen', 'allergens', 'içerik', 'icerik', 'içindekiler', 'suitable', 'uygun', 'safe', 'güvenli',
            'sugar', 'sugary', 'şeker', 'seker', 'sodium', 'sodyum', 'salt', 'tuz', 'caffeine', 'kafein'
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
            'sugar', 'sugary', 'salt', 'sodium', 'caffeine', 'high', 'low', 'level', 'content', 'amount',
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

    const evaluateSuitability = (payload, conditions, allergenTargets) => {
        if (!payload) {
            return {
                status: 'unknown',
                reasons: [t('ai_reason_no_ingredients')]
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
                reasons: [t('ai_reason_no_ingredients')]
            };
        }

        const severityRank = { safe: 0, caution: 1, avoid: 2 };
        let status = 'safe';
        const reasons = [];

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

        const formatThresholdReason = (nutrientLabel, valueText, thresholdText, isHigh) =>
            isHigh
                ? t('ai_reason_above_threshold', { nutrient: nutrientLabel, value: valueText, threshold: thresholdText })
                : t('ai_reason_below_threshold', { nutrient: nutrientLabel, value: valueText, threshold: thresholdText });

        const formatMissingNutrition = (nutrientLabel) =>
            t('ai_reason_nutrition_missing', { nutrient: nutrientLabel });

        if (conditions.includes('allergy')) {
            if (allergenTargets.length > 0) {
                const matches = collectMatches(allergenTargets);
                if (matches.length > 0) {
                    reasons.push(`${t('condition_allergy')}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                    bumpStatus('avoid');
                } else {
                    reasons.push(`${t('condition_allergy')}: ${t('ai_reason_none_found', { items: allergenTargets.join(', ') })}`);
                }
            } else if (payload.allergens?.length > 0) {
                reasons.push(`${t('condition_allergy')}: ${t('ai_reason_found', { items: formatMatches(payload.allergens) })}`);
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
                const thresholdText = `${SUGAR_THRESHOLD_G_PER_100G}g/100g`;
                const isHigh = sugarPer100g >= SUGAR_THRESHOLD_G_PER_100G;
                reasons.push(`${t(labelKey)}: ${formatThresholdReason(t('nutrient_sugar'), valueText, thresholdText, isHigh)}`);
                if (isHigh) bumpStatus('caution');
            } else if (hasIngredientBlob) {
                const matches = collectMatches(sugarTerms);
                if (matches.length > 0) {
                    reasons.push(`${t(labelKey)}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                    bumpStatus('caution');
                } else {
                    reasons.push(`${t(labelKey)}: ${t('ai_reason_none_found', { items: t('nutrient_sugar') })}`);
                }
            } else {
                reasons.push(`${t(labelKey)}: ${formatMissingNutrition(t('nutrient_sugar'))}`);
            }
        }

        if (wantsSodiumCheck) {
            const labelKey = conditions.includes('hypertension') ? 'condition_hypertension' : 'condition_high_sodium';
            if (sodiumMgPer100g !== null && sodiumMgPer100g !== undefined) {
                const valueText = `${Math.round(sodiumMgPer100g)}mg/100g`;
                const thresholdText = `${SODIUM_THRESHOLD_MG_PER_100G}mg/100g`;
                const isHigh = sodiumMgPer100g >= SODIUM_THRESHOLD_MG_PER_100G;
                reasons.push(`${t(labelKey)}: ${formatThresholdReason(t('nutrient_sodium'), valueText, thresholdText, isHigh)}`);
                if (isHigh) bumpStatus('caution');
            } else if (hasIngredientBlob) {
                const matches = collectMatches(sodiumTerms);
                if (matches.length > 0) {
                    reasons.push(`${t(labelKey)}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                    bumpStatus('caution');
                } else {
                    reasons.push(`${t(labelKey)}: ${t('ai_reason_none_found', { items: t('nutrient_sodium') })}`);
                }
            } else {
                reasons.push(`${t(labelKey)}: ${formatMissingNutrition(t('nutrient_sodium'))}`);
            }
        }

        if (wantsCaffeineCheck) {
            const labelKey = 'condition_high_caffeine';
            if (caffeineMgPerL !== null && caffeineMgPerL !== undefined) {
                const valueText = `${Math.round(caffeineMgPerL)}mg/L`;
                const thresholdText = `${CAFFEINE_THRESHOLD_MG_PER_L}mg/L`;
                const isHigh = caffeineMgPerL >= CAFFEINE_THRESHOLD_MG_PER_L;
                reasons.push(`${t(labelKey)}: ${formatThresholdReason(t('nutrient_caffeine'), valueText, thresholdText, isHigh)}`);
                if (isHigh) bumpStatus('caution');
            } else if (hasIngredientBlob) {
                const matches = collectMatches(caffeineTerms);
                if (matches.length > 0) {
                    reasons.push(`${t(labelKey)}: ${t('ai_reason_found', { items: formatMatches(matches) })}`);
                    bumpStatus('caution');
                } else {
                    reasons.push(`${t(labelKey)}: ${t('ai_reason_none_found', { items: t('nutrient_caffeine') })}`);
                }
            } else {
                reasons.push(`${t(labelKey)}: ${formatMissingNutrition(t('nutrient_caffeine'))}`);
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

        return { status, reasons };
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        if (!user?.$id || !activeConversationId) return;

        const userMessage = input.trim();
        setInput('');

        const barcodeFromMessage = extractBarcode(userMessage);
        const productMatch = findProductMatch(userMessage);
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

        const { conditions, allergenTargets, isMedical } = detectConditions(userMessage);

        if (isMedical) {
            if (conditions.length === 0) {
                if (user?.$id) {
                    await addMessage(user.$id, 'assistant', t('ai_need_condition'), user);
                }
                setIsLoading(false);
                return;
            }

            const queryName = buildIngredientQuery(userMessage, mergedProductProfile);

            if (!effectiveBarcode && !queryName && !catalog.product) {
                if (user?.$id) {
                    await addMessage(user.$id, 'assistant', t('ai_need_product'), user);
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

            if (!ingredientPayload) {
                const primarySearch = catalogDisplayName || queryName;
                if (primarySearch) {
                    ingredientPayload = await searchIngredientsByName(primarySearch);
                }
            }

            if (!ingredientPayload && queryName && queryName !== (catalogDisplayName || '')) {
                ingredientPayload = await searchIngredientsByName(queryName);
            }

            if (!ingredientPayload) {
                if (user?.$id) {
                    if (catalog.product) {
                        await addMessage(
                            user.$id,
                            'assistant',
                            t('ai_off_miss_catalog_hit', {
                                name: catalogDisplayName || catalog.product.name || '',
                                barcode: catalog.catalogBarcode || t('ai_barcode_unknown'),
                            }),
                            user
                        );
                    } else {
                        await addMessage(user.$id, 'assistant', t('ai_barcode_not_found'), user);
                    }
                }
                setIsLoading(false);
                return;
            }

            const conditionLabels = conditions.map((condition) => t(`condition_${condition}`));
            const resolvedProductName =
                catalogDisplayName ||
                mergedProductProfile?.name ||
                mergedProductProfile?.productName ||
                '';
            const productLabel = ingredientPayload.barcode
                ? `${ingredientPayload.name} [BARCODE:${ingredientPayload.barcode}]`
                : (resolvedProductName || ingredientPayload.name);

            const ingredientPreview = ingredientPayload.ingredientsText
                ? (ingredientPayload.ingredientsText.length > 220
                    ? `${ingredientPayload.ingredientsText.slice(0, 220)}...`
                    : ingredientPayload.ingredientsText)
                : t('ai_no_ingredients');

            const allergenPreview = ingredientPayload.allergens?.length
                ? ingredientPayload.allergens.slice(0, 6).join(', ')
                : t('ai_no_allergens');

            const { status, reasons } = evaluateSuitability(ingredientPayload, conditions, allergenTargets);
            const sourceText =
                ingredientPayload.source === 'PriceMate'
                    ? ingredientPayload.nutritionSourceLabel
                        ? `${t('ai_source_pricemate')}: ${ingredientPayload.nutritionSourceLabel}`
                        : t('ai_source_pricemate')
                    : ingredientPayload.barcode
                      ? `Open Food Facts - ${ingredientPayload.sourceUrl}`
                      : `Open Food Facts search result - ${ingredientPayload.sourceUrl}`;

            const statusKey = status === 'avoid'
                ? 'ai_status_avoid'
                : status === 'caution'
                    ? 'ai_status_caution'
                    : status === 'unknown'
                        ? 'ai_status_unknown'
                        : 'ai_status_safe';

            const responseLines = [
                t('ai_suitability_title'),
                `${t('ai_product')}: ${productLabel}`,
                `${t('ai_checks_for', { conditions: conditionLabels.join(', ') })}`,
                `${t('ai_suitability')}: ${t(statusKey)}`,
                `${t('ai_reasons')}: ${reasons.join(' | ')}`,
                `${t('ai_ingredients')}: ${ingredientPreview}`,
                `${t('ai_allergens')}: ${allergenPreview}`,
                `${t('ai_source')}: ${sourceText}`,
                `${t('ai_note')}: ${t('ai_note_text')}`
            ];

            if (user?.$id) {
                await addMessage(user.$id, 'assistant', responseLines.join('\n'), user);
            }

            setIsLoading(false);
            return;
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

            const promptContext = buildRankedProductContextLines(fullProductList, userMessage);

            const prompt = `
                You are the official PriceMate assistant. Your primary goal is to help users find products and compare prices.
                
                WEBSITE PRODUCT DATA (sample; catalog has many more items):
                ${promptContext}

                PRODUCT LIMITS (STRICT):
                - Mention at most five [BARCODE:...] products per reply; prefer one to three when possible.
                - Never dump long lists. If the request is broad (category, "cheapest X", "show me Y") and many items could match,
                  choose only the best few matches from WEBSITE PRODUCT DATA above, then add one short friendly sentence inviting the user
                  to narrow down (brand, exact name, pack size, or barcode) so you can refine—warm tone, not lecturing.
                - If nothing in the sample fits well, say so briefly and ask them be more specific instead of inventing barcodes.

                INGREDIENT / NUTRITION QUESTIONS:
                - When the user names a product (e.g. Coca-Cola), look it up in WEBSITE PRODUCT DATA first and use its [BARCODE:...] line.
                - For questions like "is the sugar high?", "how much salt?", or "is it high in caffeine?", answer using that product's barcode:
                  tie the answer to the catalog match when possible instead of asking which health condition they mean.
                - If the product is not in WEBSITE PRODUCT DATA, ask for a barcode or a clearer product name—not a generic "what condition?" prompt.
                - If the data is insufficient for a nutrient, say unknown and suggest scanning or checking the label.

                RESPONSE FORMAT FOR INGREDIENT IMPACT QUESTIONS:
                Suitability: <Likely suitable | Use caution | Not suitable | Unknown>
                Reasons: <short reasons based on ingredients/allergens/nutrition>
                Ingredients: <brief ingredient summary>
                Allergens: <brief allergen summary>
                Source: <product barcode or source used>

                INSTRUCTIONS:
                1. Answer questions about products, prices, shopping, and ingredient suitability within the PriceMate app.
                2. If the user asks about something unrelated, politely say you only assist with product-related queries.
                3. Recommend specific products using the data provided—respect the PRODUCT LIMITS above.
                4. If the user asks for "cheapest" or "best deal", highlight at most a few; do not list everything.
                5. If the user asks for "most expensive" or "premium", highlight at most a few; do not list everything.
                6. For category-style questions, suggest at most five relevant items from the sample, then briefly ask the user to be more specific if the catalog is huge.
                7. For every product you mention, you must include its barcode ID in square brackets like this: [BARCODE:123456].
                8. Do not use [ID:123456], only use the word BARCODE in the brackets.
                9. Minimize text. Do not describe features or give long intros. Just a short sentence and the barcode(s).
                10. Do not repeat price lists (e.g., "- Store: X TRY"). The UI will show the card automatically.
                11. Use the exact product names from the context.
                12. If ingredient suitability data is provided, summarize it briefly and do not refuse to answer.
                13. If you are unsure, ask the user for the barcode or exact product name instead of giving a generic refusal.
                14. For ingredient safety answers, treat Open Food Facts as the source of truth and mention it in the source line.
            `;

            const openRouterMessage = effectiveBarcode && !barcodeFromMessage
                ? `${userMessage}\nKnown barcode: [BARCODE:${effectiveBarcode}]`
                : userMessage;

            const threadForApi = useChatStore
                .getState()
                .messages.map((m) => ({ role: m.role, content: m.content }));
            if (
                threadForApi.length > 0 &&
                threadForApi[threadForApi.length - 1].role === 'user'
            ) {
                threadForApi[threadForApi.length - 1] = {
                    role: 'user',
                    content: openRouterMessage,
                };
            }

            const completion = await openai.chat.completions.create({
                model: "google/gemini-2.0-flash-001",
                messages: [{ role: "system", content: prompt }, ...threadForApi],
            });

            const text = completion.choices[0]?.message?.content || "No response received.";

            if (user?.$id) {
                await addMessage(user.$id, 'assistant', text, user);
            }
        } catch (error) {
            console.error("AI Error details:", error);
            let errorMessage = "Sorry, I can't connect to the AI right now. ";
            if (error.message?.includes("API Key")) {
                errorMessage += "There's an issue with the API Key configuration.";
            } else if (error.status === 429) {
                errorMessage += "Rate limit exceeded. Please wait a moment.";
            } else {
                errorMessage += "Please try again in a few moments.";
            }
            
            if (user?.$id) {
                await addMessage(user.$id, 'assistant', errorMessage, user);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderConversationList = (afterPick) => {
        if (!user?.$id) return null;
        return (
            <div className="flex flex-col h-full min-h-0 bg-gray-100 dark:bg-gray-900/80">
                <div className="p-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            startNewConversation();
                            afterPick?.();
                        }}
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-lg bg-brand-600 text-white text-[10px] font-black uppercase tracking-wide"
                    >
                        <FiPlus size={14} />
                        {t('ai_chat_new_short')}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
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
                                    className={`group relative rounded-lg border ${
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
                                        className="w-full text-left p-2 pr-7"
                                    >
                                        <span className="block text-[10px] font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">
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
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-70 group-hover:opacity-100"
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
            <div
                className="fixed inset-0 z-[1990] bg-black/40 backdrop-blur-[2px] sm:hidden"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="fixed inset-x-0 bottom-0 z-[2000] flex h-[min(92dvh,760px)] flex-col overflow-hidden rounded-t-[2rem] border border-gray-200 bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300 dark:border-gray-700 dark:bg-gray-800 sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(640px,90vh)] sm:w-[400px] sm:rounded-2xl md:w-[448px] sm:border sm:shadow-2xl sm:slide-in-from-bottom-5 sm:slide-in-from-right">
            <div className="p-4 sm:p-5 bg-brand-600 dark:bg-brand-700 text-white flex justify-between items-center shrink-0 shadow-md gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {user && (
                        <button
                            type="button"
                            className="sm:hidden p-2 hover:bg-white/20 rounded-xl shrink-0"
                            onClick={() => setMobileListOpen(true)}
                            aria-label={t('ai_chat_chats')}
                        >
                            <FiMessageSquare size={20} />
                        </button>
                    )}
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm shrink-0 hidden sm:flex">
                        <FiMessageSquare className="text-xl" />
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold block text-sm truncate">PriceMate AI</span>
                        <span className="text-[10px] opacity-80 uppercase tracking-widest font-black truncate block">
                            Powered by Gemini
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-95 shrink-0"
                    aria-label={t('ai_chat_close')}
                >
                    <FiX size={24} />
                </button>
            </div>

            <div className="flex flex-1 min-h-0">
                {user && (
                    <aside className="hidden sm:flex w-[7.25rem] shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 min-h-0">
                        {renderConversationList()}
                    </aside>
                )}

                <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
                    {user && mobileListOpen && (
                        <div className="absolute inset-0 z-20 flex flex-col sm:hidden bg-white dark:bg-gray-800">
                            <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setMobileListOpen(false)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                    aria-label={t('ai_chat_back')}
                                >
                                    <FiChevronLeft size={22} />
                                </button>
                                <span className="font-bold text-sm">{t('ai_chat_chats')}</span>
                            </div>
                            <div className="flex-1 min-h-0 overflow-hidden">{renderConversationList(() => setMobileListOpen(false))}</div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-0">
                        {!user && (
                            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-center">
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    Log in to save your chat history and get personalized recommendations!
                                </p>
                            </div>
                        )}
                        {user && !activeConversationId && (
                            summariesLoading ? (
                                <div className="flex justify-center py-12">
                                    <FiLoader className="animate-spin text-brand-600" />
                                </div>
                            ) : (
                                <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 mx-auto max-w-sm">
                                    {t('ai_chat_idle_hint')}
                                </div>
                            )
                        )}
                        {user && activeConversationId && historyLoading && (
                            <div className="flex justify-center py-12">
                                <FiLoader className="animate-spin text-brand-600" />
                            </div>
                        )}
                        {user && activeConversationId && !historyLoading && (
                            <>
                                {history.length === 0 && !isLoading && (
                                    <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                                        {t('ai_chat_thread_empty')}
                                    </p>
                                )}
                                {history.map((msg, idx) => (
                                    <ChatMessage
                                        key={msg.$id || idx}
                                        msg={msg}
                                        convert={convert}
                                        getCurrencySymbol={getCurrencySymbol}
                                        allProducts={fullProductList}
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
                        <div ref={messagesEndRef} />
                    </div>

                    {user && chatWriteError && (
                        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800/40 flex gap-2 items-start justify-between">
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
                        onSubmit={handleSend}
                        className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0"
                    >
                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={
                                    !user
                                        ? t('ai_chat_login_placeholder')
                                        : !activeConversationId
                                          ? t('ai_chat_placeholder_no_thread')
                                          : t('ai_chat_input_placeholder')
                                }
                                disabled={isLoading || !user || !activeConversationId}
                                className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-brand-500 transition-all dark:text-white disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={
                                    !input.trim() || isLoading || !user || !activeConversationId
                                }
                                className="bg-brand-600 hover:bg-brand-700 text-white p-3 rounded-xl transition-all active:scale-90 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-brand-200 dark:shadow-none"
                            >
                                <FiSend />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        </>
    );
};

export default AIChatBox;
