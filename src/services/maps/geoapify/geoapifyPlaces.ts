import { PlaceProvider, NearbySearchOptions, UnifiedPlace } from '../types';
import { GeoapifyPlaceFeatureSchema } from './geoapifyTypes';
import { getDistance } from 'geolib';
import { INITIAL_PLACES } from '../../../data/seedData';
import { classifyVenue, CANONICAL_CATEGORIES } from '../categoryNormalizer';

interface CacheEntry {
  timestamp: number;
  latitude: number;
  longitude: number;
  places: UnifiedPlace[];
}

export function inferVietnamLocation(
  lat: number,
  lon: number,
  tagDistrict?: string,
  tagCity?: string,
  tagProvince?: string
): { district: string; city: string } {
  let district = tagDistrict?.trim() || '';
  let city = tagCity?.trim() || tagProvince?.trim() || '';

  if (district) {
    district = district.replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '').trim();
  }

  // Coordinate heuristics for Vietnam provinces & major cities
  if (!city || city === 'Việt Nam') {
    if (lat >= 21.24 && lat <= 21.45 && lon >= 105.45 && lon <= 105.78) {
      city = 'Vĩnh Phúc';
      if (!district) district = 'Vĩnh Yên';
    } else if (lat >= 20.80 && lat <= 21.35 && lon >= 105.65 && lon <= 106.10) {
      city = 'Hà Nội';
      if (!district) {
        if (lat >= 21.015 && lat <= 21.045 && lon >= 105.840 && lon <= 105.870) district = 'Hoàn Kiếm';
        else if (lat >= 21.050 && lat <= 21.095 && lon >= 105.795 && lon <= 105.860) district = 'Tây Hồ';
        else if (lat >= 21.025 && lat <= 21.050 && lon >= 105.805 && lon <= 105.842) district = 'Ba Đình';
        else if (lat >= 20.998 && lat <= 21.028 && lon >= 105.815 && lon <= 105.845) district = 'Đống Đa';
        else if (lat >= 20.985 && lat <= 21.020 && lon >= 105.840 && lon <= 105.875) district = 'Hai Bà Trưng';
        else if (lat >= 21.015 && lat <= 21.055 && lon >= 105.770 && lon <= 105.810) district = 'Cầu Giấy';
        else if (lat >= 20.980 && lat <= 21.015 && lon >= 105.785 && lon <= 105.825) district = 'Thanh Xuân';
        else if (lat >= 20.940 && lat <= 20.990 && lon >= 105.740 && lon <= 105.790) district = 'Hà Đông';
        else if (lat >= 20.995 && lat <= 21.060 && lon >= 105.735 && lon <= 105.780) district = 'Nam Từ Liêm';
        else if (lat >= 21.020 && lat <= 21.080 && lon >= 105.870 && lon <= 105.930) district = 'Long Biên';
        else district = 'Cầu Giấy';
      }
    } else if (lat >= 10.60 && lat <= 11.05 && lon >= 106.40 && lon <= 107.05) {
      city = 'TP. Hồ Chí Minh';
      if (!district) district = 'Quận 1';
    } else if (lat >= 15.90 && lat <= 16.20 && lon >= 108.05 && lon <= 108.35) {
      city = 'Đà Nẵng';
      if (!district) district = 'Hải Châu';
    } else if (lat >= 15.80 && lat <= 15.95 && lon >= 108.25 && lon <= 108.45) {
      city = 'Quảng Nam';
      if (!district) district = 'Hội An';
    } else if (lat >= 20.70 && lat <= 21.05 && lon >= 106.50 && lon <= 106.90) {
      city = 'Hải Phòng';
      if (!district) district = 'Ngô Quyền';
    } else if (lat >= 16.35 && lat <= 16.60 && lon >= 107.45 && lon <= 107.75) {
      city = 'Thừa Thiên Huế';
      if (!district) district = 'TP. Huế';
    } else if (lat >= 11.85 && lat <= 12.05 && lon >= 108.35 && lon <= 108.55) {
      city = 'Lâm Đồng';
      if (!district) district = 'Đà Lạt';
    } else if (lat >= 12.15 && lat <= 12.35 && lon >= 109.10 && lon <= 109.25) {
      city = 'Khánh Hòa';
      if (!district) district = 'Nha Trang';
    } else if (lat >= 9.95 && lat <= 10.15 && lon >= 105.65 && lon <= 105.85) {
      city = 'Cần Thơ';
      if (!district) district = 'Ninh Kiều';
    } else if (lat >= 22.25 && lat <= 22.40 && lon >= 103.75 && lon <= 103.95) {
      city = 'Lào Cai';
      if (!district) district = 'Sa Pa';
    } else if (lat >= 20.15 && lat <= 20.35 && lon >= 105.85 && lon <= 106.05) {
      city = 'Ninh Bình';
      if (!district) district = 'TP. Ninh Bình';
    } else if (lat >= 10.25 && lat <= 10.45 && lon >= 107.00 && lon <= 107.20) {
      city = 'Bà Rịa - Vũng Tàu';
      if (!district) district = 'TP. Vũng Tàu';
    } else {
      city = 'Việt Nam';
      if (!district) district = 'Khu vực';
    }
  }

  if (!district) {
    district = city;
  }

  return { district, city };
}

