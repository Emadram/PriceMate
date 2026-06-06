import { describe, it, expect } from 'vitest';
import {
    DEFAULT_OPENING_HOURS,
    formatWeeklySchedule,
    getStoreAvailability,
    getTodayHoursLabel,
    isStoreOpen,
    openingHoursFromFormState,
    parseOpeningHours,
} from './storeHours';

const weekdayHours = DEFAULT_OPENING_HOURS;

describe('storeHours', () => {
    describe('parseOpeningHours', () => {
        it('parses JSON string', () => {
            expect(parseOpeningHours(JSON.stringify(weekdayHours))).toEqual(weekdayHours);
        });

        it('returns null for malformed JSON', () => {
            expect(parseOpeningHours('{bad')).toBeNull();
        });
    });

    describe('isStoreOpen', () => {
        it('returns open during Monday business hours', () => {
            const mondayMorning = new Date('2026-06-01T10:00:00');
            expect(isStoreOpen(weekdayHours, mondayMorning)).toBe(true);
        });

        it('returns closed after closing on Monday', () => {
            const mondayNight = new Date('2026-06-01T23:00:00');
            expect(isStoreOpen(weekdayHours, mondayNight)).toBe(false);
        });

        it('returns closed on Sunday when marked closed', () => {
            const sunday = new Date('2026-06-07T12:00:00');
            expect(isStoreOpen(weekdayHours, sunday)).toBe(false);
        });

        it('defaults to open when hours missing', () => {
            expect(isStoreOpen(null)).toBe(true);
        });

        it('defaults to open on malformed day value', () => {
            const bad = { Mon: 'invalid' };
            expect(isStoreOpen(bad, new Date('2026-06-01T10:00:00'))).toBe(true);
        });
    });

    describe('getTodayHoursLabel', () => {
        it('formats today range with en-dash', () => {
            const monday = new Date('2026-06-01T10:00:00');
            expect(getTodayHoursLabel(weekdayHours, monday)).toBe('08:00–22:00');
        });

        it('returns closed for closed days', () => {
            const sunday = new Date('2026-06-07T12:00:00');
            expect(getTodayHoursLabel(weekdayHours, sunday)).toBe('closed');
        });
    });

    describe('getStoreAvailability', () => {
        it('uses openingHours as source of truth', () => {
            const monday = new Date('2026-06-01T10:00:00');
            const result = getStoreAvailability(
                { openingHours: JSON.stringify(weekdayHours) },
                monday
            );
            expect(result.source).toBe('hours');
            expect(result.isOpen).toBe(true);
            expect(result.todayHours).toBe('08:00–22:00');
            expect(result.weeklySchedule).toHaveLength(7);
        });

        it('falls back to legacy status when no hours', () => {
            expect(getStoreAvailability({ status: 'close' }).isOpen).toBe(false);
            expect(getStoreAvailability({ status: 'open' }).isOpen).toBe(true);
        });

        it('defaults to open when no hours or status', () => {
            expect(getStoreAvailability({}).source).toBe('default');
            expect(getStoreAvailability({}).isOpen).toBe(true);
        });
    });

    describe('openingHoursFromFormState', () => {
        it('serializes closed and open days', () => {
            const form = {
                Sun: { closed: true, start: '08:00', end: '22:00' },
                Mon: { closed: false, start: '09:00', end: '21:00' },
                Tue: { closed: false, start: '09:00', end: '21:00' },
                Wed: { closed: false, start: '09:00', end: '21:00' },
                Thu: { closed: false, start: '09:00', end: '21:00' },
                Fri: { closed: false, start: '09:00', end: '21:00' },
                Sat: { closed: false, start: '10:00', end: '20:00' },
            };
            const serialized = openingHoursFromFormState(form);
            expect(serialized.Sun).toBe('closed');
            expect(serialized.Mon).toBe('09:00-21:00');
        });
    });

    describe('formatWeeklySchedule', () => {
        it('returns seven rows starting Monday order', () => {
            const rows = formatWeeklySchedule(weekdayHours);
            expect(rows[0].day).toBe('Mon');
            expect(rows[6].day).toBe('Sun');
            expect(rows[6].closed).toBe(true);
        });
    });
});
