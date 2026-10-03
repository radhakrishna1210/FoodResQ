import L from 'leaflet';

export const PIN_COLORS = {
  primary: '#1B70BE',
  teal: '#27B5C9',
  gold: '#B8860B',
  purple: '#715BB0',
  red: '#D9534F',
  green: '#2E9E6B',
} as const;
export type PinColor = keyof typeof PIN_COLORS;

const cache = new Map<string, L.DivIcon>();

/** SVG teardrop pin as a divIcon (avoids Leaflet's default image assets under Vite). */
export function pinIcon(color: PinColor = 'primary'): L.DivIcon {
  const existing = cache.get(color);
  if (existing) return existing;
  const hex = PIN_COLORS[color];
  const icon = L.divIcon({
    className: 'frq-pin',
    iconSize: [28, 38],
    iconAnchor: [14, 37],
    popupAnchor: [0, -32],
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 38 14 38s14-13.7 14-24.1C28 6.2 21.7 0 14 0z" fill="${hex}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
  });
  cache.set(color, icon);
  return icon;
}

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Pune default (seed data, WALKTHROUGH §2.2). */
export const DEFAULT_CENTER: [number, number] = [18.4636, 73.8682];
