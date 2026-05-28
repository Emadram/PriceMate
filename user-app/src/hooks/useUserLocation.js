import { useCallback, useEffect, useState } from 'react';

/**
 * Hook to get and track user's current geolocation.
 * @returns {Object} { location, error, loading }
 */
export const getGeoErrorMessage = (err) => {
    if (!err) return 'Location is unavailable right now.';

    switch (err.code) {
        case err.PERMISSION_DENIED:
            return 'Location access was denied. Enable it in your browser settings to sort by distance and open directions.';
        case err.POSITION_UNAVAILABLE:
            return 'Your location could not be determined. Move to a place with a better signal and try again.';
        case err.TIMEOUT:
            return 'Location request timed out. Try again to refresh the distance and map view.';
        default:
            return err.message || 'Location is unavailable right now.';
    }
};

const useUserLocation = () => {
    const hasGeo = typeof navigator !== 'undefined' && !!navigator.geolocation;
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(hasGeo ? null : 'Geolocation is not supported by your browser');
    const [loading, setLoading] = useState(hasGeo);

    const handleSuccess = useCallback((position) => {
        setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        });
        setLoading(false);
    }, []);

    const handleError = useCallback((err) => {
        setError(getGeoErrorMessage(err));
        setLoading(false);
    }, []);

    const requestLocation = useCallback(() => {
        if (!hasGeo) return;

        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    }, [hasGeo, handleSuccess, handleError]);

    useEffect(() => {
        if (!hasGeo) return;

        // Call in a microtask to avoid setState in the render/effect body warning
        const t = setTimeout(() => requestLocation(), 0);

        // Watch for changes so distance updates if the user moves.
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });

        return () => {
            clearTimeout(t);
            navigator.geolocation.clearWatch(watchId);
        };
    }, [hasGeo, handleError, handleSuccess, requestLocation]);

    return { location, error, loading, retry: requestLocation };
};

export default useUserLocation;
