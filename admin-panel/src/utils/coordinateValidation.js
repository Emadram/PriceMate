export const validateSupermarketCoordinates = (latitude, longitude) => {
    const latText = String(latitude ?? '').trim();
    const lonText = String(longitude ?? '').trim();

    if (!latText && !lonText) {
        return '';
    }

    if (!latText || !lonText) {
        return 'Enter both latitude and longitude, or leave both empty.';
    }

    const lat = Number(latText);
    const lon = Number(lonText);

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
