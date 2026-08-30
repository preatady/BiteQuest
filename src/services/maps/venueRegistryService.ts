import { getDistance } from 'geolib';
import {
  CanonicalVenue,
  DiscoveryAnchor,
  DiscoveryProvenance,
  ProvenanceSource,
  VenueDiscoveryResult,
  VenueQueryOptions,
  VenueSourceRef,
} from './venueRegistryTypes';
import { PlaceProvider, UnifiedPlace } from './types';
import { GeoapifyPlaceProvider } from './geoapify/geoapifyPlaces';
import { Place, BiteCheckin } from '../../types';
import { INITIAL_PLACES } from '../../data/seedData';
import { TRI_REGION_VENUES } from '../../data/triRegionVenues';
import { classifyVenue, CANONICAL_CATEGORIES } from './categoryNormalizer';

// Constants
export const REGISTRY_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours TTL for venue sync & delta revalidation
export const SPATIAL_GRID_SIZE_DEG = 0.01; // ~1.1km grid cell step
export const DEDUP_DISTANCE_METERS = 25; // 25m spatial proximity threshold for name-matched dedup

export interface FirestoreDbLike {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): any }>;
      set(data: any, options?: { merge: boolean }): Promise<any>;
    };
    get(): Promise<{ docs: Array<{ id: string; data(): any }> }>;
  };
}

export class VenueRegistryService {
  // In-memory canonical venue registry (keyed by canonicalVenueId)
  private memoryVenues: Map<string, CanonicalVenue> = new Map();
  // Spatial index: gridCellKey -> Set of canonicalVenueIds
  private spatialGrid: Map<string, Set<string>> = new Map();
  // Area sync freshness tracker: gridCellKey -> lastSyncedTimestamp
  private syncedGridCells: Map<string, number> = new Map();
  // Reverse lookup: provider:providerPlaceId -> canonicalVenueId
  private providerToCanonicalMap: Map<string, string> = new Map();

  private firestoreDb: FirestoreDbLike | null = null;
  private primaryProvider: PlaceProvider | null = null;

