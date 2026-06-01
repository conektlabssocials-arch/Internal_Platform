import 'mapbox-gl/dist/mapbox-gl.css';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

type LocationPickerProps = {
  latitude?: number;
  longitude?: number;
  compact?: boolean;
  onChange: (location: { latitude: number; longitude: number }) => void;
};

const defaultCenter: [number, number] = [77.5946, 12.9716];

const LocationPicker = ({ latitude, longitude, compact, onChange }: LocationPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [mapError, setMapError] = useState('');
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;

    if (!map || !container) {
      return;
    }

    const resize = () => map.resize();
    const animationFrame = window.requestAnimationFrame(resize);
    const timeoutId = window.setTimeout(resize, 250);
    const observer = new ResizeObserver(resize);

    observer.observe(container);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [compact]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxToken) {
      if (!mapboxToken) {
        setMapError('Mapbox token is not configured.');
      }

      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: longitude !== undefined && latitude !== undefined ? [longitude, latitude] : defaultCenter,
      zoom: latitude !== undefined && longitude !== undefined ? 14 : 11,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.once('load', () => map.resize());
    window.setTimeout(() => map.resize(), 250);

    const setMarker = (lngLat: mapboxgl.LngLat, shouldNotify = true) => {
      if (!markerRef.current) {
        markerRef.current = new mapboxgl.Marker({ draggable: true })
          .setLngLat(lngLat)
          .addTo(map);

        markerRef.current.on('dragend', () => {
          const nextLngLat = markerRef.current?.getLngLat();

          if (nextLngLat) {
            onChangeRef.current({ latitude: nextLngLat.lat, longitude: nextLngLat.lng });
          }
        });
      } else {
        markerRef.current.setLngLat(lngLat);
      }

      if (shouldNotify) {
        onChangeRef.current({ latitude: lngLat.lat, longitude: lngLat.lng });
      }
    };

    map.on('click', (event) => setMarker(event.lngLat));

    if (latitude !== undefined && longitude !== undefined) {
      setMarker(new mapboxgl.LngLat(longitude, latitude), false);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!mapRef.current || latitude === undefined || longitude === undefined) {
      return;
    }

    const lngLat = new mapboxgl.LngLat(longitude, latitude);
    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ draggable: true })
        .setLngLat(lngLat)
        .addTo(mapRef.current);

      markerRef.current.on('dragend', () => {
        const nextLngLat = markerRef.current?.getLngLat();

        if (nextLngLat) {
          onChangeRef.current({ latitude: nextLngLat.lat, longitude: nextLngLat.lng });
        }
      });
    } else {
      markerRef.current.setLngLat(lngLat);
    }
    mapRef.current.flyTo({ center: lngLat, zoom: 14, essential: false });
  }, [latitude, longitude]);

  if (mapError) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {mapError}
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={containerRef}
        className={[
          'relative w-full max-w-full overflow-hidden rounded-md border border-slate-200 [&_.mapboxgl-canvas]:!h-full [&_.mapboxgl-canvas]:!w-full',
          compact ? 'h-56' : 'h-80',
        ].join(' ')}
      />
      <p className="mt-2 text-xs text-slate-500">
        Selected: {latitude?.toFixed(6) || '-'}, {longitude?.toFixed(6) || '-'}
      </p>
    </div>
  );
};

export default LocationPicker;
