import { describe, it, expect } from 'vitest';
import { getGeoErrorMessage } from './useUserLocation';

describe('getGeoErrorMessage', () => {
    it('explains permission denied errors', () => {
        expect(
            getGeoErrorMessage({ code: 1, PERMISSION_DENIED: 1 })
        ).toContain('denied');
    });

    it('explains timeout errors', () => {
        expect(
            getGeoErrorMessage({ code: 3, TIMEOUT: 3 })
        ).toContain('timed out');
    });

    it('falls back to a generic message when error data is missing', () => {
        expect(getGeoErrorMessage(null)).toBe('Location is unavailable right now.');
    });
});