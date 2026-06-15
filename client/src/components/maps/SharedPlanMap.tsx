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
  const [selected, setSelected] = useState<PlanMapItem | null>(null);
  const [mapError, setMapError] = useState('');
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
      zoom: mapItems.length === 1 ? 14 : 10,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const markers = mapItems.map((item) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'h-5 w-5 rounded-full border-[3px] border-white bg-emerald-700 shadow-md';
      element.setAttribute('aria-label', `Open ${item.title || item.inventoryCode || 'site'}`);
      element.addEventListener('click', () => {
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
    };
  }, [mapItems, mapboxToken, publicMode, shareToken]);

  if (!mapItems.length) return <MapEmptyState />;
  if (mapError) return <MapEmptyState message={mapError} />;

  return (
    <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100" aria-label="Outdoor inventory map">
      <div ref={containerRef} className="h-[360px] w-full md:h-[500px]" role="region" aria-label={`${mapItems.length} outdoor site locations`} />
      {selected ? <PlanMapMarkerPopup item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
};

export default SharedPlanMap;
