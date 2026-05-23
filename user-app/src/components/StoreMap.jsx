import React, { useEffect, useMemo, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Icon, Stroke } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { fetchRoute } from '../utils/routing';
import { useTranslation } from 'react-i18next';
import { MapPin, ArrowRight, ArrowLeft, ArrowUp, RotateCcw } from 'lucide-react';
import { hasValidLatLon } from '../utils/productUtils';
import { resolveCenter as resolveCenterUtil } from './storeMapUtils';

// routing uses shared `fetchRoute` util; local cache removed

const StoreMap = ({ lat, lon, zoom = 15, height = "300px", supermarkets = [], center: centerProp, directionsFrom = null, directionsTo = null }) => {
  const { t } = useTranslation();
  const mapRef = useRef();
  const mapElement = useRef();
  const routeOverlayRef = useRef(null);
  const routeLayerRef = useRef(null);
  const resolvedSupermarkets = React.useMemo(() => (Array.isArray(supermarkets) ? supermarkets : []), [supermarkets]);

  const resolveCenter = React.useCallback(() => {
    const center = resolveCenterUtil({ lat, lon, centerProp, supermarkets: resolvedSupermarkets });
    if (!center) return null;
    return fromLonLat([Number(center.longitude), Number(center.latitude)]);
  }, [lat, lon, centerProp, resolvedSupermarkets]);

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

  const buildRouteLayer = (geojson, opts = {}) => {
    const format = new GeoJSON();
    const features = format.readFeatures(geojson, { featureProjection: 'EPSG:3857' });
    const source = new VectorSource({ features });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: opts.color || '#2b6ef6', width: opts.width || 5 })
      })
    });
    return layer;
  };

  // fetchRouteGeoJSON removed — use shared `fetchRoute` util (fetchRoute handles retries and parsing)

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
          className: 'map-tiles',
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
  }, [mapInputsKey, lat, lon, zoom, centerProp, resolvedSupermarkets, resolveCenter]);

  useEffect(() => {
    const clearRoute = () => {
      if (routeLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
      }
      routeLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.__routeInfo = null;
        mapRef.current.__routeSteps = [];
      }
      if (routeOverlayRef.current) {
        routeOverlayRef.current.innerHTML = '';
        routeOverlayRef.current.style.display = 'none';
      }
    };

    if (!mapRef.current) return;

    if (!directionsFrom || !directionsTo || !hasValidLatLon(directionsFrom.latitude, directionsFrom.longitude) || !hasValidLatLon(directionsTo.latitude, directionsTo.longitude)) {
      setRoutingLoading(false);
      setShowSteps(false);
      clearRoute();
      return;
    }

    let cancelled = false;

    const loadRoute = async () => {
      try {
        setRoutingLoading(true);
        setShowSteps(false);
        clearRoute();

        const fromLon = Number(directionsFrom.longitude);
        const fromLat = Number(directionsFrom.latitude);
        const toLon = Number(directionsTo.longitude);
        const toLat = Number(directionsTo.latitude);
        const route = await fetchRoute(fromLon, fromLat, toLon, toLat);
        if (cancelled || !route || !route.geojson || !mapRef.current) return;

        const routeFeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.geojson, properties: {} }] };
        const routeLayer = buildRouteLayer(routeFeatureCollection, { color: '#0ea5e9', width: 5 });
        routeLayerRef.current = routeLayer;
        mapRef.current.addLayer(routeLayer);

        try {
          const extent = routeLayer.getSource().getExtent();
          mapRef.current.getView().fit(extent, { padding: [40, 40, 120, 40], duration: 500 });
        } catch {
          // ignore fit errors
        }

        mapRef.current.__routeInfo = { distance: route.distance, duration: route.duration };
        if (routeOverlayRef.current) {
          const km = (route.distance / 1000).toFixed(1);
          const mins = Math.round(route.duration / 60);
          const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromLat + ',' + fromLon)}&destination=${encodeURIComponent(toLat + ',' + toLon)}&travelmode=driving`;
          routeOverlayRef.current.innerHTML = `Route: ${km} km • ${mins} min <a href="${gmaps}" target="_blank" rel="noreferrer" class="ml-2 font-bold text-brand-600">${t('route_open_in_maps', 'Open in Google Maps')}</a>`;
          routeOverlayRef.current.style.display = 'block';
        }

        if (route.steps && route.steps.length > 0) {
          mapRef.current.__routeSteps = route.steps;
        }
      } catch (err) {
        console.warn('Route fetch failed', err);
        clearRoute();
      } finally {
        if (!cancelled) setRoutingLoading(false);
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [directionsFrom, directionsTo, t]);

  const [routingLoading, setRoutingLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-inner border border-gray-100 dark:border-gray-700"
      style={{ height }}
    >
      <div 
        ref={mapElement} 
        style={{ width: '100%', height: '100%' }}
        className="bg-gray-50 dark:bg-gray-900 map-dark-invert"
      />
      <div ref={routeOverlayRef} className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/85 backdrop-blur px-3 py-2 rounded-2xl text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-md border border-gray-100 dark:border-white/5" style={{ display: 'none', zIndex: 60 }} />
      {directionsFrom && directionsTo && (
        <div className="absolute top-3 left-3 z-60 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
          <button
            type="button"
            onClick={() => setShowSteps((s) => !s)}
            className="tap-target inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-gray-900/85 backdrop-blur text-xs sm:text-sm font-semibold shadow-md border border-gray-100 dark:border-white/5 active:scale-95 transition-all"
          >
            {routingLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin text-gray-600 dark:text-gray-400" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
            ) : (
              <MapPin className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            )}
            <span className="text-xs">{routingLoading ? t('loading') : t('route_turn_by_turn')}</span>
          </button>
        </div>
      )}

      {showSteps && (
        <div className="absolute left-3 bottom-3 right-3 max-h-72 overflow-auto bg-white dark:bg-gray-900/95 backdrop-blur rounded-2xl p-3 shadow-lg z-60">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-sm">Turn-by-turn</strong>
            <button onClick={() => setShowSteps(false)} className="text-xs text-gray-500">Close</button>
          </div>
          <ol className="space-y-2 text-sm">
            {mapRef.current?.__routeSteps?.length ? (
              mapRef.current.__routeSteps.map((step, idx) => {
                const instr = step.maneuver?.instruction || step.name || '';
                const type = (step.maneuver && step.maneuver.type) || '';
                const icon = type.includes('left') ? <ArrowLeft className="w-4 h-4" /> : type.includes('right') ? <ArrowRight className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />;
                return (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="pt-1 text-brand-600">{icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-xs text-gray-900 dark:text-white">{instr || step.name || 'Continue'}</div>
                      <div className="text-xs text-gray-500">{(step.distance/1000).toFixed(2)} km • {Math.round(step.duration/60)} min</div>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-gray-500">No turn-by-turn steps available</li>
            )}
          </ol>
        </div>
      )}
      <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 py-1 rounded text-[8px] font-bold text-gray-400 dark:text-gray-500 pointer-events-none">
        © OpenStreetMap contributors
      </div>
    </div>
  );
};

export default StoreMap;
