export interface VenueSourceRef {
  provider: 'geoapify' | 'bitequest_community' | 'manual' | string;
  providerPlaceId: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CanonicalVenue {
  canonicalVenueId: string;
  name: string;
  normalizedName: string;
  latitude: number;
  longitude: number;
  geohash?: string;
  gridCell?: string;
  address?: string;
  district?: string;
  city?: string;
  category: string;
  categoryLabel?: string;
  categories?: string[];
  sourceRefs: VenueSourceRef[];
  primarySource: string;
  isCommunitySpot: boolean;
  communityStatus?: 'pending' | 'verified';
  communityVerified?: boolean;
  firstDiscovererId?: string;
  firstDiscovererName?: string;
  verifiedBiteCount: number;
  lastVerifiedBiteAt?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string;
}

export type ProvenanceSource =
  | 'GEOAPIFY'
  | 'BITEQUEST_COMMUNITY'
  | 'REGISTRY_CACHE'
  | 'DEMO_FIXTURE'
  | 'UNAVAILABLE';

export interface DiscoveryAnchor {
  latitude: number;
  longitude: number;
  isRealUserLocation: boolean;
}

export interface DiscoveryProvenance {
  source: ProvenanceSource;
  provider: string;
  isDemoMode: boolean;
  externalApi: boolean;
  registryCount: number;
  providerFetchedCount: number;
  communityCount: number;
  finalVenueCount: number;
  cacheHits: number;
  cacheMisses: number;
  discoveryAnchor: {
    latitude: number;
    longitude: number;
    isRealUserLocation: boolean;
    distanceToQueryMeters?: number;
    maxDiscoveryRadiusMeters: number;
  };
  warning?: string;
}

export interface VenueQueryOptions {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
  category?: string;
  minVerifiedBites?: number;
  discoveryAnchor?: DiscoveryAnchor;
  forceRefresh?: boolean;
}

export interface VenueDiscoveryResult {
  venues: CanonicalVenue[];
  provenance: DiscoveryProvenance;
}
