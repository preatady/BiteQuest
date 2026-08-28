import { useState, useCallback, useRef } from 'react';
import { UnifiedPlace } from '../services/maps/types';
import { DiscoveryAnchor, DiscoveryProvenance } from '../services/maps/venueRegistryTypes';

export interface UseExploreNearbyPlacesResult {
  nearbyPOIs: UnifiedPlace[];
  isLoadingPOIs: boolean;
  poiError: string | null;
  provenance: DiscoveryProvenance | null;
  discoveryAnchor: DiscoveryAnchor | null;
  isBeyondBoundary: boolean;
  lastFetchedCenter: { latitude: number; longitude: number } | null;
  fetchNearbyPOIs: (
    center: { latitude: number; longitude: number },
    radius?: number,
    options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean }
  ) => Promise<UnifiedPlace[] | null>;
  addDiscoveredPOIs: (newPlaces: UnifiedPlace[]) => void;
}

export function useExploreNearbyPlaces(): UseExploreNearbyPlacesResult {
  const [nearbyPOIs, setNearbyPOIs] = useState<UnifiedPlace[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState<boolean>(false);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<DiscoveryProvenance | null>(null);
  const [discoveryAnchor, setDiscoveryAnchor] = useState<DiscoveryAnchor | null>(null);
  const [isBeyondBoundary, setIsBeyondBoundary] = useState<boolean>(false);
  const [lastFetchedCenter, setLastFetchedCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const nearbyPOIsRef = useRef<UnifiedPlace[]>([]);
  nearbyPOIsRef.current = nearbyPOIs;

  const fetchNearbyPOIs = useCallback(
    async (
      center: { latitude: number; longitude: number },
      radius: number = 3000,
      options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean }
    ): Promise<UnifiedPlace[] | null> => {
      if (!center || typeof center.latitude !== 'number' || typeof center.longitude !== 'number') {
        return [];
      }

      // Abort previous in-flight query so map pans never get blocked
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
        let url = `/api/nearby-places?lat=${center.latitude}&lng=${center.longitude}&radius=${radius}&limit=120`;

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

        setNearbyPOIs((prev) => {
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
          // Ignored because a newer move query superseded this one
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

  const addDiscoveredPOIs = useCallback((newPlaces: UnifiedPlace[]) => {
    if (!Array.isArray(newPlaces) || newPlaces.length === 0) return;
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
    fetchNearbyPOIs,
    addDiscoveredPOIs,
  };
}
