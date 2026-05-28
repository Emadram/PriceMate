import { describe, expect, it } from 'vitest';
import {
    buildAiProfileCacheKey,
    buildStoredAiProfilePrefs,
    buildStoredAllergyPrefs,
    buildAiCheckFingerprint,
    classifyAiCheckIntent,
    getAllergenTermsForLabels,
    normalizeAiProfile,
    normalizeAllergyPreference,
    normalizeAllergyProfile,
    parseAiCheckResponse,
    readStoredAiProfile,
    readStoredAllergyProfile,
    serializeAiCheckResponse,
} from './aiCheckUtils';

describe('aiCheckUtils', () => {
    it('classifies ingredient, price, and generic intents', () => {
        expect(classifyAiCheckIntent('Check ingredients of Coca-Cola')).toBe('ingredient_safety');
        expect(classifyAiCheckIntent('Is this good for me?')).toBe('ingredient_safety');
        expect(classifyAiCheckIntent('Cheapest price for Twix')).toBe('price_check');
        expect(classifyAiCheckIntent('hello')).toBe('generic');
    });

    it('normalizes allergy preferences and ignores no-allergy placeholders', () => {
        expect(normalizeAllergyPreference('Dairy')).toBe('milk');
        expect(normalizeAllergyPreference('nuts')).toBe('tree nuts');
        expect(normalizeAllergyPreference('no known allergies')).toBe('');
        expect(normalizeAllergyProfile(['Milk', 'dairy', 'no known allergies'])).toEqual(['milk']);
    });

    it('stores and reads no-known-allergy profiles without inventing allergens', () => {
        const stored = buildStoredAllergyPrefs([]);
        expect(stored.aiAllergies).toEqual([]);
        expect(stored.aiAllergyProfileSet).toBe(true);
        expect(readStoredAllergyProfile(stored)).toMatchObject({
            allergies: [],
            hasKnownAllergies: false,
            isSet: true,
        });
    });

    it('normalizes and stores optional AI shopping profiles', () => {
        const profile = normalizeAiProfile({
            dietaryPreferences: ['Vegan', 'invalid'],
            nutritionPriorities: ['low sugar'],
            avoidIngredients: [' Palm Oil ', ''],
            budgetPreference: 'lowest_price',
            responseStyle: 'concise',
        });
        expect(profile.dietaryPreferences).toEqual(['vegan']);
        expect(profile.nutritionPriorities).toEqual(['low sugar']);
        expect(profile.avoidIngredients).toEqual(['palm oil']);
        expect(profile.budgetPreference).toBe('lowest_price');
        expect(profile.responseStyle).toBe('concise');

        const stored = buildStoredAiProfilePrefs(profile);
        expect(readStoredAiProfile(stored).hasSignal).toBe(true);
        expect(buildAiProfileCacheKey(profile)).toContain('vegan');
    });

    it('expands allergen labels into ingredient terms', () => {
        const terms = getAllergenTermsForLabels(['milk']);
        expect(terms).toContain('whey');
        expect(terms).toContain('casein');
        expect(terms).toContain('lactose');
    });

    it('round-trips structured assistant payloads', () => {
        const payload = { mode: 'ingredient_safety', status: 'safe', asOf: '2026-05-26T00:00:00.000Z' };
        expect(parseAiCheckResponse(serializeAiCheckResponse(payload))).toEqual(payload);
        expect(parseAiCheckResponse('normal reply')).toBe(null);
    });

    it('builds cache fingerprints with product and freshness data', () => {
        expect(buildAiCheckFingerprint({
            mode: 'price_check',
            status: 'ok',
            product: { barcode: '123' },
            asOf: '2026-05-26T00:00:00.000Z',
            stale: false,
        })).toBe('price_check:123:ok:2026-05-26T00:00:00.000Z:fresh');
    });
});
