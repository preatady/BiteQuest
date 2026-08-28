import { UnifiedPlace } from './types';
import { classifyVenue, CANONICAL_CATEGORIES } from './categoryNormalizer';
import { inferVietnamLocation } from './geoapify/geoapifyPlaces';
import { getDistance } from 'geolib';

// Checks if a string or property value looks like a food/beverage or commercial venue
export function isFoodOrVenueFeature(properties: any, layerId?: string): boolean {
  if (!properties) return false;

  const rawName = String(
    properties.name ||
    properties['name:vi'] ||
    properties['name:latin'] ||
    properties.name_en ||
    properties['name:en'] ||
    ''
  ).trim();

  if (!rawName || rawName.length < 2) return false;

  // Ignore pure road names, numbers or administrative boundary names
  if (/^(đường|phố|ngõ|ngách|quốc lộ|ql|tỉnh lộ|đt|tòa nhà|khu đô thị|ct\d+|km\d+)/i.test(rawName)) {
    return false;
  }

  const pClass = String(
    properties.class ||
    properties.subclass ||
    properties.amenity ||
    properties.shop ||
    properties.cuisine ||
    properties.category ||
    properties.type ||
    layerId ||
    ''
  ).toLowerCase();

  const foodClassKeywords = [
    'cafe',
    'coffee',
    'restaurant',
    'fast_food',
    'food',
    'bakery',
    'bar',
    'pub',
    'ice_cream',
    'biergarten',
    'food_court',
    'tea',
    'beverages',
    'deli',
    'caterer',
    'confectionery',
    'pastry',
    'supermarket',
    'convenience',
    'shop',
    'commercial',
    'poi',
  ];

  if (foodClassKeywords.some((k) => pClass.includes(k))) {
    return true;
  }

  // Name keyword heuristics for Vietnamese food & drink venues
  const vietnameseFoodNameKeywords = [
    'coffee',
    'cafe',
    'cà phê',
    'quán',
    'nhà hàng',
    'tiệm',
    'bánh',
    'phở',
    'bún',
    'miến',
    'mì',
    'hủ tiếu',
    'bánh mì',
    'cơm',
    'cơm chay',
    'cơm tấm',
    'cơm niêu',
    'chay',
    'thực dưỡng',
    'lẩu',
    'nướng',
    'bbq',
    'trà sữa',
    'trà',
    'chè',
    'cháo',
    'xôi',
    'vịt',
    'gà',
    'dê',
    'bò',
    'hải sản',
    'nước mía',
    'sinh tố',
    'bò kho',
    'nem',
    'chả',
    'ốc',
    'bia',
    'nhậu',
    'dimsum',
    'pizza',
    'burger',
    'sushi',
    'steak',
  ];

  const lowerName = rawName.toLowerCase();
  if (vietnameseFoodNameKeywords.some((kw) => lowerName.includes(kw))) {
    return true;
  }

  return false;
}

// Convert a MapLibre vector tile feature to a UnifiedPlace
export function convertVectorFeatureToPlace(
  feature: any,
  referenceLocation?: { latitude: number; longitude: number }
): UnifiedPlace | null {
  if (!feature || !feature.properties) return null;

  const props = feature.properties;
  const name = String(
    props.name ||
    props['name:vi'] ||
    props['name:latin'] ||
    props.name_en ||
    props['name:en'] ||
    ''
  ).trim();

  if (!name || name.length < 2) return null;

  let lat: number | undefined;
  let lon: number | undefined;

  if (feature.geometry) {
    if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
      lon = feature.geometry.coordinates[0];
      lat = feature.geometry.coordinates[1];
    } else if (feature.geometry.coordinates && Array.isArray(feature.geometry.coordinates)) {
      // Polygon / MultiPoint center fallback
      const coords = feature.geometry.coordinates;
      const flatCoords: [number, number][] = [];
      const extractPoints = (arr: any) => {
        if (Array.isArray(arr) && arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
          flatCoords.push([arr[0], arr[1]]);
        } else if (Array.isArray(arr)) {
          arr.forEach(extractPoints);
        }
      };
      extractPoints(coords);
      if (flatCoords.length > 0) {
        let sumLon = 0;
        let sumLat = 0;
        flatCoords.forEach(([x, y]) => {
          sumLon += x;
          sumLat += y;
        });
        lon = sumLon / flatCoords.length;
        lat = sumLat / flatCoords.length;
      }
    }
  }

  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const pClass = String(
    props.class ||
    props.subclass ||
    props.amenity ||
    props.shop ||
    props.cuisine ||
    props.category ||
    feature.layer?.id ||
    'restaurant'
  );

  const classification = classifyVenue({
    name,
    category: pClass,
    categories: [props.class, props.subclass, props.amenity, props.shop, props.cuisine].filter(Boolean),
  });

  const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;
  const loc = inferVietnamLocation(
    lat,
    lon,
    props.district || props['addr:district'],
    props.city || props['addr:city'],
    props.state || props['addr:province']
  );

  const dist = referenceLocation
    ? getDistance(referenceLocation, { latitude: lat, longitude: lon })
    : 0;

  const id = `map_poi_${props.osm_id || props.id || `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${lat.toFixed(4)}_${lon.toFixed(4)}`}`;

  const address = props['addr:street']
    ? `${props['addr:housenumber'] || ''} ${props['addr:street']}`.trim()
    : `${loc.district}, ${loc.city}`;

  return {
    id,
    providerId: props.osm_id ? String(props.osm_id) : undefined,
    name,
    category: classification.category,
    categoryLabel: catMeta.label,
    address,
    district: loc.district,
    city: loc.city,
    latitude: lat,
    longitude: lon,
    distanceMeters: dist,
  };
}

// Scans all rendered features across vector map tiles and returns valid places
export function scanRenderedMapPlaces(
  map: any,
  referenceLocation?: { latitude: number; longitude: number }
): UnifiedPlace[] {
  if (!map || typeof map.queryRenderedFeatures !== 'function') return [];

  try {
    const renderedFeatures = map.queryRenderedFeatures();
    if (!Array.isArray(renderedFeatures) || renderedFeatures.length === 0) return [];

    const results: UnifiedPlace[] = [];
    const seen = new Set<string>();

    for (const f of renderedFeatures) {
      if (!isFoodOrVenueFeature(f.properties, f.layer?.id)) continue;

      const place = convertVectorFeatureToPlace(f, referenceLocation);
      if (!place) continue;

      const key = `${place.name.toLowerCase().trim()}_${place.latitude.toFixed(3)}_${place.longitude.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push(place);
    }

    return results;
  } catch (err) {
    console.warn('[vectorTileScanner] Error scanning rendered map features:', err);
    return [];
  }
}
