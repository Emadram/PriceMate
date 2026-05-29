import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ReportModal from './ReportModal';

vi.mock('../lib/appwrite', () => ({
    db: { feedback: { create: vi.fn() } },
}));

vi.mock('../stores/authStore', () => ({
    default: (selector) => selector({ user: { $id: 'user-1' } }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
    }),
}));

vi.mock('../hooks/useDocumentScrollLock', () => ({
    default: vi.fn(),
}));

describe('ReportModal mobile layout', () => {
    beforeEach(() => {
        document.documentElement.style.setProperty('--bottom-nav-h', '72px');
    });

    afterEach(() => {
        cleanup();
        document.documentElement.style.removeProperty('--bottom-nav-h');
    });

    it('renders via portal above nav with scrollable body and sticky footer CTA', () => {
        render(
            <ReportModal isOpen onClose={vi.fn()} targetName="Test Store" targetType="supermarket" />
        );

        const overlay = screen.getByRole('dialog');
        expect(overlay.className).toMatch(/items-end/);
        expect(overlay.className).toMatch(/sm:items-center/);
        expect(overlay.className).toMatch(/bottom-nav-h/);
        expect(overlay.className).toMatch(/z-\[10050\]/);

        const panel = overlay.querySelector('.rounded-t-3xl');
        expect(panel).toBeTruthy();
        expect(panel.className).toMatch(/max-h-\[min\(90dvh/);

        const scrollBody = panel.querySelector('.overflow-y-auto');
        expect(scrollBody).toBeTruthy();
        expect(scrollBody.querySelector('button[type="submit"]')).toBeNull();

        const footer = screen.getByTestId('report-modal-footer');
        expect(footer).toBeTruthy();
        expect(footer.querySelector('button[type="submit"]')).toBeTruthy();
        expect(screen.getByText('Send Report')).toBeTruthy();
        expect(screen.getByText('Choose a reason above to continue')).toBeTruthy();
    });
});
