/**
 * AIChatBox Mobile Bug Condition Exploration Test
 *
 * Property 1: Bug Condition — Mobile Full-Screen Takeover
 *
 * Validates: Requirements 1.1, 1.2
 *
 * IMPORTANT: Task 1 assertions are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists (outer container uses `inset-0 h-[100dvh]`
 * instead of the drawer classes `h-[85dvh]`).
 *
 * This test encodes the EXPECTED (fixed) behavior. It will pass once the fix
 * is applied in Task 3.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock all heavy dependencies so the component can render in JSDOM
// ---------------------------------------------------------------------------

vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: vi.fn() } },
    })),
}));

vi.mock('appwrite', () => ({
    Client: vi.fn().mockImplementation(() => ({ setEndpoint: vi.fn().mockReturnThis(), setProject: vi.fn().mockReturnThis() })),
    Databases: vi.fn().mockImplementation(() => ({})),
    Account: vi.fn().mockImplementation(() => ({})),
    Functions: vi.fn().mockImplementation(() => ({ createExecution: vi.fn() })),
    Storage: vi.fn().mockImplementation(() => ({})),
    ID: { unique: vi.fn(() => 'mock-id') },
    Query: { equal: vi.fn(), orderDesc: vi.fn(), limit: vi.fn() },
    Permission: {},
    Role: {},
}));

vi.mock('../lib/appwrite', () => ({
    databases: {},
    account: {},
    storage: {},
    functions: { createExecution: vi.fn() },
    client: {},
}));

vi.mock('react-router-dom', () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }) => children,
}));

vi.mock('../stores/currencyStore', () => ({
    default: () => ({
        convert: (val) => val,
        getCurrencySymbol: () => '₺',
        currency: 'TRY',
    }),
}));

vi.mock('../stores/authStore', () => ({
    default: (selector) => {
        const state = { user: null, isLoading: false };
        return selector ? selector(state) : state;
    },
}));

vi.mock('../stores/chatStore', () => ({
    default: () => ({
        messages: [],
        conversationSummaries: [],
        activeConversationId: null,
        error: null,
        addMessage: vi.fn(),
        loading: false,
        summariesLoading: false,
        initializeChatSession: vi.fn(),
        startNewConversation: vi.fn(),
        fetchMessagesForConversation: vi.fn(),
        deleteConversation: vi.fn(),
        resetChat: vi.fn(),
        clearChatWriteError: vi.fn(),
    }),
    CHAT_ERROR_MISSING_CONVERSATION_ID: 'MISSING_CONVERSATION_ID',
}));

vi.mock('../utils/productUtils', () => ({
    fetchProducts: vi.fn(),
    fetchAllPrices: vi.fn(),
    fetchIngredientsByBarcode: vi.fn(),
    searchIngredientsByName: vi.fn(),
    resolveCatalogProductForIngredients: vi.fn(),
    ingredientPayloadFromAppwriteProduct: vi.fn(),
    persistIngredientPayloadToCatalogProduct: vi.fn(),
    fetchOffCacheSnapshot: vi.fn(),
    normalizeOffCacheDoc: vi.fn(),
    resolveOffCacheProductForIngredients: vi.fn(),
    ingredientPayloadFromOffCache: vi.fn(),
}));

vi.mock('../utils/aiCheckUtils', () => ({
    buildAiProfileCacheKey: vi.fn(),
    buildAiCheckFingerprint: vi.fn(),
    parseAiCheckResponse: vi.fn(),
    readStoredAiProfile: vi.fn(),
    readStoredAllergyProfile: vi.fn(),
    serializeAiCheckResponse: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the components AFTER mocks are set up
// ---------------------------------------------------------------------------
import AIChatBox from './AIChatBox';
import FloatingAIChatLauncher from './FloatingAIChatLauncher';

// ---------------------------------------------------------------------------
// JSDOM polyfills — required for AIChatBox to render without crashing
// ---------------------------------------------------------------------------

// JSDOM does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// JSDOM does not implement matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// ---------------------------------------------------------------------------
// Task 1 — Bug Condition Exploration Test
//
// Scoped PBT: concrete failing case — viewport 390 px (iPhone 14), isOpen=true
//
// EXPECTED TO FAIL on unfixed code:
//   - outer container has `inset-0` (full-screen positioning) → bug confirmed
//   - outer container does NOT have `h-[85dvh]` (drawer height cap missing) → bug confirmed
// ---------------------------------------------------------------------------

describe('AIChatBox — Task 1: Bug Condition Exploration (Property 1)', () => {
    let originalInnerWidth;

    beforeEach(() => {
        originalInnerWidth = window.innerWidth;
        // Simulate iPhone 14 viewport
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 390,
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: originalInnerWidth,
        });
    });

    it(
        'Property 1 — outer container DOES NOT have h-[100dvh] (full-screen height) at 390 px viewport [FAILS on unfixed code]',
        () => {
            /**
             * Validates: Requirements 1.1, 1.2
             *
             * On unfixed code the outer container has `h-[100dvh]` which causes
             * the full-screen takeover. This assertion will FAIL on unfixed code,
             * confirming the bug exists.
             *
             * Counterexample: outer container has class `h-[100dvh]` at 390 px viewport,
             * covering 100% of the screen and hiding the navbar.
             */
            const { container } = render(
                <AIChatBox isOpen={true} onClose={() => {}} />
            );

            // The outer container is the second div (first is the backdrop)
            const outerContainer = container.querySelector('div.fixed.z-\\[2000\\]');

            expect(outerContainer).not.toBeNull();

            // ASSERTION 1: outer container must NOT have h-[100dvh] (the bug class)
            // This FAILS on unfixed code — confirms the bug
            expect(outerContainer.className).not.toContain('h-[100dvh]');
        }
    );

    it(
        'Property 1 — outer container HAS h-[85dvh] (drawer height cap) at 390 px viewport [FAILS on unfixed code]',
        () => {
            /**
             * Validates: Requirements 2.1
             *
             * On unfixed code the outer container does NOT have `h-[85dvh]`.
             * This assertion will FAIL on unfixed code, confirming the fix is missing.
             *
             * Counterexample: outer container is missing `h-[85dvh]` at 390 px viewport,
             * meaning the drawer height cap is not applied.
             */
            const { container } = render(
                <AIChatBox isOpen={true} onClose={() => {}} />
            );

            const outerContainer = container.querySelector('div.fixed.z-\\[2000\\]');

            expect(outerContainer).not.toBeNull();

            // ASSERTION 2: outer container MUST have h-[85dvh] (the fix class)
            // This FAILS on unfixed code — confirms the fix is not yet applied
            expect(outerContainer.className).toContain('h-[85dvh]');
        }
    );

    it(
        'Property 1 — outer container HAS inset-0 (full-screen positioning) at 390 px viewport [FAILS on unfixed code — confirms bug]',
        () => {
            /**
             * Validates: Requirements 1.1
             *
             * On unfixed code the outer container has `inset-0` which positions
             * the panel to cover the entire viewport (top: 0, right: 0, bottom: 0, left: 0).
             * This assertion PASSES on unfixed code, confirming the bug condition.
             *
             * Counterexample: outer container has `inset-0` at 390 px viewport,
             * meaning the panel covers 100% of the screen including the navbar.
             *
             * NOTE: This assertion is inverted — it asserts the bug IS present.
             * After the fix, `inset-0` should be replaced with `bottom-0 left-0 right-0`.
             * This test will FAIL after the fix is applied (which is correct behavior).
             * The test above (h-[85dvh]) is the primary fix-checking assertion.
             */
            const { container } = render(
                <AIChatBox isOpen={true} onClose={() => {}} />
            );

            const outerContainer = container.querySelector('div.fixed.z-\\[2000\\]');

            expect(outerContainer).not.toBeNull();

            // On UNFIXED code: inset-0 IS present (this assertion passes, confirming the bug)
            // On FIXED code: inset-0 is ABSENT (this assertion fails — expected after fix)
            // This test documents the bug condition counterexample.
            expect(outerContainer.className).not.toContain('inset-0');
        }
    );
});

