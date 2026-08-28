import { z } from 'zod';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface UnifiedPlace {
  id: string;
  canonicalVenueId?: string;
  providerId?: string;
  provider?: string;
  source?: string;
  name: string;
  category: string;
  categoryLabel: string;
  categories?: string[];
  address: string;
  district: string;
  city?: string;
  latitude: number;
  longitude: number;
  geohash?: string;
  location?: {
    lat: number;
    lng: number;
  };
  distanceMeters?: number;
  priceBand?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  reviewCount?: number;
  verifiedBiteCount?: number;
  lastVerifiedBiteAt?: string;
  imageUrl?: string;
  isOpen?: boolean;
  openingHoursText?: string;
  isCommunitySpot?: boolean;
  communityStatus?: 'pending' | 'verified';
  communityVerified?: boolean;
  firstDiscovererId?: string;
  firstDiscovererName?: string;
}

export interface NearbySearchOptions {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  categories?: string[];
  limit?: number;
  keyword?: string;
}

export interface RouteOptions {
  origin: LatLng;
  destination: LatLng;
  mode?: 'drive' | 'walk' | 'bicycle';
}

export interface RouteResult {
  distanceMeters: number;
  durationMinutes: number;
  formattedDuration: string;
  formattedDistance: string;
  geometry?: any; // GeoJSON LineString coordinates
  hasLiveTraffic: boolean;
  bestTimeToGoNotice?: string;
  isApproximate?: boolean;
  provenance?: 'LIVE_PROVIDER' | 'APPROXIMATE_FALLBACK' | 'UNAVAILABLE';
}

export interface PlaceProvider {
  readonly providerName?: string;
  isConfigured?(): boolean;
  searchNearby(options: NearbySearchOptions): Promise<UnifiedPlace[]>;
}

export interface RouteProvider {
  computeRoute(options: RouteOptions): Promise<RouteResult | null>;
}
