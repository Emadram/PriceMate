import { hasValidLatLon } from '../utils/productUtils';

export const resolveCenter = ({ lat, lon, centerProp, supermarkets = [] }) => {
  // centerProp expected [lat, lon]
  if (centerProp && hasValidLatLon(centerProp[0], centerProp[1])) {
    return { latitude: Number(centerProp[0]), longitude: Number(centerProp[1]) };
  }

  if (hasValidLatLon(lat, lon)) {
    return { latitude: Number(lat), longitude: Number(lon) };
  }

  const validMarkers = (Array.isArray(supermarkets) ? supermarkets : []).filter((s) => hasValidLatLon(s.latitude, s.longitude));
  if (validMarkers.length === 0) return null;
  if (validMarkers.length === 1) {
    return { latitude: Number(validMarkers[0].latitude), longitude: Number(validMarkers[0].longitude) };
  }

  const averageLat = validMarkers.reduce((sum, marker) => sum + Number(marker.latitude), 0) / validMarkers.length;
  const averageLon = validMarkers.reduce((sum, marker) => sum + Number(marker.longitude), 0) / validMarkers.length;
  return { latitude: averageLat, longitude: averageLon };
};
