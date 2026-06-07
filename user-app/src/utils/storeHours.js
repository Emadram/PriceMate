export const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_OPENING_HOURS = {
    Mon: '08:00-22:00',
    Tue: '08:00-22:00',
    Wed: '08:00-22:00',
    Thu: '08:00-22:00',
    Fri: '08:00-22:00',
    Sat: '09:00-21:00',
    Sun: 'closed',
};

const TIME_RANGE_RE = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;

export const parseOpeningHours = (openingHours) => {
    if (!openingHours) return null;
    try {
        const parsed = typeof openingHours === 'string' ? JSON.parse(openingHours) : openingHours;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
};

const parseTimeToMinutes = (timeStr) => {
    const [h, m] = String(timeStr || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

/**
 * Checks if a store is currently open based on its opening hours.
 * Expects format: {"Mon": "08:00-22:00", "Tue": "08:00-22:00", ...}
 * @param {string|object|null} openingHours
 * @param {Date} [now]
 */
export const isStoreOpen = (openingHours, now = new Date()) => {
    const hours = parseOpeningHours(openingHours);
    if (!hours) return true;

    try {
        const dayName = WEEKDAY_KEYS[now.getDay()];
        const todayHours = hours[dayName];

        if (!todayHours || String(todayHours).toLowerCase() === 'closed') return false;

        const [start, end] = String(todayHours).split('-');
        const startTime = parseTimeToMinutes(start);
        const endTime = parseTimeToMinutes(end);
        if (startTime === null || endTime === null) return true;

        const currentTime = now.getHours() * 60 + now.getMinutes();
        return currentTime >= startTime && currentTime < endTime;
    } catch (e) {
        console.warn('Error parsing opening hours:', e);
        return true;
    }
};

export const getTodayHoursLabel = (openingHours, now = new Date()) => {
    const hours = parseOpeningHours(openingHours);
    if (!hours) return '';

    const dayName = WEEKDAY_KEYS[now.getDay()];
    const todayHours = hours[dayName];
    if (!todayHours || String(todayHours).toLowerCase() === 'closed') return 'closed';
    return String(todayHours).replace('-', '–');
};

export const formatWeeklySchedule = (openingHours) => {
    const hours = parseOpeningHours(openingHours) || DEFAULT_OPENING_HOURS;
    return WEEKDAY_KEYS.slice(1).concat(WEEKDAY_KEYS[0]).map((day) => ({
        day,
        hours: hours[day] || 'closed',
        closed: !hours[day] || String(hours[day]).toLowerCase() === 'closed',
    }));
};

const legacyStatusIsOpen = (supermarket) => {
    const statusFromDb = (supermarket?.status || supermarket?.storeStatus || '').toString().toLowerCase();
    if (!statusFromDb) return null;
    if (['open', 'opened', 'available'].includes(statusFromDb)) return true;
    if (['close', 'closed', 'unavailable'].includes(statusFromDb)) return false;
    return null;
};

/**
 * @param {object|null|undefined} supermarket
 * @param {Date} [now]
 * @returns {{ isOpen: boolean, todayHours: string, weeklySchedule: ReturnType<typeof formatWeeklySchedule>, source: 'hours'|'legacy'|'default' }}
 */
export const getStoreAvailability = (supermarket, now = new Date()) => {
    const parsed = parseOpeningHours(supermarket?.openingHours);

    if (parsed) {
        return {
            isOpen: isStoreOpen(parsed, now),
            todayHours: getTodayHoursLabel(parsed, now),
            weeklySchedule: formatWeeklySchedule(parsed),
            source: 'hours',
        };
    }

    const legacy = legacyStatusIsOpen(supermarket);
    if (legacy !== null) {
        return {
            isOpen: legacy,
            todayHours: '',
            weeklySchedule: [],
            source: 'legacy',
        };
    }

    return {
        isOpen: false,
        todayHours: '',
        weeklySchedule: [],
        source: 'default',
    };
};

export const serializeOpeningHours = (weeklyMap) => JSON.stringify(weeklyMap);

export const createDefaultWeeklyFormState = () =>
    WEEKDAY_KEYS.reduce((acc, day) => {
        const value = DEFAULT_OPENING_HOURS[day] || 'closed';
        if (String(value).toLowerCase() === 'closed') {
            acc[day] = { closed: true, start: '08:00', end: '22:00' };
        } else {
            const [start, end] = String(value).split('-');
            acc[day] = { closed: false, start: start || '08:00', end: end || '22:00' };
        }
        return acc;
    }, {});

export const openingHoursFromFormState = (formState) => {
    const result = {};
    for (const day of WEEKDAY_KEYS) {
        const row = formState?.[day];
        if (!row || row.closed) {
            result[day] = 'closed';
            continue;
        }
        const start = String(row.start || '').trim();
        const end = String(row.end || '').trim();
        if (!TIME_RANGE_RE.test(`${start}-${end}`)) {
            throw new Error(`Invalid hours for ${day}`);
        }
        result[day] = `${start}-${end}`;
    }
    return result;
};

export const formStateFromOpeningHours = (openingHours) => {
    const parsed = parseOpeningHours(openingHours);
    if (!parsed) return createDefaultWeeklyFormState();

    return WEEKDAY_KEYS.reduce((acc, day) => {
        const value = parsed[day];
        if (!value || String(value).toLowerCase() === 'closed') {
            acc[day] = { closed: true, start: '08:00', end: '22:00' };
        } else {
            const [start, end] = String(value).split('-');
            acc[day] = { closed: false, start: start || '08:00', end: end || '22:00' };
        }
        return acc;
    }, {});
};
