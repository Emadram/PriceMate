import React, { useEffect, useMemo, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Icon } from 'ol/style';
import { hasValidLatLon } from '../utils/productUtils';

const StoreMap = ({ lat, lon, zoom = 15, height = "300px", supermarkets = [], center: centerProp }) => {
  const mapRef = useRef();
  const mapElement = useRef();
  const resolvedSupermarkets = Array.isArray(supermarkets) ? supermarkets : [];

  const resolveCenter = () => {
    if (centerProp && hasValidLatLon(centerProp[0], centerProp[1])) {
      return fromLonLat([parseFloat(centerProp[1]), parseFloat(centerProp[0])]);
    }

    if (hasValidLatLon(lat, lon)) {
      return fromLonLat([parseFloat(lon), parseFloat(lat)]);
    }

    const validMarkers = resolvedSupermarkets.filter((s) => hasValidLatLon(s.latitude, s.longitude));
    if (validMarkers.length === 0) return null;
    if (validMarkers.length === 1) {
      return fromLonLat([
        parseFloat(validMarkers[0].longitude),
        parseFloat(validMarkers[0].latitude)
      ]);
    }

    const averageLat = validMarkers.reduce((sum, marker) => sum + parseFloat(marker.latitude), 0) / validMarkers.length;
    const averageLon = validMarkers.reduce((sum, marker) => sum + parseFloat(marker.longitude), 0) / validMarkers.length;
    return fromLonLat([averageLon, averageLat]);
  };

  const buildMarkerFeature = (supermarket) => {
    if (!hasValidLatLon(supermarket.latitude, supermarket.longitude)) return null;
    const feature = new Feature({
      geometry: new Point(fromLonLat([parseFloat(supermarket.longitude), parseFloat(supermarket.latitude)])),
      name: supermarket.name || supermarket.branchName || 'Store'
    });
    feature.setStyle(
      new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          scale: 0.06,
        }),
      })
    );
    return feature;
  };

  const mapInputsKey = useMemo(
    () =>
      [
        lat,
        lon,
        zoom,
        centerProp?.[0],
        centerProp?.[1],
        supermarkets.map((s) => [s?.$id, s?.latitude, s?.longitude].join(',')).join('|'),
      ].join('::'),
    [lat, lon, zoom, centerProp, supermarkets]
  );

  useEffect(() => {
    const centerCoords = resolveCenter();
    if (!centerCoords) {
      return;
    }

    if (mapRef.current) {
      mapRef.current.setTarget(null);
      mapRef.current.dispose?.();
      mapRef.current = null;
    }

    const features = [];
    
    if (resolvedSupermarkets.length > 0) {
      resolvedSupermarkets.forEach((supermarket) => {
        const feature = buildMarkerFeature(supermarket);
        if (feature) features.push(feature);
      });
    } else if (hasValidLatLon(lat, lon)) {
        // Fallback to single lat/lon
        const marker = new Feature({
            geometry: new Point(centerCoords),
        });
        marker.setStyle(
            new Style({
                image: new Icon({
                    anchor: [0.5, 1],
                    src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
                    scale: 0.06,
                }),
            })
        );
        features.push(marker);
    }

    const vectorSource = new VectorSource({
      features: features,
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    const initialMap = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM(), // OpenStreetMap source (Free)
        }),
        vectorLayer,
      ],
      view: new View({
        center: centerCoords,
        zoom: zoom,
      }),
      controls: [], // Minimalist - no bulky controls
    });

    mapRef.current = initialMap;

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(null);
      }
    };
  }, [mapInputsKey, lat, lon, zoom, centerProp, resolvedSupermarkets]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-inner border border-gray-100 dark:border-gray-700"
      style={{ height }}
    >
      <div 
        ref={mapElement} 
        style={{ width: '100%', height: '100%' }}
        className="bg-gray-50 dark:bg-gray-900"
      />
      <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 py-1 rounded text-[8px] font-bold text-gray-400 dark:text-gray-500 pointer-events-none">
        © OpenStreetMap contributors
      </div>
    </div>
  );
};

export default StoreMap;
