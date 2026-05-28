import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const normalizeCurrency = (value) => {
    if (!value) return value;
    const upper = String(value).trim().toUpperCase();
    return upper === 'TL' ? 'TRY' : upper;
};

const useCurrencyStore = create(
    persist(
        (set, get) => ({
            currency: 'TRY', // Default currency
            // TODO: Replace placeholder rates by eagerly fetching live rates on app start.
            rates: { TRY: 1, USD: 0.031, EUR: 0.029, GBP: 0.024 },
            lastUpdated: null,
            loading: false,

            setCurrency: (currency) => set({ currency: normalizeCurrency(currency) }),

            fetchRates: async () => {
                const now = Date.now();
                const cacheDuration = 1000 * 60 * 60; // 1 hour

                // Check if we already have rates updated in the last hour
                if (get().lastUpdated && now - get().lastUpdated < cacheDuration) {
                    return;
                }

                set({ loading: true });
                try {
                    const apiKey = import.meta.env.VITE_EXCHANGE_RATE_API_KEY || '4f184da9dc8a15867d2ac415';
                    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/TRY`);
                    const data = await response.json();

                    if (data.result === 'success') {
                        set({ 
                            rates: data.conversion_rates, 
                            lastUpdated: now,
                            loading: false 
                        });
                    } else {
                        throw new Error('Failed to fetch exchange rates');
                    }
                } catch (error) {
                    console.error('Error fetching exchange rates:', error);
                    set({ loading: false });
                }
            },

            convert: (amount, from = 'TRY') => {
                const { rates, currency: rawTo } = get();
                const to = normalizeCurrency(rawTo) || 'TRY';
                const normalizedFrom = normalizeCurrency(from) || 'TRY';
                if (!rates || !rates[to] || !rates[normalizedFrom]) return amount;
                
                // Base amount in TRY
                const baseAmount = normalizedFrom === 'TRY' ? amount : amount / rates[normalizedFrom];
                // Convert to target currency
                return (baseAmount * rates[to]).toFixed(2);
            },

            getCurrencySymbol: () => {
                const { currency } = get();
                const normalized = normalizeCurrency(currency) || 'TRY';
                const symbols = {
                    TRY: '₺',
                    USD: '$',
                    EUR: '€',
                    GBP: '£'
                };
                return symbols[normalized] || normalized;
            }
        }),
        {
            name: 'currency-storage',
            onRehydrateStorage: () => (state) => {
                const normalized = normalizeCurrency(state?.currency);
                if (normalized && normalized !== state?.currency) {
                    state.setCurrency(normalized);
                }
            }
        }
    )
);

export default useCurrencyStore;
