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
    // Determine center
    let centerCoords;
    if (centerProp && hasValidLatLon(centerProp[0], centerProp[1])) {
        centerCoords = fromLonLat([parseFloat(centerProp[1]), parseFloat(centerProp[0])]);
    } else if (hasValidLatLon(lat, lon)) {
        centerCoords = fromLonLat([parseFloat(lon), parseFloat(lat)]);
    } else if (supermarkets.length > 0 && hasValidLatLon(supermarkets[0].latitude, supermarkets[0].longitude)) {
        centerCoords = fromLonLat([parseFloat(supermarkets[0].longitude), parseFloat(supermarkets[0].latitude)]);
    } else {
      return;
    }

    // Marker features
    const features = [];
    
    // Add markers for supermarkets array if provided
    if (supermarkets.length > 0) {
        supermarkets.forEach(s => {
            if (hasValidLatLon(s.latitude, s.longitude)) {
                const feat = new Feature({
                    geometry: new Point(fromLonLat([parseFloat(s.longitude), parseFloat(s.latitude)])),
                    name: s.name
                });
                feat.setStyle(
                    new Style({
                        image: new Icon({
                            anchor: [0.5, 1],
                            src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
                            scale: 0.06,
                        }),
                    })
                );
                features.push(feat);
            }
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
  }, [mapInputsKey, lat, lon, zoom, centerProp, supermarkets]);

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
