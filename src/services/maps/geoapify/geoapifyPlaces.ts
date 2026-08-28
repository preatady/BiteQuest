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
    const { latitude, longitude, radiusMeters = 2000, limit = 100 } = options;
    const isDemoMode = process.env.BITEQUEST_DEMO_MODE === 'true';
    const effectiveKey = this.getEffectiveApiKey();

    if (!effectiveKey) {
      if (isDemoMode) {
        return this.getLocalNearbyPlaces(latitude, longitude, radiusMeters, limit);
      }
      throw new Error('GEOAPIFY_SERVER_KEY_UNCONFIGURED: External Places provider requires a valid API key.');
    }

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
        if (isDemoMode) {
          return this.getLocalNearbyPlaces(latitude, longitude, radiusMeters, limit);
        }
        throw new Error(`GEOAPIFY_REQUEST_FAILED: HTTP status ${res.status} (${res.statusText})`);
      }

      const json = await res.json();
      
      // Resilient per-feature validation: Extract raw features array
      const rawFeatures: any[] = Array.isArray(json?.features) ? json.features : [];
      if (rawFeatures.length === 0) {
        return isDemoMode ? this.getLocalNearbyPlaces(latitude, longitude, radiusMeters, limit) : [];
      }

      const validFeatures: any[] = [];
      for (const f of rawFeatures) {
        // Individual feature validation ensures a single corrupted POI never fails the batch
        const parsedFeature = GeoapifyPlaceFeatureSchema.safeParse(f);
        if (parsedFeature.success && parsedFeature.data?.properties?.lat && parsedFeature.data?.properties?.lon) {
          validFeatures.push(parsedFeature.data);
        } else if (f?.properties && typeof f.properties.lat === 'number' && typeof f.properties.lon === 'number' && f.properties.name) {
          // Direct property fallback
          validFeatures.push(f);
        }
      }

      if (validFeatures.length === 0) {
        return isDemoMode ? this.getLocalNearbyPlaces(latitude, longitude, radiusMeters, limit) : [];
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

          return {
            id: `geoapify_${p.place_id || idx}`,
            providerId: p.place_id ? String(p.place_id) : undefined,
            name: placeName,
            category,
            categoryLabel,
            categories: cats,
            address: p.formatted || `${p.housenumber || ''} ${p.street || ''}, ${p.district || 'Cầu Giấy'}`.trim(),
            district: p.district || 'Cầu Giấy',
            city: p.city || 'Hà Nội',
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
      // Keep cache size bounded
      if (this.cache.length > 20) this.cache.shift();

      return results.slice(0, limit);
    } catch (err) {
      if (isDemoMode) {
        return this.getLocalNearbyPlaces(latitude, longitude, radiusMeters, limit);
      }
      throw err;
    }
  }

  private getLocalNearbyPlaces(latitude: number, longitude: number, radiusMeters: number, limit: number): UnifiedPlace[] {
    return INITIAL_PLACES.map((p) => {
      const dist = getDistance(
        { latitude, longitude },
        { latitude: p.latitude, longitude: p.longitude }
      );
      return {
        ...p,
        distanceMeters: dist,
      };
    })
      .filter((p) => p.distanceMeters <= radiusMeters * 3)
      .sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0))
      .slice(0, limit);
  }
}