export class GeoapifyPlaceProvider implements PlaceProvider {
  readonly providerName = 'geoapify';
  private apiKey: string;
  private cache: CacheEntry[] = [];
  private readonly CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
  private readonly CACHE_RADIUS_THRESHOLD = 60; // 60 meters

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim() || '';
  }

  private getEffectiveApiKey(): string {
    if (this.apiKey && this.apiKey.trim().length > 0) {
      return this.apiKey.trim();
    }
    const envKey =
      (typeof process !== 'undefined'
        ? process.env?.GEOAPIFY_SERVER_KEY || process.env?.GEOAPIFY_API_KEY || process.env?.VITE_GEOAPIFY_API_KEY
        : '') || '';
    return typeof envKey === 'string' && envKey !== 'undefined' && envKey !== 'null' ? envKey.trim() : '';
  }

  isConfigured(): boolean {
    return Boolean(this.getEffectiveApiKey());
  }

  async searchNearby(options: NearbySearchOptions): Promise<UnifiedPlace[]> {
    const { latitude, longitude, radiusMeters = 3000, limit = 100 } = options;
    const effectiveKey = this.getEffectiveApiKey();

    // Check memory cache
    const now = Date.now();
    const cached = this.cache.find(
      (c) =>
        now - c.timestamp < this.CACHE_TTL_MS &&
        getDistance({ latitude, longitude }, { latitude: c.latitude, longitude: c.longitude }) <= this.CACHE_RADIUS_THRESHOLD
    );

    if (cached) {
      return cached.places.slice(0, limit);
    }

    if (!effectiveKey) {
      return this.fetchFromOverpassOrLocal(latitude, longitude, radiusMeters, limit);
    }

    try {
      // Expanded Geoapify POI categories for truthful F&B discovery
      const categories = [
        'catering.restaurant',
        'catering.cafe',
        'catering.fast_food',
        'catering.food_court',
        'catering.ice_cream',
        'catering.bar',
        'catering.pub',
        'commercial.food_and_drink.bakery',
        'commercial.food_and_drink.confectionery',
      ].join(',');

      const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${longitude},${latitude},${radiusMeters}&bias=proximity:${longitude},${latitude}&limit=${limit}&apiKey=${effectiveKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        return this.fetchFromOverpassOrLocal(latitude, longitude, radiusMeters, limit);
      }

      const json = await res.json();
      
      // Resilient per-feature validation: Extract raw features array
      const rawFeatures: any[] = Array.isArray(json?.features) ? json.features : [];
      if (rawFeatures.length === 0) {
        return this.fetchFromOverpassOrLocal(latitude, longitude, radiusMeters, limit);
      }

      const validFeatures: any[] = [];
      for (const f of rawFeatures) {
        // Individual feature validation ensures a single corrupted POI never fails the batch
        const parsedFeature = GeoapifyPlaceFeatureSchema.safeParse(f);
        if (parsedFeature.success && parsedFeature.data?.properties?.lat && parsedFeature.data?.properties?.lon) {
          validFeatures.push(parsedFeature.data);
        } else if (f?.properties && typeof f.properties.lat === 'number' && typeof f.properties.lon === 'number' && f.properties.name) {
          validFeatures.push(f);
        }
      }

      if (validFeatures.length === 0) {
        return this.fetchFromOverpassOrLocal(latitude, longitude, radiusMeters, limit);
      }

      const results: UnifiedPlace[] = validFeatures
        .filter((f) => Boolean(f.properties?.name && String(f.properties.name).trim().length > 0))
        .map((f, idx) => {
          const p = f.properties;
          const placeLat = Number(p.lat);
          const placeLng = Number(p.lon);
          const dist =
            p.distance ||
            getDistance({ latitude, longitude }, { latitude: placeLat, longitude: placeLng });

          const cats: string[] = Array.isArray(p.categories) ? p.categories : [];
          const placeName = String(p.name || 'Quán ẩm thực').trim();
          const classification = classifyVenue({
            name: placeName,
            categories: cats,
          });
          const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;
          const category = classification.category;
          const categoryLabel = catMeta.label;
          const loc = inferVietnamLocation(placeLat, placeLng, p.district, p.city, p.state);

          return {
            id: `geoapify_${p.place_id || idx}`,
            providerId: p.place_id ? String(p.place_id) : undefined,
            name: placeName,
            category,
            categoryLabel,
            categories: cats,
            address: p.formatted || `${p.housenumber || ''} ${p.street || ''}, ${loc.district}`.trim(),
            district: loc.district,
            city: loc.city,
            latitude: placeLat,
            longitude: placeLng,
            distanceMeters: dist,
          };
        });

      // Sort by actual distance
      results.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

      // Cache results
      this.cache.push({
        timestamp: now,
        latitude,
        longitude,
        places: results,
      });
      if (this.cache.length > 20) this.cache.shift();

      return results.slice(0, limit);
    } catch {
      return this.fetchFromOverpassOrLocal(latitude, longitude, radiusMeters, limit);
    }
  }

  private async fetchFromOverpassOrLocal(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    limit: number
  ): Promise<UnifiedPlace[]> {
    const effectiveRadius = Math.min(Math.max(radiusMeters, 2000), 6500);
    const osmPlaces: UnifiedPlace[] = [];

    // TIER 1: Rapid Photon OSM POI Discovery (Ultra-fast ~100ms response)
    const photonQueries = ['cafe', 'quan an', 'nha hang', 'banh mi', 'pho'];
    try {
      const photonPromises = photonQueries.map(async (q) => {
        try {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${latitude}&lon=${longitude}&limit=25`;
          const pRes = await fetch(photonUrl, { signal: AbortSignal.timeout(2800) });
          if (!pRes.ok) return [];
          const pData = await pRes.json();
          if (!Array.isArray(pData?.features)) return [];
          return pData.features;
        } catch {
          return [];
        }
      });

      const photonResults = await Promise.all(photonPromises);
      for (const featureList of photonResults) {
        for (const f of featureList) {
          const p = f.properties;
          const coords = f.geometry?.coordinates;
          if (!p?.name || !Array.isArray(coords) || coords.length < 2) continue;
          const lon = coords[0];
          const lat = coords[1];
          const dist = getDistance({ latitude, longitude }, { latitude: lat, longitude: lon });
          if (dist > effectiveRadius) continue;

          const osmKey = p.osm_key || 'amenity';
          const osmVal = p.osm_value || 'restaurant';
          const classification = classifyVenue({
            name: p.name,
            category: osmVal,
            categories: [osmKey, osmVal].filter(Boolean),
          });
          const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;
          const loc = inferVietnamLocation(lat, lon, p.district || p.county, p.city, p.state);

          osmPlaces.push({
            id: `photon_${p.osm_id || Math.random()}`,
            providerId: p.osm_id ? String(p.osm_id) : undefined,
            name: String(p.name).trim(),
            category: classification.category,
            categoryLabel: catMeta.label,
            address: p.street ? `${p.housenumber || ''} ${p.street}`.trim() : `${loc.district}, ${loc.city}`,
            district: loc.district,
            city: loc.city,
            latitude: lat,
            longitude: lon,
            distanceMeters: dist,
          });
        }
      }
    } catch {
      // Non-blocking photon fallback
    }

    // TIER 2: Comprehensive Overpass OSM Query if Photon yielded few results
    if (osmPlaces.length < 10) {
      const overpassQuery = `[out:json][timeout:7];(
        node["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten"](around:${effectiveRadius},${latitude},${longitude});
        way["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten"](around:${effectiveRadius},${latitude},${longitude});
        node["shop"~"bakery|confectionery|coffee|tea|deli"](around:${effectiveRadius},${latitude},${longitude});
      );out center body ${limit};`;

      const mirrors = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ];

      for (const mirror of mirrors) {
        try {
          const res = await fetch(mirror, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(overpassQuery)}`,
            signal: AbortSignal.timeout(4500),
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.elements) && data.elements.length > 0) {
              for (const el of data.elements) {
                const name = el.tags?.name || el.tags?.['name:vi'] || el.tags?.['name:en'];
                if (!name || String(name).trim().length === 0) continue;

                const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
                const lon = typeof el.lon === 'number' ? el.lon : el.center?.lon;
                if (typeof lat !== 'number' || typeof lon !== 'number') continue;

                const dist = getDistance({ latitude, longitude }, { latitude: lat, longitude: lon });
                if (dist > effectiveRadius) continue;

                const amenity = el.tags?.amenity || 'restaurant';
                const cuisine = el.tags?.cuisine || '';
                const shop = el.tags?.shop || '';
                const classification = classifyVenue({
                  name,
                  category: cuisine || amenity || shop,
                  categories: [amenity, cuisine, shop].filter(Boolean),
                });
                const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;
                const loc = inferVietnamLocation(
                  lat,
                  lon,
                  el.tags?.['addr:district'] || el.tags?.['addr:subdistrict'],
                  el.tags?.['addr:city'] || el.tags?.['addr:province']
                );

                osmPlaces.push({
                  id: `osm_${el.id}`,
                  providerId: String(el.id),
                  name: String(name).trim(),
                  category: classification.category,
                  categoryLabel: catMeta.label,
                  address: el.tags?.['addr:street']
                    ? `${el.tags?.['addr:housenumber'] || ''} ${el.tags?.['addr:street']}`.trim()
                    : el.tags?.['addr:full'] || `${loc.district}, ${loc.city}`,
                  district: loc.district,
                  city: loc.city,
                  latitude: lat,
                  longitude: lon,
                  distanceMeters: dist,
                });
              }

              if (osmPlaces.length > 0) {
                break;
              }
            }
          }
        } catch {
          // Try next mirror
        }
      }
    }

    // TIER 3: Merge with Local Curated Directory Places strictly located within this radius
    const localPlaces = this.getLocalNearbyPlaces(latitude, longitude, effectiveRadius, limit);
    const combined = [...localPlaces, ...osmPlaces];

    // Deduplicate by normalized name and spatial proximity (< 30m)
    const finalMap = new Map<string, UnifiedPlace>();
    for (const p of combined) {
      const key = `${p.name.toLowerCase().trim()}_${p.category}`;
      if (!finalMap.has(key)) {
        finalMap.set(key, p);
      }
    }

    const uniqueResults = Array.from(finalMap.values())
      .filter((p) => (p.distanceMeters ?? Infinity) <= effectiveRadius)
      .sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    return uniqueResults.slice(0, limit);
  }

  private getLocalNearbyPlaces(latitude: number, longitude: number, radiusMeters: number, limit: number): UnifiedPlace[] {
    const placesWithDist: UnifiedPlace[] = [];

    for (const p of INITIAL_PLACES) {
      const dist = getDistance(
        { latitude, longitude },
        { latitude: p.latitude, longitude: p.longitude }
      );

      // Strict radius check: only include if within requested radius
      if (dist <= radiusMeters) {
        const classification = classifyVenue({
          name: p.name,
          category: p.category,
          categoryLabel: p.categoryLabel,
        });
        const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;

        placesWithDist.push({
          id: p.id,
          canonicalVenueId: `vn_comm_${p.id}`,
          name: p.name,
          category: classification.category,
          categoryLabel: catMeta.label,
          address: p.address,
          district: p.district,
          city: (p as any).city || 'Hà Nội',
          latitude: p.latitude,
          longitude: p.longitude,
          distanceMeters: dist,
          isCommunitySpot: p.isCommunitySpot,
          communityStatus: p.communityStatus,
          communityVerified: p.communityVerified,
          firstDiscovererName: p.firstDiscovererName,
        });
      }
    }

    return placesWithDist.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0)).slice(0, limit);
  }
}
