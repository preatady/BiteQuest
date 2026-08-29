export type MapMode = 'street' | 'satellite' | 'fog_of_war';

export interface MapProviderConfig {
  styleUrl: any;
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
  attribution: string;
  mode: MapMode;
  isSatelliteConfigured: boolean;
}

// 1. Primary Base Map: Official OpenFreeMap Liberty Vector Style (100% open, zero client API key required)
export const OPENFREEMAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
export const OPENFREEMAP_POSITRON_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// 2. High-Performance Fallback: Carto Voyager Basemap (Used ONLY if OpenFreeMap fails to load)
export const CARTO_VOYAGER_STYLE = {
  version: 8 as const,
  name: 'Carto Voyager (Fallback Street Map)',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-voyager': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster' as const,
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 100,
        'raster-contrast': 0.05,
      },
    },
  ],
};

// 4. Satellite Provider Check (Official Esri ArcGIS Imagery / Basemap Styles v2)
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

export function getCustomStreetUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAP_STREET_URL) {
    return (import.meta as any).env.VITE_MAP_STREET_URL;
  }
  if (typeof process !== 'undefined' && process.env?.VITE_MAP_STREET_URL) {
    return process.env.VITE_MAP_STREET_URL;
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

// 5. Esri World Imagery Public Raster Tiles (Standard zero-key global satellite imagery)
export const ESRI_WORLD_IMAGERY_STYLE = {
  version: 8 as const,
  name: 'Esri World Imagery',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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
        'raster-fade-duration': 100,
      },
    },
  ],
};

// 6. OpenStreetMap Standard Style
export const OSM_STANDARD_STYLE = {
  version: 8 as const,
  name: 'OpenStreetMap Standard',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'osm-standard': {
      type: 'raster' as const,
      tiles: [
        'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster' as const,
      source: 'osm-standard',
      minzoom: 0,
      maxzoom: 19,
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 100,
      },
    },
  ],
};

export function getMapStyleForMode(mode: MapMode, useFallback: boolean = false): any {
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

  const customStreet = getCustomStreetUrl();
  if (customStreet && customStreet.trim().length > 0) {
    return customStreet;
  }

  // If fallback is explicitly requested due to OpenFreeMap load failure
  if (useFallback) {
    return CARTO_VOYAGER_STYLE;
  }

  // Primary Base Map: OpenFreeMap Liberty
  return OPENFREEMAP_LIBERTY_STYLE;
}

export function getMapAttributionForMode(mode: MapMode, useFallback: boolean = false): string {
  if (mode === 'satellite') {
    return '© Esri, Maxar, Earthstar Geographics, GIS User Community';
  }
  if (useFallback) {
    return '© OpenStreetMap contributors, © CARTO';
  }
  return '© OpenStreetMap contributors, © OpenFreeMap';
}

/**
 * Returns the production-safe MapLibre provider configuration.
 * Uses OpenFreeMap Liberty as primary base map with zero client-exposed secrets or watermarks.
 */
export function getMapLibreConfig(mode: MapMode = 'street', useFallback: boolean = false): MapProviderConfig {
  return {
    styleUrl: getMapStyleForMode(mode, useFallback),
    defaultCenter: [105.7958, 21.0285], // Cau Giay district center, Hanoi
    defaultZoom: 14.5,
    attribution: getMapAttributionForMode(mode, useFallback),
    mode,
    isSatelliteConfigured: true,
  };
}


