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
}

export function useExploreNearbyPlaces(): UseExploreNearbyPlacesResult {
  const [nearbyPOIs, setNearbyPOIs] = useState<UnifiedPlace[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState<boolean>(false);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<DiscoveryProvenance | null>(null);
  const [discoveryAnchor, setDiscoveryAnchor] = useState<DiscoveryAnchor | null>(null);
  const [isBeyondBoundary, setIsBeyondBoundary] = useState<boolean>(false);
  const [lastFetchedCenter, setLastFetchedCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const nearbyPOIsRef = useRef<UnifiedPlace[]>([]);
  nearbyPOIsRef.current = nearbyPOIs;

  const fetchNearbyPOIs = useCallback(
    async (
      center: { latitude: number; longitude: number },
      radius: number = 2000,
      options?: { anchor?: DiscoveryAnchor; forceRefresh?: boolean }
    ): Promise<UnifiedPlace[] | null> => {
      if (!center || typeof center.latitude !== 'number' || typeof center.longitude !== 'number') {
        return [];
      }

      if (inFlightRef.current) {
        return nearbyPOIsRef.current;
      }

      inFlightRef.current = true;
      setIsLoadingPOIs(true);
      setPoiError(null);
      setIsBeyondBoundary(false);

      try {
        const anchor = options?.anchor || discoveryAnchor;
        let url = `/api/nearby-places?lat=${center.latitude}&lng=${center.longitude}&radius=${radius}&limit=100`;

        if (anchor) {
          url += `&anchorLat=${anchor.latitude}&anchorLng=${anchor.longitude}&isRealLocation=${anchor.isRealUserLocation}`;
        }
        if (options?.forceRefresh) {
          url += `&forceRefresh=true`;
        }

        const res = await fetch(url);
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
          if (data.provenance.warning && data.provenance.warning.includes('DISCOVERY_BOUNDARY_EXCEEDED')) {
            setIsBeyondBoundary(true);
          }
        }

        setNearbyPOIs(rawPlaces);
        nearbyPOIsRef.current = rawPlaces;
        setLastFetchedCenter(center);
        return rawPlaces;
      } catch (err: any) {
        console.warn('[useExploreNearbyPlaces] Error fetching POIs:', err?.message || err);
        setPoiError(err?.message || 'Không thể tải danh sách địa điểm lân cận');
        return null;
      } finally {
        setIsLoadingPOIs(false);
        inFlightRef.current = false;
      }
    },
    [discoveryAnchor]
  );

  return {
    nearbyPOIs,
    isLoadingPOIs,
    poiError,
    provenance,
    discoveryAnchor,
    isBeyondBoundary,
    lastFetchedCenter,
    fetchNearbyPOIs,
  };
}
