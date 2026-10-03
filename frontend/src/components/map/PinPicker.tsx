import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import { Crosshair, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DEFAULT_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL, pinIcon } from './pins';

export interface LatLng {
  lat: number;
  lng: number;
}

/** India bounding box (ARCHITECTURE §4.2 CHECK constraints). */
export const inIndia = (p: LatLng) => p.lat >= 6 && p.lat <= 38 && p.lng >= 68 && p.lng <= 98;

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);
  return null;
}

/** Click or drag to set a location. Used by onboarding, profile and the post form. */
export function PinPicker({
  value,
  onChange,
  height = 260,
  invalid,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  height?: number;
  invalid?: boolean;
}) {
  const markerRef = useRef<LeafletMarker>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const center = useMemo<[number, number]>(
    () => (value ? [value.lat, value.lng] : DEFAULT_CENTER),
    // only initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pick = (p: LatLng) => {
    const rounded = { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 };
    if (!inIndia(rounded)) {
      setGeoError('Please choose a location inside India.');
      return;
    }
    setGeoError(null);
    onChange(rounded);
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGeoError('Could not get your location. Tap the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="space-y-2">
      <div
        className={`overflow-hidden rounded-card border ${invalid ? 'border-red' : 'border-line'}`}
        style={{ height }}
      >
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
          <ClickHandler onPick={pick} />
          <Recenter value={value} />
          {value && (
            <Marker
              ref={markerRef}
              position={[value.lat, value.lng]}
              icon={pinIcon('primary')}
              draggable
              eventHandlers={{
                dragend: () => {
                  const m = markerRef.current;
                  if (m) {
                    const ll = m.getLatLng();
                    pick({ lat: ll.lat, lng: ll.lng });
                  }
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate">
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} aria-hidden />
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Tap the map to drop a pin'}
        </span>
        <Button
          size="sm"
          variant="secondary"
          icon={<Crosshair size={14} />}
          onClick={useMyLocation}
          loading={locating}
        >
          Use my location
        </Button>
      </div>
      {geoError && (
        <p className="text-xs text-red-700" role="alert">
          {geoError}
        </p>
      )}
    </div>
  );
}
