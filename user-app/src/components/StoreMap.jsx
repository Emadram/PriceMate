import React, { useEffect, useRef } from 'react';
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

const StoreMap = ({ lat, lon, zoom = 15, height = "300px" }) => {
  const mapRef = useRef();
  const mapElement = useRef();

  useEffect(() => {
    if (!lat || !lon) return;

    // Center coordinates
    const center = fromLonLat([parseFloat(lon), parseFloat(lat)]);

    // Marker feature
    const marker = new Feature({
      geometry: new Point(center),
    });

    // Marker style
    marker.setStyle(
      new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', // Default pin icon
          scale: 0.05,
        }),
      })
    );

    const vectorSource = new VectorSource({
      features: [marker],
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
        center: center,
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
  }, [lat, lon, zoom]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-inner border border-gray-100 dark:border-gray-700">
      <div 
        ref={mapElement} 
        style={{ width: '100%', height: height }}
        className="bg-gray-50 dark:bg-gray-900"
      />
      <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 py-1 rounded text-[8px] font-bold text-gray-400 dark:text-gray-500 pointer-events-none">
        © OpenStreetMap contributors
      </div>
    </div>
  );
};

export default StoreMap;
