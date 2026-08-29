import { UnifiedPlace } from './types';
import { TRI_REGION_VENUES } from '../../data/triRegionVenues';

/**
 * 48-Hour Spatial & Master Venue Cache Engine (BiteQuest Production Grade)
 * 
 * Provides:
 * 1. Synchronous Instant (0ms) master cache retrieval on App boot from localStorage.
 * 2. 48-Hour Timestamp Verification:
 *    - If Cache Age < 48 hours: Pure offline memory loading, 0 API calls required.
 *    - If Cache Age >= 48 hours (or first launch): Instantly serves existing cache without UI delay,
 *      while launching a silent background delta revalidation to sync new/removed venues.
 * 3. Spatial Grid Cell Partitioning (~1.1km grid boxes) for precise localized updates.
 */

export const CACHE_TTL_48H_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const MASTER_CACHE_KEY = 'bq_venues_master_cache_v1';
const SPATIAL_GRID_STEP = 0.01; // ~1.1km per grid cell
const STORAGE_PREFIX = 'bq_spatial_grid_v2_';

export interface MasterCachePayload {
  version: number;
  timestamp: number;
  placesCount: number;
  places: UnifiedPlace[];
}

export interface GridCellData {
  cellKey: string;
  lastSyncedAt: number;
  places: UnifiedPlace[];
  count: number;
}

export interface CacheSnapshot {
  places: UnifiedPlace[];
  isFresh: boolean;
  timestamp: number;
  ageHours: number;
  totalCachedInStorage: number;
}

/**
 * Haversine formula for fast, accurate geographic distance calculation in meters
 */
