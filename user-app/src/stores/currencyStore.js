import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCurrencyStore = create(
    persist(
        (set, get) => ({
            currency: 'TRY', // Default currency
            rates: { TRY: 1, USD: 0.031, EUR: 0.029, GBP: 0.024 }, // Initial placeholder rates
            lastUpdated: null,
            loading: false,

            setCurrency: (currency) => set({ currency }),

            fetchRates: async () => {
                const now = Date.now();
                const cacheDuration = 1000 * 60 * 60; // 1 hour

                // Check if we already have rates updated in the last hour
                if (get().lastUpdated && now - get().lastUpdated < cacheDuration) {
                    return;
                }

                set({ loading: true });
                try {
                    const apiKey = '4f184da9dc8a15867d2ac415';
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
                const { rates, currency: to } = get();
                if (!rates || !rates[to] || !rates[from]) return amount;
                
                // Base amount in TRY
                const baseAmount = from === 'TRY' ? amount : amount / rates[from];
                // Convert to target currency
                return (baseAmount * rates[to]).toFixed(2);
            },

            getCurrencySymbol: () => {
                const { currency } = get();
                const symbols = {
                    TRY: '₺',
                    USD: '$',
                    EUR: '€',
                    GBP: '£'
                };
                return symbols[currency] || currency;
            }
        }),
        {
            name: 'currency-storage',
        }
    )
);

export default useCurrencyStore;
