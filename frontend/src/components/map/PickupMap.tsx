import { useEffect, type ReactNode } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/cn';
import { DEFAULT_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL, pinIcon, type PinColor } from './pins';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  color?: PinColor;
  label: string;
  popup?: ReactNode;
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const key = pins.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [36, 36],
      maxZoom: 15,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** OpenStreetMap + Leaflet map with coloured pins (README D7). Attribution is required. */
export function PickupMap({
  pins,
  className,
  height = 280,
}: {
  pins: MapPin[];
  className?: string;
  height?: number | string;
}) {
  const valid = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const center: [number, number] = valid[0] ? [valid[0].lat, valid[0].lng] : DEFAULT_CENTER;
  return (
    <div
      className={cn('overflow-hidden rounded-card border border-line', className)}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        {valid.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.color)}
            title={p.label}
            alt={p.label}
          >
            <Popup>{p.popup ?? p.label}</Popup>
          </Marker>
        ))}
        <FitBounds pins={valid} />
      </MapContainer>
    </div>
  );
}