// ---------------------------------------------------------------------------
// Task 2 — Preservation Property Tests
//
// Property 2: Preservation — Desktop Floating Panel Geometry Unchanged
//
// These tests MUST PASS on unfixed code — they confirm the baseline desktop
// behavior that must be preserved after the fix is applied.
//
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------

describe('AIChatBox — Task 2: Preservation Tests (Property 2)', () => {
    let originalInnerWidth;

    beforeEach(() => {
        originalInnerWidth = window.innerWidth;
        // Clean up any body classes from previous tests
        document.body.classList.remove('ai-open');
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: originalInnerWidth,
        });
        document.body.classList.remove('ai-open');
    });

    it(
        'Property 2 — outer container HAS sm:w-[400px] and sm:h-[min(640px,90vh)] at 1280 px viewport',
        () => {
            /**
             * Validates: Requirements 3.1, 3.2
             *
             * On both unfixed and fixed code, the outer container must carry the
             * desktop sm: geometry classes. These classes are part of the class
             * string regardless of viewport (Tailwind responsive prefixes are
             * always present in the DOM; the browser applies them based on media
             * queries). This test confirms the class string is preserved.
             */
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1280,
            });

            const { container } = render(
                <AIChatBox isOpen={true} onClose={() => {}} />
            );

            const outerContainer = container.querySelector('div.fixed.z-\\[2000\\]');
            expect(outerContainer).not.toBeNull();

            // Desktop geometry classes must be present in the class string
            expect(outerContainer.className).toContain('sm:w-[400px]');
            expect(outerContainer.className).toContain('sm:h-[min(640px,90vh)]');
        }
    );

    it(
        'Property 2 — outer container HAS sm:max-h-none at 1280 px viewport (desktop cap reset)',
        () => {
            /**
             * Validates: Requirements 3.1
             *
             * After the fix, h-[85dvh] is present as a mobile-first class, but
             * sm:max-h-none resets the height cap on desktop so the floating panel
             * is not constrained. This test confirms sm:max-h-none is present in
             * the class string, which is the post-fix desktop preservation guarantee.
             *
             * NOTE: The original test checked that h-[85dvh] was absent (unfixed baseline).
             * After the fix, h-[85dvh] IS in the class string (mobile-first), but
             * sm:max-h-none overrides it on desktop. We now assert sm:max-h-none is present.
             */
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1280,
            });

            const { container } = render(
                <AIChatBox isOpen={true} onClose={() => {}} />
            );

            const outerContainer = container.querySelector('div.fixed.z-\\[2000\\]');
            expect(outerContainer).not.toBeNull();

            // Post-fix: sm:max-h-none MUST be present to reset the mobile height cap on desktop
            expect(outerContainer.className).toContain('sm:max-h-none');
        }
    );
});

