import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileHeader, MobilePage } from './MobilePageLayout';

describe('MobilePageLayout mobile static chrome', () => {
    it('MobileHeader uses fixed positioning below global logo on mobile, sticky on md+', () => {
        const { container } = render(
            <MemoryRouter>
                <MobilePage>
                    <MobileHeader title="Settings" />
                </MobilePage>
            </MemoryRouter>
        );

        const header = container.querySelector('header');
        expect(header).toBeTruthy();
        expect(header.className).toMatch(/\bfixed\b/);
        expect(header.className).toMatch(/top-\[var\(--mobile-top-logo-h/);
        expect(header.className).not.toMatch(/\bsticky top-0\b/);
        expect(header.className).toContain('md:sticky');
    });

    it('MobileHeader reserves flow space with a spacer on mobile', () => {
        const { container } = render(
            <MemoryRouter>
                <MobileHeader title="Profile" />
            </MemoryRouter>
        );

        const spacers = container.querySelectorAll('[aria-hidden="true"]');
        const spacer = Array.from(spacers).find((el) => el.className.includes('md:hidden'));
        expect(spacer).toBeTruthy();
        expect(spacer.className).toMatch(/h-\[var\(--mobile-header-h/);
    });
});
