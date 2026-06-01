import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

vi.mock('../stores/authStore', () => ({
    default: (selector) => selector({ user: null, logout: vi.fn() }),
}));

vi.mock('../stores/currencyStore', () => ({
    default: () => ({ currency: 'TRY', setCurrency: vi.fn(), fetchRates: vi.fn() }),
}));

vi.mock('../stores/themeStore', () => ({
    default: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { language: 'en', changeLanguage: vi.fn(), resolvedLanguage: 'en' },
    }),
}));

describe('Navbar mobile bottom chrome', () => {
    beforeEach(() => {
        document.documentElement.style.removeProperty('--bottom-nav-h');
        document.documentElement.style.removeProperty('--mobile-top-logo-h');
    });

    it('does not render a mobile top PriceMate logo bar', () => {
        const { container } = render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        const topLogo = container.querySelector('.fixed.top-0.md\\:hidden');
        expect(topLogo).toBeNull();
        expect(document.documentElement.style.getPropertyValue('--mobile-top-logo-h')).toBe('0px');
    });

    it('pins bottom nav flush without mb-2 margin gap', () => {
        const { container } = render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        const bottomWrapper = container.querySelector('.fixed.bottom-0');
        expect(bottomWrapper).toBeTruthy();

        const chrome = bottomWrapper?.querySelector('.pricemate-mobile-chrome');
        expect(chrome).toBeTruthy();
        expect(chrome.className).not.toMatch(/\bmb-2\b/);
        expect(chrome.className).toMatch(/pb-\[max\(0\.5rem/);
    });

    it('hides mobile bottom nav on /ai-chat', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/ai-chat']}>
                <Navbar />
            </MemoryRouter>
        );

        expect(container.querySelector('.fixed.bottom-0')).toBeNull();
        expect(document.documentElement.style.getPropertyValue('--bottom-nav-h')).toBe('0px');
    });
});
