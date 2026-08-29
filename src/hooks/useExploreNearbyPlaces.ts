import { useState, useCallback, useRef, useEffect } from 'react';
import { UnifiedPlace } from '../services/maps/types';
import { DiscoveryAnchor, DiscoveryProvenance } from '../services/maps/venueRegistryTypes';
import { spatialVenueCache, CACHE_TTL_48H_MS } from '../services/maps/spatialVenueCache';

export interface UseExploreNearbyPlacesResult {
  nearbyPOIs: UnifiedPlace[];
  isLoadingPOIs: boolean;
  poiError: string | null;
  provenance: DiscoveryProvenance | null;
  discoveryAnchor: DiscoveryAnchor | null;
  isBeyondBoundary: boolean;
  lastFetchedCenter: { latitude: number; longitude: number } | null;
  rippleStage: number; // 0: Idle, 1: Immediate (3km), 2: District (8km), 3: City (20km), 4: Max 50km Perimeter
  fetchNearbyPOIs: (
    center: { latitude: number; longitude: number },
    radius?: number,
    options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean; reset?: boolean }
  ) => Promise<UnifiedPlace[] | null>;
  triggerRippleExpansion: (
    center: { latitude: number; longitude: number },
    options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean }
  ) => void;
  loadPlacesForViewportArea: (
    center: { latitude: number; longitude: number },
    radius?: number
  ) => Promise<number>;
  filterPlacesTo50kmRadius: (userCenter: { latitude: number; longitude: number }) => void;
  addDiscoveredPOIs: (newPlaces: UnifiedPlace[]) => void;
}

