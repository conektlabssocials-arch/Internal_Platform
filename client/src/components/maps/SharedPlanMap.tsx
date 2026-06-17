import 'mapbox-gl/dist/mapbox-gl.css';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import { trackPublicShareEvent } from '../../api/shareApi';
import type { PlanMapItem } from '../../types/share';
import MapEmptyState from './MapEmptyState';
import PlanMapMarkerPopup from './PlanMapMarkerPopup';

const openedTokens = new Set<string>();

const SharedPlanMap = ({
  mapItems,
  shareToken,
  publicMode = false,
}: {
  mapItems: PlanMapItem[];
  shareToken?: string;
  publicMode?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selected, setSelected] = useState<PlanMapItem | null>(null);
  const [mapError, setMapError] = useState('');
  const [is3D, setIs3D] = useState(true);
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!mapItems.length || !containerRef.current || !mapboxToken) {
      if (mapItems.length && !mapboxToken) setMapError('Map preview is unavailable because the Mapbox token is not configured.');
      return;
    }

    mapboxgl.accessToken = mapboxToken;
    const first = mapItems[0];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [first.longitude, first.latitude],
      zoom: mapItems.length === 1 ? 15 : 10,
      pitch: is3D ? 55 : 0,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('style.load', () => {
      const styleLayers = map.getStyle()?.layers || [];
      const labelLayerId = styleLayers.find(
        (layer) => layer.type === 'symbol' && (layer.layout as { 'text-field'?: unknown })?.['text-field'],
      )?.id;
      if (map.getLayer('3d-buildings')) return;
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#cbd5e1',
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'height']],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.6,
          },
        },
        labelLayerId,
      );
    });

    // Clicking the map (anywhere that is not a marker) dismisses the popup.
    map.on('click', () => setSelected(null));

    const markers = mapItems.map((item) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'h-5 w-5 rounded-full border-[3px] border-white bg-emerald-700 shadow-md';
      element.setAttribute('aria-label', `Open ${item.title || item.inventoryCode || 'site'}`);
      element.addEventListener('click', (event) => {
        // Keep the click from also reaching the map handler above.
        event.stopPropagation();
        setSelected(item);
        if (publicMode && shareToken) {
          void trackPublicShareEvent(shareToken, {
            eventType: 'pin_clicked',
            inventoryCode: item.inventoryCode,
            title: item.title,
          }).catch(() => undefined);
        }
      });
      return new mapboxgl.Marker({ element })
        .setLngLat([item.longitude, item.latitude])
        .addTo(map);
    });

    map.once('load', () => {
      map.resize();
      if (mapItems.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        mapItems.forEach((item) => bounds.extend([item.longitude, item.latitude]));
        map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 0 });
      }
    });

    if (publicMode && shareToken && !openedTokens.has(shareToken)) {
      openedTokens.add(shareToken);
      void trackPublicShareEvent(shareToken, { eventType: 'map_opened' }).catch(() => undefined);
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
    // `is3D` only sets the initial pitch; toggling afterwards uses easeTo so the
    // map is not torn down and recreated on every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapItems, mapboxToken, publicMode, shareToken]);

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const toggle3D = () => {
    setIs3D((prev) => {
      const next = !prev;
      mapRef.current?.easeTo({ pitch: next ? 55 : 0, duration: 600 });
      return next;
    });
  };

  if (!mapItems.length) return <MapEmptyState />;
  if (mapError) return <MapEmptyState message={mapError} />;

  return (
    <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100" aria-label="Outdoor inventory map">
      <div
        ref={containerRef}
        className="h-[min(68svh,430px)] min-h-[320px] w-full md:h-[500px]"
        role="region"
        aria-label={`${mapItems.length} outdoor site locations`}
      />
      <button
        type="button"
        onClick={toggle3D}
        aria-pressed={is3D}
        className="absolute left-3 top-3 z-10 rounded-md border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur hover:border-emerald-400 hover:text-emerald-700"
      >
        {is3D ? 'View in 2D' : 'View in 3D'}
      </button>
      {selected ? <PlanMapMarkerPopup item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
};

export default SharedPlanMap;
