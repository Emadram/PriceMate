/** Default weekly hours JSON (Mon–Sun keys used by user-app isStoreOpen). */
export const DEFAULT_OPENING_HOURS = {
    Mon: '08:00-22:00',
    Tue: '08:00-22:00',
    Wed: '08:00-22:00',
    Thu: '08:00-22:00',
    Fri: '08:00-22:00',
    Sat: '09:00-21:00',
    Sun: 'closed',
};

export const DEFAULT_OPENING_HOURS_JSON = JSON.stringify(DEFAULT_OPENING_HOURS);