export function useExploreNearbyPlaces(): UseExploreNearbyPlacesResult {
  // Frame-0 Immediate Synchronous Snapshot from localStorage (0ms wait)
  const initialSnapshot = spatialVenueCache.getPersistedVenuesSnapshot(null, 50000);
  const [nearbyPOIs, setNearbyPOIs] = useState<UnifiedPlace[]>(() => initialSnapshot.places);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState<boolean>(false);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<DiscoveryProvenance | null>(null);
  const [discoveryAnchor, setDiscoveryAnchor] = useState<DiscoveryAnchor | null>(null);
  const [isBeyondBoundary, setIsBeyondBoundary] = useState<boolean>(false);
  const [lastFetchedCenter, setLastFetchedCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [rippleStage, setRippleStage] = useState<number>(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const nearbyPOIsRef = useRef<UnifiedPlace[]>(nearbyPOIs);
  nearbyPOIsRef.current = nearbyPOIs;

  const rippleTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Clear pending ripple timers
  const clearRippleTimers = useCallback(() => {
    rippleTimeoutsRef.current.forEach((t) => clearTimeout(t));
    rippleTimeoutsRef.current = [];
  }, []);

  /**
   * Filter active in-memory places strictly to 50km radius from current user GPS
   */
  const filterPlacesTo50kmRadius = useCallback((userCenter: { latitude: number; longitude: number }) => {
    if (!userCenter || typeof userCenter.latitude !== 'number' || typeof userCenter.longitude !== 'number') return;
    const snapshot = spatialVenueCache.getPersistedVenuesSnapshot(userCenter, 50000);
    setNearbyPOIs(snapshot.places);
    nearbyPOIsRef.current = snapshot.places;
  }, []);

  /**
   * Load venues for a user-requested remote viewport area (e.g. user panned to another city/district and pressed "Tải quán tại đây")
   */
  const loadPlacesForViewportArea = useCallback(
    async (
      center: { latitude: number; longitude: number },
      radius: number = 30000
    ): Promise<number> => {
      if (!center || typeof center.latitude !== 'number' || typeof center.longitude !== 'number') return 0;
      
      // 1. Instant 0ms cached retrieval from master storage
      const cached = spatialVenueCache.getCachedPlacesForArea(center, radius);
      if (cached.length > 0) {
        setNearbyPOIs((prev) => {
          const map = new Map<string, UnifiedPlace>();
          prev.forEach((p) => map.set(p.id, p));
          cached.forEach((p) => map.set(p.id, p));
          const merged = Array.from(map.values());
          nearbyPOIsRef.current = merged;
          return merged;
        });
      }

      // 2. Fetch fresh network POIs for this region
      try {
        const url = `/api/nearby-places?lat=${center.latitude}&lng=${center.longitude}&radius=${radius}&limit=350`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const remotePlaces: UnifiedPlace[] = Array.isArray(data.places) ? data.places : [];
          if (remotePlaces.length > 0) {
            spatialVenueCache.savePlacesToGrid(remotePlaces, center.latitude, center.longitude, radius);
            setNearbyPOIs((prev) => {
              const map = new Map<string, UnifiedPlace>();
              prev.forEach((p) => map.set(p.id, p));
              remotePlaces.forEach((p) => map.set(p.id, p));
              const merged = Array.from(map.values());
              nearbyPOIsRef.current = merged;
              return merged;
            });
            return remotePlaces.length;
          }
        }
      } catch (err) {
        console.warn('[useExploreNearbyPlaces] loadPlacesForViewportArea error:', err);
      }
      return cached.length;
    },
    []
  );

  // Background 48-Hour Periodic Sync & Tri-Region Revalidator
  // If cache is fresh (< 48h), this skips network execution completely.
  // If cache is expired (>= 48h), it silently updates in background without UI blocking.
  useEffect(() => {
    const snapshot = spatialVenueCache.getPersistedVenuesSnapshot();
    if (snapshot.isFresh && snapshot.places.length > 20) {
      console.log(`[BiteQuest Cache] Master snapshot is fresh (${snapshot.ageHours}h old < 48h). 0 API calls required.`);
      return;
    }

    console.log(`[BiteQuest Cache] Master snapshot expired (${snapshot.ageHours}h >= 48h) or missing. Triggering silent background revalidation...`);
    const keyRegionalHubs = [
      { name: 'Hà Nội (Bắc)', lat: 21.0285, lng: 105.8542, radius: 8000 },
      { name: 'Đà Nẵng (Trung)', lat: 16.0680, lng: 108.2200, radius: 8000 },
      { name: 'TP. Hồ Chí Minh (Nam)', lat: 10.7765, lng: 106.6950, radius: 8000 },
    ];

    const syncTriRegions = async () => {
      for (const hub of keyRegionalHubs) {
        const check = spatialVenueCache.isAreaExpiredOrUncached(hub.lat, hub.lng, hub.radius);
        if (check.needsSync) {
          try {
            const url = `/api/nearby-places?lat=${hub.lat}&lng=${hub.lng}&radius=${hub.radius}&limit=350`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              const places: UnifiedPlace[] = Array.isArray(data.places) ? data.places : [];
              if (places.length > 0) {
                spatialVenueCache.savePlacesToGrid(places, hub.lat, hub.lng, hub.radius);
                setNearbyPOIs((prev) => {
                  const map = new Map<string, UnifiedPlace>();
                  prev.forEach((p) => map.set(p.id, p));
                  places.forEach((p) => map.set(p.id, p));
                  const merged = Array.from(map.values());
                  nearbyPOIsRef.current = merged;
                  return merged;
                });
              }
            }
          } catch (e) {
            // Background sync is silent & safe
          }
        }
      }
    };

    // Staggered non-blocking trigger
    const timer = setTimeout(() => {
      syncTriRegions();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const fetchNearbyPOIs = useCallback(
    async (
      center: { latitude: number; longitude: number },
      radius: number = 25000,
      options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean; reset?: boolean }
    ): Promise<UnifiedPlace[] | null> => {
      if (!center || typeof center.latitude !== 'number' || typeof center.longitude !== 'number') {
        return [];
      }

      // 1. FAST PATH (0ms Instant Stale Cache Response for entire 50km perimeter)
      const snapshot = spatialVenueCache.getPersistedVenuesSnapshot(center, Math.max(radius, 50000));
      if (snapshot.places.length > 0) {
        setNearbyPOIs((prev) => {
          if (options?.reset) {
            nearbyPOIsRef.current = snapshot.places;
            return snapshot.places;
          }
          const map = new Map<string, UnifiedPlace>();
          prev.forEach((p) => map.set(p.id, p));
          snapshot.places.forEach((p) => map.set(p.id, p));
          const merged = Array.from(map.values());
          nearbyPOIsRef.current = merged;
          return merged;
        });
      }

      // If area is fresh (< 48h) and not forced, we can skip network overhead entirely!
      const cacheCheck = spatialVenueCache.isAreaExpiredOrUncached(center.latitude, center.longitude, radius);
      if (!cacheCheck.needsSync && !options?.forceRefresh && snapshot.places.length > 15) {
        setLastFetchedCenter(center);
        return snapshot.places;
      }

      // 2. BACKGROUND 48H REVALIDATION & EXPANSION FETCH
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoadingPOIs(true);
      setPoiError(null);
      setIsBeyondBoundary(false);

      try {
        const anchor = options?.anchor || discoveryAnchor;
        let url = `/api/nearby-places?lat=${center.latitude}&lng=${center.longitude}&radius=${Math.max(radius, 25000)}&limit=350`;

        if (anchor) {
          url += `&anchorLat=${anchor.latitude}&anchorLng=${anchor.longitude}&isRealLocation=${anchor.isRealUserLocation}`;
        }
        if (options?.forceRefresh) {
          url += `&forceRefresh=true`;
        }

        const res = await fetch(url, { signal: abortController.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching nearby places`);
        }

        const data = await res.json();
        const rawPlaces: UnifiedPlace[] = Array.isArray(data.places) ? data.places : [];

        if (data.provenance) {
          setProvenance(data.provenance);
          if (data.provenance.discoveryAnchor) {
            setDiscoveryAnchor({
              latitude: data.provenance.discoveryAnchor.latitude,
              longitude: data.provenance.discoveryAnchor.longitude,
              isRealUserLocation: data.provenance.discoveryAnchor.isRealUserLocation,
            });
          }
          setIsBeyondBoundary(false);
        }

        // Save fresh places into 48-Hour spatial storage
        if (rawPlaces.length > 0) {
          spatialVenueCache.savePlacesToGrid(rawPlaces, center.latitude, center.longitude, radius);
        }

        setNearbyPOIs((prev) => {
          if (options?.reset) {
            nearbyPOIsRef.current = rawPlaces;
            return rawPlaces;
          }
          const map = new Map<string, UnifiedPlace>();
          prev.forEach((p) => map.set(p.id, p));
          rawPlaces.forEach((p) => map.set(p.id, p));
          const merged = Array.from(map.values());
          nearbyPOIsRef.current = merged;
          return merged;
        });
        setLastFetchedCenter(center);
        return rawPlaces;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return nearbyPOIsRef.current;
        }
        console.warn('[useExploreNearbyPlaces] Error fetching POIs:', err?.message || err);
        setPoiError(err?.message || 'Không thể tải danh sách địa điểm lân cận');
        return null;
      } finally {
        if (abortControllerRef.current === abortController) {
          setIsLoadingPOIs(false);
          abortControllerRef.current = null;
        }
      }
    },
    [discoveryAnchor]
  );

  /**
   * Automatic Full Radius Expansion (0ms Immediate Render + Broad 50km Coverage):
   * Instantly surfaces all nearby spots in user's surrounding 50km area and performs
   * single background sync without stuttering or aborting requests.
   */
  const triggerRippleExpansion = useCallback(
    (
      center: { latitude: number; longitude: number },
      options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean }
    ) => {
      if (!center || typeof center.latitude !== 'number' || typeof center.longitude !== 'number') return;
      clearRippleTimers();

      // Immediate Stage 1 (0ms synchronous cache hydration up to 50km)
      setRippleStage(1);
      const snapshot = spatialVenueCache.getPersistedVenuesSnapshot(center, 50000);
      if (snapshot.places.length > 0) {
        setNearbyPOIs((prev) => {
          const map = new Map<string, UnifiedPlace>();
          prev.forEach((p) => map.set(p.id, p));
          snapshot.places.forEach((p) => map.set(p.id, p));
          const merged = Array.from(map.values());
          nearbyPOIsRef.current = merged;
          return merged;
        });
      }

      // Fast network query for the 25km-50km active zone
      fetchNearbyPOIs(center, 30000, {
        anchor: options?.anchor,
        forceRefresh: options?.forceRefresh,
      });

      // Advance ripple indicator
      const timer = setTimeout(() => {
        setRippleStage(4);
      }, 1000);

      rippleTimeoutsRef.current = [timer];
    },
    [clearRippleTimers, fetchNearbyPOIs]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRippleTimers();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearRippleTimers]);

  const addDiscoveredPOIs = useCallback((newPlaces: UnifiedPlace[]) => {
    if (!Array.isArray(newPlaces) || newPlaces.length === 0) return;
    
    // Also store newly scanned places into persistent spatial cache
    const first = newPlaces[0];
    if (first && typeof first.latitude === 'number' && typeof first.longitude === 'number') {
      spatialVenueCache.savePlacesToGrid(newPlaces, first.latitude, first.longitude, 2000);
    }

    setNearbyPOIs((prev) => {
      const map = new Map<string, UnifiedPlace>();
      prev.forEach((p) => map.set(p.id, p));
      let changed = false;
      newPlaces.forEach((p) => {
        if (!map.has(p.id)) {
          map.set(p.id, p);
          changed = true;
        }
      });
      if (!changed) return prev;
      const merged = Array.from(map.values());
      nearbyPOIsRef.current = merged;
      return merged;
    });
  }, []);

  return {
    nearbyPOIs,
    isLoadingPOIs,
    poiError,
    provenance,
    discoveryAnchor,
    isBeyondBoundary,
    lastFetchedCenter,
    rippleStage,
    fetchNearbyPOIs,
    triggerRippleExpansion,
    loadPlacesForViewportArea,
    filterPlacesTo50kmRadius,
    addDiscoveredPOIs,
  };
}
