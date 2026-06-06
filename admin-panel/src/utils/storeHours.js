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

export const serializeOpeningHours = (weeklyMap) => JSON.stringify(weeklyMap);

export const DAY_LABELS = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday',
};