export function computeDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class SpatialVenueCacheManager {
  private memoryCache: Map<string, GridCellData> = new Map();
  private isStorageAvailable: boolean = false;
  private masterTimestamp: number = 0;

  constructor() {
    this.isStorageAvailable = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    this.hydrateFromStorage();
    this.seedTriRegionVenues();
  }

  /**
   * Synchronous Frame-0 snapshot getter for immediate UI rendering without waiting.
   * If centerCoords is provided, filters displayed venues within maxRadiusMeters (default: 50km).
   * All other venues remain safely preserved in localStorage cache for instant access when panned/requested.
   */
  public getPersistedVenuesSnapshot(
    centerCoords?: { latitude: number; longitude: number } | null,
    maxRadiusMeters: number = 50000
  ): CacheSnapshot {
    const now = Date.now();
    let rawPlaces: UnifiedPlace[] = [];
    let isFresh = false;
    let timestamp = 0;

    // 1. Try reading Master Cache from localStorage
    if (this.isStorageAvailable) {
      try {
        const raw = localStorage.getItem(MASTER_CACHE_KEY);
        if (raw) {
          const parsed: MasterCachePayload = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.places) && parsed.places.length > 0) {
            const ageMs = now - (parsed.timestamp || 0);
            isFresh = ageMs < CACHE_TTL_48H_MS;
            this.masterTimestamp = parsed.timestamp;
            timestamp = parsed.timestamp;
            rawPlaces = parsed.places;
          }
        }
      } catch (err) {
        console.warn('[SpatialVenueCache] Failed reading master snapshot:', err);
      }
    }

    // 2. Fallback to in-memory seeded snapshot if localStorage had no places
    if (rawPlaces.length === 0) {
      rawPlaces = this.getAllCachedPlaces();
      isFresh = this.masterTimestamp > 0 && (now - this.masterTimestamp < CACHE_TTL_48H_MS);
      timestamp = this.masterTimestamp || now;
    }

    const totalCachedInStorage = rawPlaces.length;

    // 3. Apply 50km Radius Filter from user center if provided
    let filteredPlaces = rawPlaces;
    if (centerCoords && typeof centerCoords.latitude === 'number' && typeof centerCoords.longitude === 'number') {
      const radiusMatches = rawPlaces.filter((p) => {
        if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return false;
        const dist = computeDistanceMeters(centerCoords.latitude, centerCoords.longitude, p.latitude, p.longitude);
        return dist <= maxRadiusMeters;
      });
      // If we found venues within 50km, restrict display to that 50km perimeter
      if (radiusMatches.length > 0) {
        filteredPlaces = radiusMatches;
      }
    }

    const ageMs = now - (timestamp || now);

    return {
      places: filteredPlaces,
      isFresh,
      timestamp,
      ageHours: Math.round((ageMs / (3600 * 1000)) * 10) / 10,
      totalCachedInStorage,
    };
  }

  /**
   * Retrieves cached venues for a specific remote area from localStorage cache (0ms wait)
   */
  public getCachedPlacesForArea(
    centerCoords: { latitude: number; longitude: number },
    radiusMeters: number = 30000
  ): UnifiedPlace[] {
    const all = this.getAllCachedPlaces();
    return all.filter((p) => {
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return false;
      const dist = computeDistanceMeters(centerCoords.latitude, centerCoords.longitude, p.latitude, p.longitude);
      return dist <= radiusMeters;
    });
  }

  /**
   * Persists master cache snapshot to localStorage with current 48h timestamp
   */
  public saveMasterCache(places: UnifiedPlace[]): void {
    if (!this.isStorageAvailable || !Array.isArray(places) || places.length === 0) return;
    try {
      const now = Date.now();
      this.masterTimestamp = now;

      // Group and dedup places
      const map = new Map<string, UnifiedPlace>();
      for (const p of places) {
        if (p.id) map.set(p.id, p);
      }
      const uniquePlaces = Array.from(map.values());

      const payload: MasterCachePayload = {
        version: 1,
        timestamp: now,
        placesCount: uniquePlaces.length,
        places: uniquePlaces,
      };

      localStorage.setItem(MASTER_CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[SpatialVenueCache] Master cache storage exceeded, pruning:', err);
      this.pruneOldStorage();
    }
  }

  /**
   * Pre-seeds nationwide 3-region venues into memory so that 100% of pins are available on frame 0
   */
  private seedTriRegionVenues(): void {
    const now = Date.now();
    for (const place of TRI_REGION_VENUES) {
      if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') continue;
      const cellKey = this.getCellKey(place.latitude, place.longitude);
      const existing = this.memoryCache.get(cellKey);
      const placeMap = new Map<string, UnifiedPlace>();
      if (existing?.places) {
        for (const p of existing.places) placeMap.set(p.id, p);
      }
      placeMap.set(place.id, place);
      const merged = Array.from(placeMap.values());
      this.memoryCache.set(cellKey, {
        cellKey,
        lastSyncedAt: existing ? existing.lastSyncedAt : now,
        places: merged,
        count: merged.length,
      });
    }

    // Save initial master cache if not present
    if (this.isStorageAvailable && !localStorage.getItem(MASTER_CACHE_KEY)) {
      this.saveMasterCache(TRI_REGION_VENUES);
    }
  }

  /**
   * Returns all cached venues across all grid cells for instant 0ms full-map rendering
   */
  public getAllCachedPlaces(): UnifiedPlace[] {
    const allMap = new Map<string, UnifiedPlace>();
    for (const cell of this.memoryCache.values()) {
      if (Array.isArray(cell.places)) {
        for (const p of cell.places) {
          allMap.set(p.id, p);
        }
      }
    }
    return Array.from(allMap.values());
  }

  /**
   * Converts lat/lng coordinates to a deterministic spatial grid cell key
   */
  public getCellKey(latitude: number, longitude: number): string {
    const latIndex = Math.floor(latitude / SPATIAL_GRID_STEP);
    const lngIndex = Math.floor(longitude / SPATIAL_GRID_STEP);
    return `grid_${latIndex}_${lngIndex}`;
  }

  /**
   * Gets all spatial grid cell keys that cover a circle with center (lat, lng) and radius in meters
   */
  public getCoveringCellKeys(latitude: number, longitude: number, radiusMeters: number): string[] {
    const degOffset = (radiusMeters / 111320) + 0.005; // degree offset with buffer
    const minLat = latitude - degOffset;
    const maxLat = latitude + degOffset;
    const minLng = longitude - degOffset;
    const maxLng = longitude + degOffset;

    const cellKeys = new Set<string>();
    for (let lat = minLat; lat <= maxLat; lat += SPATIAL_GRID_STEP) {
      for (let lng = minLng; lng <= maxLng; lng += SPATIAL_GRID_STEP) {
        cellKeys.add(this.getCellKey(lat, lng));
      }
    }
    return Array.from(cellKeys);
  }

  /**
   * Checks if an area needs background reload (if any covering cell is older than 48 hours or unvisited)
   */
  public isAreaExpiredOrUncached(latitude: number, longitude: number, radiusMeters: number): {
    needsSync: boolean;
    expiredCells: string[];
    freshCells: string[];
    cachedPlaces: UnifiedPlace[];
  } {
    const now = Date.now();
    const coveringCells = this.getCoveringCellKeys(latitude, longitude, radiusMeters);
    const expiredCells: string[] = [];
    const freshCells: string[] = [];
    const cachedPlacesMap = new Map<string, UnifiedPlace>();

    for (const cellKey of coveringCells) {
      const cellData = this.memoryCache.get(cellKey);
      if (!cellData || (now - cellData.lastSyncedAt >= CACHE_TTL_48H_MS)) {
        expiredCells.push(cellKey);
      } else {
        freshCells.push(cellKey);
      }

      if (cellData && Array.isArray(cellData.places)) {
        for (const p of cellData.places) {
          cachedPlacesMap.set(p.id, p);
        }
      }
    }

    return {
      needsSync: expiredCells.length > 0,
      expiredCells,
      freshCells,
      cachedPlaces: Array.from(cachedPlacesMap.values()),
    };
  }

  /**
   * Saves discovered venues into spatial grid partitions and persists with 48h TTL
   */
  public savePlacesToGrid(places: UnifiedPlace[], centerLat: number, centerLng: number, radiusMeters: number): void {
    if (!Array.isArray(places) || places.length === 0) return;
    const now = Date.now();

    // Group places by their exact spatial grid cell
    const cellGroups = new Map<string, UnifiedPlace[]>();
    for (const place of places) {
      if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') continue;
      const cellKey = this.getCellKey(place.latitude, place.longitude);
      const list = cellGroups.get(cellKey) || [];
      list.push(place);
      cellGroups.set(cellKey, list);
    }

    // Also mark covering cells that were scanned as fresh even if they have 0 new places
    const coveringCells = this.getCoveringCellKeys(centerLat, centerLng, radiusMeters);
    for (const cellKey of coveringCells) {
      if (!cellGroups.has(cellKey)) {
        cellGroups.set(cellKey, []);
      }
    }

    // Upsert into memory & persistent storage
    for (const [cellKey, newPlaces] of cellGroups.entries()) {
      const existing = this.memoryCache.get(cellKey);
      const placeMap = new Map<string, UnifiedPlace>();
      
      // Preserve existing valid places if any
      if (existing?.places) {
        for (const p of existing.places) placeMap.set(p.id, p);
      }
      for (const p of newPlaces) placeMap.set(p.id, p);

      const merged = Array.from(placeMap.values());
      const cellData: GridCellData = {
        cellKey,
        lastSyncedAt: now,
        places: merged,
        count: merged.length,
      };

      this.memoryCache.set(cellKey, cellData);
      this.persistCellToStorage(cellData);
    }

    // Update master snapshot with all aggregated places
    this.saveMasterCache(this.getAllCachedPlaces());
  }

  /**
   * Cleans up expired cells older than 7 days from persistent storage to save space
   */
  public pruneOldStorage(): void {
    if (!this.isStorageAvailable) return;
    try {
      const now = Date.now();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      for (const [cellKey, data] of this.memoryCache.entries()) {
        if (now - data.lastSyncedAt > maxAgeMs) {
          this.memoryCache.delete(cellKey);
          localStorage.removeItem(`${STORAGE_PREFIX}${cellKey}`);
        }
      }
    } catch {
      // Safe fallback
    }
  }

  private persistCellToStorage(cellData: GridCellData): void {
    if (!this.isStorageAvailable) return;
    try {
      // Compact JSON representation for storage efficiency
      const compact = {
        k: cellData.cellKey,
        t: cellData.lastSyncedAt,
        p: cellData.places.map((p) => ({
          id: p.id,
          name: p.name,
          cat: p.category,
          lbl: p.categoryLabel,
          lat: p.latitude,
          lng: p.longitude,
          adr: p.address,
          dist: p.district,
          city: p.city,
          hot: (p as any).isHot,
          rat: p.rating,
          rc: p.reviewCount,
          comm: p.isCommunitySpot,
          deal: p.activeDeal,
        })),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${cellData.cellKey}`, JSON.stringify(compact));
    } catch {
      // If quota exceeded, perform light pruning
      this.pruneOldStorage();
    }
  }

  private hydrateFromStorage(): void {
    if (!this.isStorageAvailable) return;
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed && parsed.k && parsed.t && Array.isArray(parsed.p)) {
            const places: UnifiedPlace[] = parsed.p.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.cat || 'street_food',
              categoryLabel: p.lbl || 'Ẩm thực',
              latitude: p.lat,
              longitude: p.lng,
              address: p.adr || '',
              district: p.dist || '',
              city: p.city || 'Hà Nội',
              isHot: p.hot,
              rating: p.rat,
              reviewCount: p.rc,
              isCommunitySpot: p.comm,
              activeDeal: p.deal,
            }));

            this.memoryCache.set(parsed.k, {
              cellKey: parsed.k,
              lastSyncedAt: parsed.t,
              places,
              count: places.length,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[SpatialVenueCache] Hydration notice:', err);
    }
  }
}

export const spatialVenueCache = new SpatialVenueCacheManager();