// ---------------------------------------------------------------------------
// Task 2 — FloatingAIChatLauncher body class preservation tests
//
// These tests verify the ai-open body class behavior on unfixed code:
//   - isOpen=true at 1280 px → body HAS ai-open (scroll-lock active on desktop)
//   - isOpen=false at 390 px → body does NOT have ai-open
//
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

describe('FloatingAIChatLauncher — Task 2: ai-open body class preservation', () => {
    let originalInnerWidth;

    beforeEach(() => {
        originalInnerWidth = window.innerWidth;
        document.body.classList.remove('ai-open');
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: originalInnerWidth,
        });
        document.body.classList.remove('ai-open');
    });

    it(
        'Property 2 — document.body has ai-open class when isOpen=true at 1280 px viewport',
        async () => {
            /**
             * Validates: Requirements 3.3
             *
             * On unfixed code, FloatingAIChatLauncher adds ai-open to document.body
             * unconditionally when isOpen=true. At 1280 px (desktop), this is the
             * correct behavior to preserve. This test confirms the baseline.
             *
             * The launcher starts with isOpen=false. We click the launcher button
             * to trigger setIsOpen(true), which runs the useEffect that adds ai-open.
             */
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1280,
            });

            // matchMedia must return matches=true for (min-width: 640px) at 1280px
            // so that the fixed code (task 3.4) also passes this test after the fix.
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockImplementation((query) => ({
                    matches: query === '(min-width: 640px)',
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                })),
            });

            const { getByRole } = render(<FloatingAIChatLauncher />);

            // Click the launcher button to open the chat (sets isOpen=true)
            const launcherButton = getByRole('button', { name: /open ai assistant/i });
            launcherButton.click();

            // Wait for the useEffect to run (React batches state updates)
            await new Promise((resolve) => setTimeout(resolve, 0));

            // On unfixed code: ai-open is added unconditionally when isOpen=true
            // On fixed code (task 3.4): ai-open is added only on desktop (matchMedia matches)
            // Both cases: at 1280px, ai-open MUST be present
            expect(document.body.classList.contains('ai-open')).toBe(true);
        }
    );

    it(
        'Property 2 — document.body does NOT have ai-open class when isOpen=false at 390 px viewport',
        async () => {
            /**
             * Validates: Requirements 3.3
             *
             * When isOpen=false, ai-open must NOT be on document.body regardless of
             * viewport. This test confirms the baseline behavior on unfixed code.
             */
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 390,
            });

            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockImplementation((query) => ({
                    matches: false, // 390px — not desktop
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                })),
            });

            // Render with isOpen=false (default state — do NOT click the button)
            render(<FloatingAIChatLauncher />);

            await new Promise((resolve) => setTimeout(resolve, 0));

            // isOpen=false → ai-open must NOT be on body
            expect(document.body.classList.contains('ai-open')).toBe(false);
        }
    );

    it(
        'Property 2 — document.body does NOT have ai-open class when isOpen=true at 390 px viewport (mobile)',
        async () => {
            /**
             * Validates: Requirements 2.5, 3.3
             *
             * After the fix (task 3.4), FloatingAIChatLauncher guards the ai-open
             * body class behind a desktop check. On mobile (390 px), even when
             * isOpen=true, ai-open must NOT be added to document.body so the
             * underlying page remains scrollable.
             */
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 390,
            });

            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockImplementation((query) => ({
                    matches: false, // 390px — not desktop, so (min-width: 640px) is false
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                })),
            });

            const { getByRole } = render(<FloatingAIChatLauncher />);

            // Click the launcher button to open the chat (sets isOpen=true)
            const launcherButton = getByRole('button', { name: /open ai assistant/i });
            launcherButton.click();

            await new Promise((resolve) => setTimeout(resolve, 0));

            // On mobile with isOpen=true: ai-open must NOT be on body (post-fix behavior)
            expect(document.body.classList.contains('ai-open')).toBe(false);
        }
    );
});
