import { useState, useEffect } from 'react';

/**
 * Hook to get and track user's current geolocation.
 * @returns {Object} { location, error, loading }
 */
const useUserLocation = () => {
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        const handleSuccess = (position) => {
            setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            });
            setLoading(false);
        };

        const handleError = (err) => {
            setError(err.message);
            setLoading(false);
        };

        // Get initial position
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });

        // Watch for changes (optional, but good for real-time)
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError);

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return { location, error, loading };
};

export default useUserLocation;
