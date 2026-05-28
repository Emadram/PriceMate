import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    FiGlobe,
    FiMoon,
    FiSun,
    FiShield,
    FiShoppingBag,
    FiPlus,
    FiX,
} from 'react-icons/fi';

import useAuthStore from '../stores/authStore';
import useCurrencyStore from '../stores/currencyStore';
import useThemeStore from '../stores/themeStore';
import useSupermarketsStore from '../stores/supermarketsStore';
import BackButton from '../components/BackButton';
import { MobileHeader, MobilePage } from '../components/MobilePageLayout';
import {
    AI_PROFILE_DEFAULTS,
    normalizeAiProfile,
    readStoredAiProfile,
    readStoredAllergyProfile,
} from '../utils/aiCheckUtils';

const ALLERGY_OPTIONS = [
    { id: 'milk', labelKey: 'allergy_option_milk' },
    { id: 'lactose', labelKey: 'allergy_option_lactose' },
    { id: 'gluten', labelKey: 'allergy_option_gluten' },
    { id: 'peanut', labelKey: 'allergy_option_peanut' },
    { id: 'tree nuts', labelKey: 'allergy_option_tree_nuts' },
    { id: 'soy', labelKey: 'allergy_option_soy' },
    { id: 'egg', labelKey: 'allergy_option_egg' },
    { id: 'fish', labelKey: 'allergy_option_fish' },
    { id: 'shellfish', labelKey: 'allergy_option_shellfish' },
    { id: 'sesame', labelKey: 'allergy_option_sesame' },
];

const DIETARY_OPTIONS = [
    { id: 'vegetarian', labelKey: 'diet_vegetarian' },
    { id: 'vegan', labelKey: 'diet_vegan' },
    { id: 'halal', labelKey: 'diet_halal' },
    { id: 'kosher', labelKey: 'diet_kosher' },
];

const NUTRITION_OPTIONS = [
    { id: 'low sugar', labelKey: 'nutrition_low_sugar' },
    { id: 'low sodium', labelKey: 'nutrition_low_sodium' },
    { id: 'low caffeine', labelKey: 'nutrition_low_caffeine' },
    { id: 'high protein', labelKey: 'nutrition_high_protein' },
];

const BUDGET_OPTIONS = [
    { id: 'lowest_price', labelKey: 'budget_lowest_price' },
    { id: 'balanced', labelKey: 'budget_balanced' },
    { id: 'quality_first', labelKey: 'budget_quality_first' },
];

const RESPONSE_STYLE_OPTIONS = [
    { id: 'concise', labelKey: 'response_concise' },
    { id: 'balanced', labelKey: 'response_balanced' },
    { id: 'detailed', labelKey: 'response_detailed' },
];