  constructor(
    primaryProvider?: PlaceProvider,
    firestoreDb?: FirestoreDbLike | null,
    options?: { autoHydrateSeed?: boolean }
  ) {
    if (primaryProvider) this.primaryProvider = primaryProvider;
    if (firestoreDb) this.firestoreDb = firestoreDb;

    if (options?.autoHydrateSeed) {
      // Pre-hydrate curated directory places into memory spatial index
      for (const p of INITIAL_PLACES) {
        this.registerPlace(p);
      }

      // Pre-hydrate tri-region venues (Hanoi, Central, South) for 100% instant local discovery
      for (const v of TRI_REGION_VENUES) {
        if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
          this.upsertCandidatePOI(v, v.provider || 'bitequest_tri_region');
        }
      }
    }
  }

  /**
   * Registers any place (curated directory place or community spot) as a canonical venue.
   */
  public registerPlace(place: Place): CanonicalVenue {
    const now = new Date().toISOString();
    const isComm = Boolean(place.isCommunitySpot);
    const canonicalId = isComm ? `vn_comm_${place.id}` : `vn_dir_${place.id}`;
    const normName = this.normalizeName(place.name);
    const gridCell = this.getGridCellKey(place.latitude, place.longitude);

    const sourceRef: VenueSourceRef = {
      provider: isComm ? 'bitequest_community' : 'bitequest_curated',
      providerPlaceId: place.id,
      firstSeenAt: place.createdAt || now,
      lastSeenAt: now,
    };

    const existing = this.memoryVenues.get(canonicalId);
    if (existing) {
      existing.name = place.name;
      existing.normalizedName = normName;
      existing.latitude = place.latitude;
      existing.longitude = place.longitude;
      existing.address = place.address || existing.address;
      existing.district = place.district || existing.district;
      existing.category = place.category;
      existing.categoryLabel = place.categoryLabel || existing.categoryLabel;
      existing.communityStatus = place.communityStatus || existing.communityStatus;
      existing.communityVerified = place.communityVerified || existing.communityVerified;
      existing.updatedAt = now;
      this.indexVenueInMemory(existing);
      return existing;
    }

    const venue: CanonicalVenue = {
      canonicalVenueId: canonicalId,
      name: place.name,
      normalizedName: normName,
      latitude: place.latitude,
      longitude: place.longitude,
      gridCell,
      address: place.address || 'Hà Nội',
      district: place.district || 'Cầu Giấy',
      city: (place as any).city || 'Hà Nội',
      category: place.category || 'street_food',
      categoryLabel: place.categoryLabel || 'Quán ẩm thực',
      sourceRefs: [sourceRef],
      primarySource: isComm ? 'bitequest_community' : 'bitequest_curated',
      isCommunitySpot: isComm,
      communityStatus: place.communityStatus || (isComm ? 'pending' : undefined),
      communityVerified: place.communityVerified || false,
      firstDiscovererId: place.firstDiscovererId,
      firstDiscovererName: place.firstDiscovererName,
      verifiedBiteCount: 0,
      createdAt: (place as any).createdAt || now,
      updatedAt: now,
      lastSyncedAt: now,
    };

    this.indexVenueInMemory(venue);
    return venue;
  }

  private getEffectivePrimaryProvider(): PlaceProvider | null {
    if (this.primaryProvider) return this.primaryProvider;
    const geoapifyKey =
      (typeof process !== 'undefined'
        ? process.env?.GEOAPIFY_SERVER_KEY || process.env?.GEOAPIFY_API_KEY || process.env?.VITE_GEOAPIFY_API_KEY
        : '') || '';
    this.primaryProvider = new GeoapifyPlaceProvider(geoapifyKey);
    return this.primaryProvider;
  }

  setPrimaryProvider(provider: PlaceProvider) {
    this.primaryProvider = provider;
  }

  setFirestoreDb(db: FirestoreDbLike | null) {
    this.firestoreDb = db;
  }

  /**
   * Generates a stable spatial grid cell key for a given lat/lng.
   * e.g., grid_21.03_105.80 covers ~1.1km x 1.1km
   */
  public getGridCellKey(lat: number, lng: number): string {
    const latCell = (Math.floor(lat / SPATIAL_GRID_SIZE_DEG) * SPATIAL_GRID_SIZE_DEG).toFixed(2);
    const lngCell = (Math.floor(lng / SPATIAL_GRID_SIZE_DEG) * SPATIAL_GRID_SIZE_DEG).toFixed(2);
    return `grid_${latCell}_${lngCell}`;
  }

  /**
   * Normalizes a venue name for conservative deduplication matching.
   * Lowercase, trimmed, internal multi-spaces collapsed, preserves Vietnamese accents.
   */
  public normalizeName(name: string): string {
    if (!name) return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Computes the deterministic canonical ID for an external provider place.
   */
  public getCanonicalVenueId(provider: string, providerPlaceId: string): string {
    const cleanProvider = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanId = providerPlaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `vn_${cleanProvider}_${cleanId}`;
  }

  /**
   * Indexes a canonical venue in memory and spatial grids.
   */
  public indexVenueInMemory(venue: CanonicalVenue): void {
    this.memoryVenues.set(venue.canonicalVenueId, venue);

    // Spatial grid indexing
    const cellKey = venue.gridCell || this.getGridCellKey(venue.latitude, venue.longitude);
    if (!this.spatialGrid.has(cellKey)) {
      this.spatialGrid.set(cellKey, new Set());
    }
    this.spatialGrid.get(cellKey)!.add(venue.canonicalVenueId);

    // Reverse lookup indexing
    for (const ref of venue.sourceRefs) {
      this.providerToCanonicalMap.set(`${ref.provider}:${ref.providerPlaceId}`, venue.canonicalVenueId);
    }
  }

  /**
   * Hydrates initial community spots or seed community spots into the registry.
   */
  public registerCommunitySpot(spot: Place): CanonicalVenue {
    const now = new Date().toISOString();
    const canonicalId = `vn_comm_${spot.id}`;
    const normName = this.normalizeName(spot.name);
    const gridCell = this.getGridCellKey(spot.latitude, spot.longitude);

    const sourceRef: VenueSourceRef = {
      provider: 'bitequest_community',
      providerPlaceId: spot.id,
      firstSeenAt: spot.createdAt || now,
      lastSeenAt: now,
    };

    const existing = this.memoryVenues.get(canonicalId);
    if (existing) {
      existing.name = spot.name;
      existing.normalizedName = normName;
      existing.latitude = spot.latitude;
      existing.longitude = spot.longitude;
      existing.address = spot.address || existing.address;
      existing.district = spot.district || existing.district;
      existing.category = spot.category;
      existing.categoryLabel = spot.categoryLabel || existing.categoryLabel;
      existing.communityStatus = spot.communityStatus || existing.communityStatus;
      existing.communityVerified = spot.communityVerified || existing.communityVerified;
      existing.updatedAt = now;
      this.indexVenueInMemory(existing);
      return existing;
    }

    const venue: CanonicalVenue = {
      canonicalVenueId: canonicalId,
      name: spot.name,
      normalizedName: normName,
      latitude: spot.latitude,
      longitude: spot.longitude,
      gridCell,
      address: spot.address || 'Hà Nội',
      district: spot.district || 'Cầu Giấy',
      city: (spot as any).city || 'Hà Nội',
      category: spot.category || 'street_food',
      categoryLabel: spot.categoryLabel || 'Quán ngõ / Ăn vặt',
      sourceRefs: [sourceRef],
      primarySource: 'bitequest_community',
      isCommunitySpot: true,
      communityStatus: spot.communityStatus || 'pending',
      communityVerified: spot.communityVerified || false,
      firstDiscovererId: spot.firstDiscovererId,
      firstDiscovererName: spot.firstDiscovererName,
      verifiedBiteCount: 0, // Invariant: starts at 0, computed from checkins
      createdAt: (spot as any).createdAt || now,
      updatedAt: now,
      lastSyncedAt: now,
    };

    this.indexVenueInMemory(venue);
    return venue;
  }

  /**
   * Resiliently normalizes and upserts a unified candidate POI from an external provider (Geoapify).
   * Conservative deduplication rules applied.
   */
  public upsertCandidatePOI(candidate: UnifiedPlace, providerName: string = 'geoapify'): CanonicalVenue | null {
    if (
      !candidate ||
      typeof candidate.latitude !== 'number' ||
      typeof candidate.longitude !== 'number' ||
      isNaN(candidate.latitude) ||
      isNaN(candidate.longitude) ||
      candidate.latitude < -90 ||
      candidate.latitude > 90 ||
      candidate.longitude < -180 ||
      candidate.longitude > 180
    ) {
      return null;
    }

    const now = new Date().toISOString();
    const providerPlaceId = candidate.providerId || candidate.id;
    const normName = this.normalizeName(candidate.name);
    const lookupKey = `${providerName}:${providerPlaceId}`;

    // 1. Check exact provider + providerPlaceId reverse index match
    const existingId = this.providerToCanonicalMap.get(lookupKey);
    if (existingId && this.memoryVenues.has(existingId)) {
      const existing = this.memoryVenues.get(existingId)!;
      existing.lastSyncedAt = now;
      existing.updatedAt = now;
      const ref = existing.sourceRefs.find((r) => r.provider === providerName && r.providerPlaceId === providerPlaceId);
      if (ref) {
        ref.lastSeenAt = now;
      } else {
        existing.sourceRefs.push({
          provider: providerName,
          providerPlaceId,
          firstSeenAt: now,
          lastSeenAt: now,
        });
      }
      return existing;
    }

    // 2. Conservative canonical deduplication check against nearby venues in the same grid
    const gridCell = this.getGridCellKey(candidate.latitude, candidate.longitude);
    const candidateVenuesInCell = this.getVenuesInGridCell(gridCell);

    let matchFound: CanonicalVenue | null = null;
    for (const v of candidateVenuesInCell) {
      if (v.normalizedName === normName && normName.length > 0) {
        const dist = getDistance(
          { latitude: v.latitude, longitude: v.longitude },
          { latitude: candidate.latitude, longitude: candidate.longitude }
        );
        // Deduplicate only if EXACT normalized name matches and distance is <= DEDUP_DISTANCE_METERS (25m)
        if (dist <= DEDUP_DISTANCE_METERS) {
          matchFound = v;
          break;
        }
      }
    }

    if (matchFound) {
      matchFound.lastSyncedAt = now;
      matchFound.updatedAt = now;
      const existingRef = matchFound.sourceRefs.find(
        (r) => r.provider === providerName && r.providerPlaceId === providerPlaceId
      );
      if (existingRef) {
        existingRef.lastSeenAt = now;
      } else {
        matchFound.sourceRefs.push({
          provider: providerName,
          providerPlaceId,
          firstSeenAt: now,
          lastSeenAt: now,
        });
      }
      this.providerToCanonicalMap.set(lookupKey, matchFound.canonicalVenueId);
      return matchFound;
    }

    // 3. New Canonical Venue
    const canonicalVenueId = this.getCanonicalVenueId(providerName, providerPlaceId);
    const newVenue: CanonicalVenue = {
      canonicalVenueId,
      name: candidate.name || 'Quán ẩm thực',
      normalizedName: normName,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      gridCell,
      address: candidate.address || 'Hà Nội',
      district: candidate.district || 'Cầu Giấy',
      city: candidate.city || 'Hà Nội',
      category: candidate.category || 'street_food',
      categoryLabel: candidate.categoryLabel || 'Ẩm thực đường phố',
      categories: (candidate as any).categories || [],
      sourceRefs: [
        {
          provider: providerName,
          providerPlaceId,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      ],
      primarySource: providerName,
      isCommunitySpot: false,
      verifiedBiteCount: 0, // Critical Invariant: existence != verified bite
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
    };

    this.indexVenueInMemory(newVenue);

    // Asynchronously sync to Firestore if configured
    this.persistToFirestoreAsync(newVenue).catch(() => {});

    return newVenue;
  }

  /**
   * Hydrates canonical venues from Firestore into in-memory spatial index.
   */
  public async hydrateFromFirestore(): Promise<number> {
    if (!this.firestoreDb) return 0;
    try {
      const snap = await this.firestoreDb.collection('venues').get();
      if (!snap || !Array.isArray(snap.docs)) return 0;
      let count = 0;
      for (const doc of snap.docs) {
        const data = doc.data() as CanonicalVenue;
        if (data && data.canonicalVenueId && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          this.indexVenueInMemory(data);
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  private async persistToFirestoreAsync(venue: CanonicalVenue): Promise<void> {
    if (!this.firestoreDb) return;
    try {
      await this.firestoreDb.collection('venues').doc(venue.canonicalVenueId).set(
        {
          canonicalVenueId: venue.canonicalVenueId,
          name: venue.name,
          normalizedName: venue.normalizedName,
          latitude: venue.latitude,
          longitude: venue.longitude,
          gridCell: venue.gridCell,
          address: venue.address || '',
          district: venue.district || '',
          city: venue.city || 'Hà Nội',
          category: venue.category,
          categoryLabel: venue.categoryLabel || '',
          sourceRefs: venue.sourceRefs,
          primarySource: venue.primarySource,
          isCommunitySpot: venue.isCommunitySpot,
          verifiedBiteCount: venue.verifiedBiteCount,
          lastVerifiedBiteAt: venue.lastVerifiedBiteAt || null,
          createdAt: venue.createdAt,
          updatedAt: venue.updatedAt,
          lastSyncedAt: venue.lastSyncedAt,
        },
        { merge: true }
      );
    } catch {
      // Non-blocking in-memory resilience
    }
  }

  /**
   * Retrieves venues in a given spatial grid cell.
   */
  public getVenuesInGridCell(cellKey: string): CanonicalVenue[] {
    const ids = this.spatialGrid.get(cellKey);
    if (!ids) return [];
    const res: CanonicalVenue[] = [];
    for (const id of ids) {
      const v = this.memoryVenues.get(id);
      if (v) res.push(v);
    }
    return res;
  }

  /**
   * Retrieves all candidate venues within a radius from memory.
   */
  public getLocalVenuesInRadius(lat: number, lng: number, radiusMeters: number): CanonicalVenue[] {
    const results: CanonicalVenue[] = [];
    for (const venue of this.memoryVenues.values()) {
      const dist = getDistance({ latitude: lat, longitude: lng }, { latitude: venue.latitude, longitude: venue.longitude });
      if (dist <= radiusMeters) {
        results.push(venue);
      }
    }
    return results;
  }

  /**
   * Checks if an area is currently fresh in the registry.
   */
  public isAreaFresh(lat: number, lng: number, ttlMs: number = REGISTRY_CACHE_TTL_MS): boolean {
    const cellKey = this.getGridCellKey(lat, lng);
    const lastSynced = this.syncedGridCells.get(cellKey);
    if (!lastSynced) return false;
    return Date.now() - lastSynced < ttlMs;
  }

  /**
   * Marks an area as freshly synced.
   */
  public markAreaSynced(lat: number, lng: number): void {
    const cellKey = this.getGridCellKey(lat, lng);
    this.syncedGridCells.set(cellKey, Date.now());
  }

  /**
   * Authoritatively updates verifiedBiteCount and lastVerifiedBiteAt from checkins.
   */
  public syncVerifiedBiteCounts(checkins: BiteCheckin[]): void {
    const verifiedCheckins = checkins.filter((c) => c.isVerified);

    for (const venue of this.memoryVenues.values()) {
      const matching = verifiedCheckins.filter((c) => {
        if (c.placeId === venue.canonicalVenueId) return true;
        if (c.placeId === venue.canonicalVenueId.replace('vn_comm_', '')) return true;
        if (venue.sourceRefs.some((r) => r.providerPlaceId === c.providerPlaceId || r.providerPlaceId === c.placeId)) {
          return true;
        }
        return false;
      });

      venue.verifiedBiteCount = matching.length;
      if (matching.length > 0) {
        const sorted = [...matching].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        venue.lastVerifiedBiteAt = sorted[0].createdAt;
      } else {
        venue.lastVerifiedBiteAt = undefined;
      }
    }
  }

  /**
   * Converts a CanonicalVenue to the consumer-facing UnifiedPlace format.
   */
  public toUnifiedPlace(venue: CanonicalVenue, centerLat: number, centerLng: number): UnifiedPlace {
    const dist = getDistance(
      { latitude: centerLat, longitude: centerLng },
      { latitude: venue.latitude, longitude: venue.longitude }
    );

    const primaryRef = venue.sourceRefs[0];
    const classification = classifyVenue({
      name: venue.name,
      category: venue.category,
      categoryLabel: venue.categoryLabel,
      categories: venue.categories,
    });
    const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;

    return {
      id: venue.canonicalVenueId,
      canonicalVenueId: venue.canonicalVenueId,
      providerId: primaryRef ? primaryRef.providerPlaceId : undefined,
      provider: venue.primarySource,
      source: venue.primarySource,
      name: venue.name,
      category: classification.category,
      categoryLabel: catMeta.label,
      address: venue.address || '',
      district: venue.district || 'Cầu Giấy',
      city: venue.city || 'Hà Nội',
      latitude: venue.latitude,
      longitude: venue.longitude,
      distanceMeters: dist,
      isCommunitySpot: venue.isCommunitySpot,
      communityStatus: venue.communityStatus,
      communityVerified: venue.communityVerified,
      firstDiscovererId: venue.firstDiscovererId,
      firstDiscovererName: venue.firstDiscovererName,
      verifiedBiteCount: venue.verifiedBiteCount,
      lastVerifiedBiteAt: venue.lastVerifiedBiteAt,
    };
  }

  /**
   * Primary discovery method enforcing 10km boundary, viewport/cell caching,
   * resilient normalization, and explicit source provenance.
   */
  public async discoverVenues(options: VenueQueryOptions): Promise<VenueDiscoveryResult> {
    const {
      latitude,
      longitude,
      radiusMeters = 2000,
      limit = 100,
      category,
      discoveryAnchor,
      forceRefresh = false,
    } = options;

    const isDemoMode = process.env.BITEQUEST_DEMO_MODE === 'true';
    const effectiveAnchor: DiscoveryAnchor = discoveryAnchor || {
      latitude,
      longitude,
      isRealUserLocation: false,
    };

    // Compute distance to reference anchor for telemetry
    const distanceToAnchor = getDistance(
      { latitude: effectiveAnchor.latitude, longitude: effectiveAnchor.longitude },
      { latitude, longitude }
    );

    // 10km Discovery Boundary Enforcement
    if (effectiveAnchor.isRealUserLocation && distanceToAnchor > 10000) {
      return {
        venues: [],
        provenance: {
          source: 'UNAVAILABLE',
          provider: 'None (Boundary Exceeded)',
          isDemoMode,
          externalApi: false,
          registryCount: this.memoryVenues.size,
          providerFetchedCount: 0,
          communityCount: 0,
          finalVenueCount: 0,
          cacheHits: 0,
          cacheMisses: 0,
          discoveryAnchor: {
            ...effectiveAnchor,
            distanceToQueryMeters: distanceToAnchor,
          },
          warning: 'DISCOVERY_BOUNDARY_EXCEEDED: Requested query exceeds maximum 10km radius from real user discovery anchor',
        },
      };
    }

    const isFresh = !forceRefresh && this.isAreaFresh(latitude, longitude);
    let provenanceSource: ProvenanceSource = 'REGISTRY_CACHE';
    let providerFetchedCount = 0;
    let cacheHits = isFresh ? 1 : 0;
    let cacheMisses = isFresh ? 0 : 1;
    let warning: string | undefined;

    const provider = this.getEffectivePrimaryProvider();

    // 2. Fetch external provider if stale/missing
    if (!isFresh && provider) {
      try {
        const providerResults = await provider.searchNearby({
          latitude,
          longitude,
          radiusMeters,
          limit,
        });

        providerFetchedCount = providerResults.length;
        for (const poi of providerResults) {
          // Per-feature resilient upsert
          if (poi && poi.name && typeof poi.latitude === 'number' && typeof poi.longitude === 'number') {
            this.upsertCandidatePOI(poi, provider.providerName || 'geoapify');
          }
        }
        this.markAreaSynced(latitude, longitude);
        provenanceSource = provider.providerName === 'geoapify' ? 'GEOAPIFY' : 'REGISTRY_CACHE';
      } catch (err: any) {
        warning = `PROVIDER_CALL_FAILED: ${err?.message || 'External provider error'}`;
        // Fallback gracefully to cached registry / community spots without leaking INITIAL_PLACES
        if (isDemoMode) {
          provenanceSource = 'DEMO_FIXTURE';
        } else {
          provenanceSource = this.memoryVenues.size > 0 ? 'REGISTRY_CACHE' : 'BITEQUEST_COMMUNITY';
        }
      }
    } else if (isDemoMode && this.memoryVenues.size === 0) {
      provenanceSource = 'DEMO_FIXTURE';
      for (const p of INITIAL_PLACES) {
        this.registerCommunitySpot(p as any);
      }
    }

    // 3. Collect matching venues from registry strictly inside the requested radius
    let localVenues = this.getLocalVenuesInRadius(latitude, longitude, radiusMeters);

    if (category) {
      localVenues = localVenues.filter((v) => v.category === category);
    }

    // Sort by distance to query center
    localVenues.sort((a, b) => {
      const distA = getDistance({ latitude, longitude }, { latitude: a.latitude, longitude: a.longitude });
      const distB = getDistance({ latitude, longitude }, { latitude: b.latitude, longitude: b.longitude });
      return distA - distB;
    });

    const finalVenues = localVenues.slice(0, limit);
    const communityCount = finalVenues.filter((v) => v.isCommunitySpot).length;

    return {
      venues: finalVenues,
      provenance: {
        source: provenanceSource,
        provider:
          provenanceSource === 'GEOAPIFY'
            ? 'Geoapify Places API'
            : provenanceSource === 'REGISTRY_CACHE'
            ? 'Venue Registry Cache'
            : provenanceSource === 'BITEQUEST_COMMUNITY'
            ? 'BiteQuest Community Spots'
            : isDemoMode
            ? 'Demo Fixtures'
            : 'Venue Registry',
        isDemoMode,
        externalApi: provenanceSource === 'GEOAPIFY',
        registryCount: this.memoryVenues.size,
        providerFetchedCount,
        communityCount,
        finalVenueCount: finalVenues.length,
        cacheHits,
        cacheMisses,
        discoveryAnchor: {
          ...effectiveAnchor,
          distanceToQueryMeters: distanceToAnchor,
        },
        warning,
      },
    };
  }

  /**
   * Bite AI Foundation API: Reusable server function for future Bite AI to query canonical venues.
   */
  public async getVenuesInRadius(options: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    category?: string;
    minVerifiedBites?: number;
    limit?: number;
  }): Promise<CanonicalVenue[]> {
    const { latitude, longitude, radiusMeters = 2000, category, minVerifiedBites = 0, limit = 50 } = options;

    let venues = this.getLocalVenuesInRadius(latitude, longitude, radiusMeters);

    if (category) {
      venues = venues.filter((v) => v.category === category);
    }

    if (minVerifiedBites > 0) {
      venues = venues.filter((v) => v.verifiedBiteCount >= minVerifiedBites);
    }

    venues.sort((a, b) => {
      const distA = getDistance({ latitude, longitude }, { latitude: a.latitude, longitude: a.longitude });
      const distB = getDistance({ latitude, longitude }, { latitude: b.latitude, longitude: b.longitude });
      return distA - distB;
    });

    return venues.slice(0, limit);
  }
}

// Singleton server instance
export const venueRegistry = new VenueRegistryService(undefined, null, { autoHydrateSeed: true });
