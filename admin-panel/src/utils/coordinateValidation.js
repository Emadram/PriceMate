export const validateSupermarketCoordinates = (latitude, longitude) => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return 'Enter valid numeric latitude and longitude.';
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return 'Latitude must be between -90 and 90, longitude between -180 and 180.';
    }
    if (lat === 0 && lon === 0) {
        return 'Coordinates (0, 0) are not allowed. Set the real store location.';
    }
    return '';
};