const Settings = () => {
    const { t, i18n } = useTranslation();
    const {
        user,
        updateUiPreferences,
        updateAllergyPreferences,
        updateAiProfilePreferences,
    } = useAuthStore();
    const { currency, setCurrency } = useCurrencyStore();
    const { theme, toggleTheme } = useThemeStore();
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();

    const [allergyPrefs, setAllergyPrefs] = useState([]);
    const [noKnownAllergies, setNoKnownAllergies] = useState(false);
    const [allergySaving, setAllergySaving] = useState(false);

    const [aiProfile, setAiProfile] = useState(AI_PROFILE_DEFAULTS);
    const [aiProfileSaving, setAiProfileSaving] = useState(false);
    const [avoidDraft, setAvoidDraft] = useState('');
    const [preferredBrandDraft, setPreferredBrandDraft] = useState('');
    const [dislikedBrandDraft, setDislikedBrandDraft] = useState('');

    useEffect(() => {
        if (!user?.$id) return;
        if (supermarkets.length === 0) fetchSupermarkets();
    }, [user?.$id, supermarkets.length, fetchSupermarkets]);

    useEffect(() => {
        const prefs = user?.prefs && typeof user.prefs === 'object' ? user.prefs : {};
        const profile = readStoredAllergyProfile(prefs);
        setAllergyPrefs(profile.allergies);
        setNoKnownAllergies(profile.isSet && !profile.hasKnownAllergies);
        setAiProfile(readStoredAiProfile(prefs).profile);
    }, [user?.$id, user?.prefs]);

    const currentLang = i18n.resolvedLanguage || i18n.language;
    const langLabel = currentLang === 'en' ? 'English' : 'Turkce';

    const toggleAllergy = (id) => {
        setNoKnownAllergies(false);
        setAllergyPrefs((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleNoKnownAllergies = () => {
        setNoKnownAllergies((prev) => {
            const next = !prev;
            if (next) setAllergyPrefs([]);
            return next;
        });
    };

    const saveLanguage = async () => {
        const next = currentLang === 'tr' ? 'en' : 'tr';
        await i18n.changeLanguage(next);
        await updateUiPreferences({ uiLanguage: next });
    };

    const saveThemeToggle = async () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        toggleTheme();
        await updateUiPreferences({ uiTheme: next });
    };

    const saveCurrency = async (curr) => {
        setCurrency(curr);
        await updateUiPreferences({ uiCurrency: curr });
    };

    const renderToggleGrid = (items, selectedValues, onToggle) => (
        <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
                const active = selectedValues.includes(item.id);
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onToggle(item.id)}
                        className={`tap-target min-h-11 rounded-2xl border px-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                            active
                                ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        {t(item.labelKey)}
                    </button>
                );
            })}
        </div>
    );

    const toggleAiProfileListValue = (field, value) => {
        setAiProfile((prev) => {
            const current = Array.isArray(prev[field]) ? prev[field] : [];
            const next = current.includes(value)
                ? current.filter((x) => x !== value)
                : [...current, value];
            return normalizeAiProfile({ ...prev, [field]: next });
        });
    };

    const setAiProfileChoice = (field, value) => {
        setAiProfile((prev) => normalizeAiProfile({ ...prev, [field]: value }));
    };

    const addAiProfileChip = (field, value, clearDraft) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return;
        setAiProfile((prev) => {
            const current = Array.isArray(prev[field]) ? prev[field] : [];
            return normalizeAiProfile({ ...prev, [field]: [...current, trimmed] });
        });
        clearDraft('');
    };

    const removeAiProfileChip = (field, value) => {
        setAiProfile((prev) => {
            const current = Array.isArray(prev[field]) ? prev[field] : [];
            return normalizeAiProfile({ ...prev, [field]: current.filter((x) => x !== value) });
        });
    };

    const handleSaveAllergies = async (e) => {
        e.preventDefault();
        setAllergySaving(true);
        try {
            await updateAllergyPreferences(allergyPrefs);
        } finally {
            setAllergySaving(false);
        }
    };

    const handleSaveAiProfile = async (e) => {
        e.preventDefault();
        setAiProfileSaving(true);
        try {
            await updateAiProfilePreferences(aiProfile);
        } finally {
            setAiProfileSaving(false);
        }
    };

    const renderChipInput = (label, value, setValue, field, placeholder) => (
        <div className="space-y-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">{label}</span>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addAiProfileChip(field, value, setValue);
                        }
                    }}
                    placeholder={placeholder}
                    className="min-h-11 flex-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/30 placeholder:text-gray-400"
                />
                <button
                    type="button"
                    onClick={() => addAiProfileChip(field, value, setValue)}
                    className="tap-target min-h-11 min-w-11 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center"
                    aria-label={`Add ${label}`}
                >
                    <FiPlus size={16} />
                </button>
            </div>
            {aiProfile[field]?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {aiProfile[field].map((item) => (
                        <button
                            key={`${field}-${item}`}
                            type="button"
                            onClick={() => removeAiProfileChip(field, item)}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/40 px-3 py-1.5 text-[11px] font-black text-brand-700 dark:text-brand-300"
                        >
                            {item}
                            <FiX size={12} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const storeChoices = useMemo(
        () => (Array.isArray(supermarkets) ? supermarkets.slice(0, 8) : []),
        [supermarkets]
    );

    if (!user) return <Navigate to="/login" />;

    return (
        <MobilePage>
            <MobileHeader
                title={t('settings', 'Settings')}
                icon={FiGlobe}
                left={<BackButton to="/profile" />}
            />

            <div className="max-w-md mx-auto px-5 sm:px-6 pt-5 sm:pt-6 space-y-6">
                {/* App preferences */}
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100/50 dark:border-gray-800/50 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <FiGlobe size={12} className="text-brand-600" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                            {t('preferences', 'Preferences')}
                        </span>
                    </div>

                    <div>
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 block">
                            {t('currency', 'Currency')}
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                            {['TRY', 'USD', 'EUR', 'GBP'].map((curr) => (
                                <button
                                    key={curr}
                                    type="button"
                                    onClick={() => saveCurrency(curr)}
                                    className={`tap-target min-h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                        currency === curr
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                            : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    {curr}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={saveLanguage}
                            className="tap-target min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 text-xs font-black uppercase tracking-widest"
                        >
                            {langLabel}
                        </button>

                        <button
                            type="button"
                            onClick={saveThemeToggle}
                            className="tap-target min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {theme === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
                            <span>{theme === 'dark' ? t('light_mode', 'Light') : t('dark_mode', 'Dark')}</span>
                        </button>
                    </div>
                </div>

                {/* AI allergy profile */}
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100/50 dark:border-gray-800/50 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <FiShield size={12} className="text-brand-600" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                            {t('allergy_profile_title')}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('allergy_profile_description')}
                    </p>
                    <form onSubmit={handleSaveAllergies} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            {ALLERGY_OPTIONS.map((item) => {
                                const active = allergyPrefs.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => toggleAllergy(item.id)}
                                        className={`tap-target min-h-11 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                            active
                                                ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                                : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        {t(item.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={toggleNoKnownAllergies}
                            className={`tap-target w-full min-h-11 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                noKnownAllergies
                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            {t('allergy_profile_none')}
                        </button>
                        <button
                            type="submit"
                            disabled={allergySaving}
                            className="tap-target w-full min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-3 text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white transition-opacity disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-100 dark:hover:bg-gray-700/70"
                        >
                            {allergySaving ? t('saving', 'Saving…') : t('allergy_profile_save')}
                        </button>
                    </form>
                </div>

                {/* AI shopping profile */}
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100/50 dark:border-gray-800/50 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <FiShoppingBag size={12} className="text-brand-600" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                            {t('ai_shopping_profile_title', 'AI Shopping Profile')}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t(
                            'ai_shopping_profile_description',
                            'Optional preferences that help PriceMate tailor ingredient, price, and product suggestions.'
                        )}
                    </p>

                    <form onSubmit={handleSaveAiProfile} className="space-y-4">
                        <div className="space-y-2">
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                                {t('dietary_preferences', 'Dietary preferences')}
                            </span>
                            {renderToggleGrid(DIETARY_OPTIONS, aiProfile.dietaryPreferences, (id) =>
                                toggleAiProfileListValue('dietaryPreferences', id)
                            )}
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                                {t('nutrition_priorities', 'Nutrition priorities')}
                            </span>
                            {renderToggleGrid(NUTRITION_OPTIONS, aiProfile.nutritionPriorities, (id) =>
                                toggleAiProfileListValue('nutritionPriorities', id)
                            )}
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                                {t('budget_preference', 'Budget preference')}
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                {BUDGET_OPTIONS.map((item) => {
                                    const active = aiProfile.budgetPreference === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setAiProfileChoice('budgetPreference', item.id)}
                                            className={`tap-target min-h-11 rounded-2xl border px-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                                                active
                                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            {t(item.labelKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                                {t('preferred_stores', 'Preferred stores')}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                {storeChoices.map((store) => {
                                    const value = store.$id || store.name;
                                    const active = aiProfile.preferredStores.includes(value);
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => toggleAiProfileListValue('preferredStores', value)}
                                            className={`tap-target min-h-11 rounded-2xl border px-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                active
                                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            {store.name || t('store', 'Store')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {renderChipInput(
                            t('avoid_ingredients', 'Avoid ingredients'),
                            avoidDraft,
                            setAvoidDraft,
                            'avoidIngredients',
                            t('avoid_ingredients_placeholder', 'palm oil, aspartame...')
                        )}
                        {renderChipInput(
                            t('preferred_brands', 'Preferred brands'),
                            preferredBrandDraft,
                            setPreferredBrandDraft,
                            'preferredBrands',
                            t('preferred_brands_placeholder', 'Coca-Cola, Ülker...')
                        )}
                        {renderChipInput(
                            t('disliked_brands', 'Disliked brands'),
                            dislikedBrandDraft,
                            setDislikedBrandDraft,
                            'dislikedBrands',
                            t('disliked_brands_placeholder', 'Brand to avoid...')
                        )}

                        <div className="space-y-2">
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                                {t('response_style', 'Response style')}
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                {RESPONSE_STYLE_OPTIONS.map((item) => {
                                    const active = aiProfile.responseStyle === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setAiProfileChoice('responseStyle', item.id)}
                                            className={`tap-target min-h-11 rounded-2xl border px-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                                                active
                                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            {t(item.labelKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={aiProfileSaving}
                            className="tap-target w-full min-h-11 rounded-2xl bg-brand-600 py-3 text-xs font-black uppercase tracking-widest text-white transition-opacity disabled:opacity-40 disabled:pointer-events-none hover:bg-brand-700"
                        >
                            {aiProfileSaving ? t('saving', 'Saving…') : t('ai_shopping_profile_save', 'Save AI shopping profile')}
                        </button>
                    </form>
                </div>
            </div>
        </MobilePage>
    );
};

export default Settings;

