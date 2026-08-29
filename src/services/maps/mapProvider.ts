export type MapMode = 'street' | 'satellite' | 'fog_of_war';

export interface MapProviderConfig {
  styleUrl: any;
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
  attribution: string;
  mode: MapMode;
  isSatelliteConfigured: boolean;
}

// 1. OpenMapTiles & OpenFreeMap Vector Tile Styles (Production-safe, 100% open, zero client API key required)
export const OPENFREEMAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
export const OPENFREEMAP_POSITRON_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// 2. Satellite Provider Check (Official Esri ArcGIS Imagery / Basemap Styles v2)
export function getEsriToken(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    if (env.VITE_ESRI_BASEMAP_TOKEN) return env.VITE_ESRI_BASEMAP_TOKEN;
    if (env.VITE_ESRI_API_KEY) return env.VITE_ESRI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_ESRI_BASEMAP_TOKEN) return process.env.VITE_ESRI_BASEMAP_TOKEN;
    if (process.env.VITE_ESRI_API_KEY) return process.env.VITE_ESRI_API_KEY;
  }
  return '';
}

export function getCustomSatelliteUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAP_SATELLITE_URL) {
    return (import.meta as any).env.VITE_MAP_SATELLITE_URL;
  }
  if (typeof process !== 'undefined' && process.env?.VITE_MAP_SATELLITE_URL) {
    return process.env.VITE_MAP_SATELLITE_URL;
  }
  return '';
}

export function getEsriImageryStyleUrl(token?: string): string {
  const activeToken = token || getEsriToken();
  if (!activeToken) return '';
  return `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?token=${encodeURIComponent(
    activeToken
  )}`;
}

export function isSatelliteConfigured(): boolean {
  // Esri World Imagery public raster tile server is built-in and always available with zero API key.
  // If a custom token/URL is configured, it will use that instead.
  return true;
}

export function isEsriTokenConfigured(): boolean {
  const token = getEsriToken();
  return Boolean(token && token.trim().length > 0);
}

export function getSatelliteProviderName(): string {
  const token = getEsriToken();
  if (token && token.trim().length > 0) {
    return 'Esri ArcGIS Imagery (Basemap Styles v2)';
  }
  const customUrl = getCustomSatelliteUrl();
  if (customUrl && customUrl.trim().length > 0) {
    return 'Custom Satellite Provider';
  }
  return 'Esri World Imagery';
}

export function getMapStyleForMode(mode: MapMode): any {
  if (mode === 'satellite') {
    const customUrl = getCustomSatelliteUrl();
    if (customUrl && customUrl.trim().length > 0) {
      return customUrl;
    }
    const token = getEsriToken();
    if (token && token.trim().length > 0) {
      return getEsriImageryStyleUrl(token);
    }
    return ESRI_WORLD_IMAGERY_STYLE;
  }
  if (mode === 'fog_of_war') {
    return OPENFREEMAP_LIBERTY_STYLE;
  }
  return OPENFREEMAP_LIBERTY_STYLE;
}

export function getMapAttributionForMode(mode: MapMode): string {
  if (mode === 'satellite') {
    return '© OpenStreetMap contributors, © Esri, Maxar, Earthstar Geographics, GIS User Community';
  }
  return '© OpenStreetMap contributors, © OpenFreeMap';
}

// 3. Esri World Imagery Public Raster Tiles (Standard zero-key global satellite imagery)
export const ESRI_WORLD_IMAGERY_STYLE = {
  version: 8 as const,
  name: 'Esri World Imagery',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    'esri-satellite': {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, Maxar, Earthstar Geographics, GIS User Community',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster' as const,
      source: 'esri-satellite',
      minzoom: 0,
      paint: {
        'raster-opacity': 1,
      },
    },
  ],
};

// 4. OpenMapTiles / OSM Standard Fallback Style
export const OSM_STANDARD_STYLE = {
  version: 8 as const,
  name: 'OpenStreetMap Standard',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    'osm-standard': {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © OpenFreeMap',
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster' as const,
      source: 'osm-standard',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

/**
 * Returns the production-safe MapLibre provider configuration.
 * Uses OpenFreeMap Liberty vector tile infrastructure without client-exposed secrets or watermarks.
 */
export function getMapLibreConfig(mode: MapMode = 'street'): MapProviderConfig {
  return {
    styleUrl: getMapStyleForMode(mode),
    defaultCenter: [105.7958, 21.0285], // Cau Giay district center, Hanoi
    defaultZoom: 14.5,
    attribution: getMapAttributionForMode(mode),
    mode,
    isSatelliteConfigured: true,
  };
}
