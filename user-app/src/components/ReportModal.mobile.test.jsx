import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    it('renders bottom-sheet alignment and scrollable body when open', () => {
        const { container } = render(
            <ReportModal isOpen onClose={vi.fn()} targetName="Test Store" targetType="supermarket" />
        );

        const overlay = container.firstChild;
        expect(overlay.className).toMatch(/items-end/);
        expect(overlay.className).toMatch(/sm:items-center/);

        const panel = overlay.querySelector('.rounded-t-3xl');
        expect(panel).toBeTruthy();
        expect(panel.className).toMatch(/max-h-\[min\(90dvh/);

        const scrollBody = panel.querySelector('.overflow-y-auto');
        expect(scrollBody).toBeTruthy();
        expect(scrollBody.className).toMatch(/overscroll-contain/);

        expect(screen.getByText('Report Issue')).toBeTruthy();
    });
});
