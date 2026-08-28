import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenueRegistryService, REGISTRY_CACHE_TTL_MS } from '../src/services/maps/venueRegistryService';
import { PlaceProvider, UnifiedPlace } from '../src/services/maps/types';
import { Place, BiteCheckin } from '../src/types';
import { CanonicalVenue } from '../src/services/maps/venueRegistryTypes';

function makeUnifiedPlace(overrides: Partial<UnifiedPlace> = {}): UnifiedPlace {
  return {
    id: 'test_place_id',
    name: 'Quán ăn thử nghiệm',
    category: 'street_food',
    categoryLabel: 'Ẩm thực đường phố',
    address: '123 Cầu Giấy',
    district: 'Cầu Giấy',
    city: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.7958,
    ...overrides,
  };
}

function makeBiteCheckin(overrides: Partial<BiteCheckin> = {}): BiteCheckin {
  return {
    id: 'chk_default',
    userId: 'user_default',
    userName: 'User Default',
    userAvatar: 'https://images.unsplash.com/avatar',
    placeId: 'place_default',
    placeName: 'Quán ăn default',
    placeAddress: '123 Cầu Giấy',
    district: 'Cầu Giấy',
    foodCategory: 'street_food',
    imageUrl: 'https://images.unsplash.com/photo-test',
    caption: 'Ngon quá',
    tasteRating: 'tasty',
    priceRating: 'good_value',
    wouldReturn: true,
    isVerified: true,
    createdAt: '2026-08-26T10:00:00.000Z',
    reactions: [],
    ...overrides,
  };
}

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place_default',
    name: 'Quán mặc định',
    category: 'street_food',
    categoryLabel: 'Ẩm thực đường phố',
    address: 'Ngõ 1 Cầu Giấy',
    district: 'Cầu Giấy',
    latitude: 21.03,
    longitude: 105.79,
    priceBand: '30k - 50k',
    priceMin: 30000,
    priceMax: 50000,
    rating: 4.5,
    reviewCount: 10,
    imageUrl: 'https://images.unsplash.com/photo-test',
    isOpen: true,
    openingHoursText: '07:00 - 22:00',
    ...overrides,
  };
}

describe('Venue Registry V1 — Specification & Verification Tests', () => {
  let registry: VenueRegistryService;
  let mockProvider: PlaceProvider;
  let mockFirestoreData: Map<string, any>;
  let mockFirestoreDb: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFirestoreData = new Map();

    mockFirestoreDb = {
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          get: async () => ({
            exists: mockFirestoreData.has(`${colName}/${docId}`),
            data: () => mockFirestoreData.get(`${colName}/${docId}`),
          }),
          set: async (data: any) => {
            mockFirestoreData.set(`${colName}/${docId}`, data);
          },
        }),
        get: async () => ({
          docs: Array.from(mockFirestoreData.entries())
            .filter(([k]) => k.startsWith(`${colName}/`))
            .map(([k, v]) => ({ id: k.replace(`${colName}/`, ''), data: () => v })),
        }),
      }),
    };

    mockProvider = {
      providerName: 'geoapify',
      searchNearby: vi.fn(),
    };

    registry = new VenueRegistryService(mockProvider, mockFirestoreDb);
  });

  describe('1. Registry Persistence & Lifecycle Survival', () => {
    it('persists canonical venues to Firestore venues collection', async () => {
      const mockPlaces: UnifiedPlace[] = [
        makeUnifiedPlace({
          id: 'ext_geo_101',
          providerId: 'geo_101',
          provider: 'geoapify',
          name: 'Phở Bò Gia Truyền Cầu Giấy',
          category: 'noodles',
          categoryLabel: 'Phở & Bún',
          address: '45 Cầu Giấy',
          district: 'Cầu Giấy',
          city: 'Hà Nội',
          latitude: 21.0312,
          longitude: 105.7951,
        }),
      ];

      (mockProvider.searchNearby as any).mockResolvedValueOnce(mockPlaces);

      const res = await registry.discoverVenues({
        latitude: 21.0312,
        longitude: 105.7951,
        radiusMeters: 2000,
      });

      expect(res.venues.length).toBe(1);
      expect(mockFirestoreData.has('venues/vn_geoapify_geo_101')).toBe(true);
      const stored = mockFirestoreData.get('venues/vn_geoapify_geo_101');
      expect(stored.name).toBe('Phở Bò Gia Truyền Cầu Giấy');
      expect(stored.primarySource).toBe('geoapify');
      expect(stored.verifiedBiteCount).toBe(0);
    });

    it('hydrates canonical venues from Firestore into memory after process restart', async () => {
      // Seed Firestore with a pre-existing canonical venue
      const seededVenue: CanonicalVenue = {
        canonicalVenueId: 'vn_geoapify_geo_saved_01',
        name: 'Bún Chả Cầu Giấy',
        normalizedName: 'bún chả cầu giấy',
        latitude: 21.032,
        longitude: 105.796,
        gridCell: 'grid_21.03_105.79',
        address: '10 Cầu Giấy',
        district: 'Cầu Giấy',
        city: 'Hà Nội',
        category: 'noodles',
        categoryLabel: 'Bún chả',
        sourceRefs: [{ provider: 'geoapify', providerPlaceId: 'geo_saved_01', firstSeenAt: '2026-01-01', lastSeenAt: '2026-01-01' }],
        primarySource: 'geoapify',
        isCommunitySpot: false,
        verifiedBiteCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastSyncedAt: '2026-01-01T00:00:00.000Z',
      };
      mockFirestoreData.set('venues/vn_geoapify_geo_saved_01', seededVenue);

      // Create a fresh new registry instance simulating reboot
      const newRegistry = new VenueRegistryService(mockProvider, mockFirestoreDb);
      const hydrated = await newRegistry.hydrateFromFirestore();

      expect(hydrated).toBe(1);
      const local = newRegistry.getLocalVenuesInRadius(21.032, 105.796, 500);
      expect(local.length).toBe(1);
      expect(local[0].canonicalVenueId).toBe('vn_geoapify_geo_saved_01');
    });
  });

  describe('2. Cache Proof & TTL Enforcement', () => {
    it('Scenario A & B: first query calls provider; second query within TTL is a fresh cache hit with 0 provider calls', async () => {
      const mockPlaces: UnifiedPlace[] = [
        makeUnifiedPlace({
          id: 'ext_geo_201',
          providerId: 'geo_201',
          provider: 'geoapify',
          name: 'Cà Phê Trứng Hà Nội',
          category: 'coffee',
          categoryLabel: 'Cà phê',
          address: '22 Dịch Vọng',
          district: 'Cầu Giấy',
          city: 'Hà Nội',
          latitude: 21.029,
          longitude: 105.792,
        }),
      ];

      (mockProvider.searchNearby as any).mockResolvedValue(mockPlaces);

      // A. First Query (Cache Miss)
      const resA = await registry.discoverVenues({
        latitude: 21.029,
        longitude: 105.792,
        radiusMeters: 2000,
      });

      expect(mockProvider.searchNearby).toHaveBeenCalledTimes(1);
      expect(resA.provenance.providerFetchedCount).toBe(1);
      expect(resA.provenance.finalVenueCount).toBe(1);
      expect(resA.provenance.source).toBe('GEOAPIFY');

      // B. Second Query to same viewport while cache is fresh
      const resB = await registry.discoverVenues({
        latitude: 21.029,
        longitude: 105.792,
        radiusMeters: 2000,
      });

      // Provider was NOT called again
      expect(mockProvider.searchNearby).toHaveBeenCalledTimes(1);
      expect(resB.provenance.cacheHits).toBe(1);
      expect(resB.provenance.source).toBe('REGISTRY_CACHE');
      expect(resB.venues.length).toBe(1);
    });

    it('stale cache (>24h TTL) triggers provider refresh', async () => {
      (mockProvider.searchNearby as any).mockResolvedValue([]);

      // First query
      await registry.discoverVenues({
        latitude: 21.0285,
        longitude: 105.7958,
        radiusMeters: 1000,
      });
      expect(mockProvider.searchNearby).toHaveBeenCalledTimes(1);

      // Manually age the cache beyond 24h
      const cellKey = registry.getGridCellKey(21.0285, 105.7958);
      (registry as any).syncedGridCells.set(cellKey, Date.now() - (REGISTRY_CACHE_TTL_MS + 1000));

      expect(registry.isAreaFresh(21.0285, 105.7958)).toBe(false);

      // Query again
      await registry.discoverVenues({
        latitude: 21.0285,
        longitude: 105.7958,
        radiusMeters: 1000,
      });

      expect(mockProvider.searchNearby).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Deduplication Rules & Spatial Threshold', () => {
    it('merges identical venue with same providerPlaceId', () => {
      const first = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_geo_fixed_1',
          providerId: 'geo_fixed_place_1',
          name: 'Cà Phê Trứng',
          latitude: 21.03,
          longitude: 105.79,
        }),
        'geoapify'
      );

      const second = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_geo_fixed_1',
          providerId: 'geo_fixed_place_1',
          name: 'Cà Phê Trứng (Updated Name)',
          latitude: 21.03001,
          longitude: 105.79001,
        }),
        'geoapify'
      );

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second!.canonicalVenueId).toBe(first!.canonicalVenueId);
      expect(second!.sourceRefs.length).toBe(1);
    });

    it('merges identical venue (normalized name match + distance <= 25m)', async () => {
      // Existing venue in registry
      registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_geo_old_1',
          providerId: 'geo_old_1',
          name: 'Bún Đậu Mắm Tôm Cô Hương',
          latitude: 21.033,
          longitude: 105.794,
          category: 'street_food',
        }),
        'geoapify'
      );

      // Incoming provider place with identical name 5m away
      const merged = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_geo_new_2',
          providerId: 'geo_new_2',
          name: 'bún đậu mắm tôm cô hương ', // Normalized match
          latitude: 21.03303, // ~3.5m away
          longitude: 105.79402,
          category: 'street_food',
        }),
        'geoapify'
      );

      expect(merged).not.toBeNull();
      expect(merged!.canonicalVenueId).toBe('vn_geoapify_geo_old_1');
      expect(merged!.sourceRefs.length).toBe(2);
      expect(merged!.sourceRefs.some((r) => r.providerPlaceId === 'geo_new_2')).toBe(true);
    });

    it('does NOT merge two distinct venues less than 25m apart with different names (e.g. 5m apart)', async () => {
      const venue1 = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_shop_a',
          providerId: 'place_shop_a',
          name: 'Trà Sữa Mixue Cầu Giấy',
          latitude: 21.0330,
          longitude: 105.7940,
          category: 'drinks',
        }),
        'geoapify'
      );

      const venue2 = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_shop_b',
          providerId: 'place_shop_b',
          name: 'Bánh Mì Kebab Thổ Nhĩ Kỳ',
          latitude: 21.03304, // ~5m away from venue1
          longitude: 105.79402,
          category: 'street_food',
        }),
        'geoapify'
      );

      expect(venue1).not.toBeNull();
      expect(venue2).not.toBeNull();
      expect(venue1!.canonicalVenueId).not.toBe(venue2!.canonicalVenueId);
      expect(venue1!.canonicalVenueId).toBe('vn_geoapify_place_shop_a');
      expect(venue2!.canonicalVenueId).toBe('vn_geoapify_place_shop_b');
      expect(venue1!.name).toBe('Trà Sữa Mixue Cầu Giấy');
      expect(venue2!.name).toBe('Bánh Mì Kebab Thổ Nhĩ Kỳ');
    });

    it('does NOT merge different provider IDs in same building unless strong identity evidence', () => {
      // Two distinct food stalls inside the same commercial food court building (same exact coords)
      const stall1 = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_court_1',
          providerId: 'geo_foodcourt_stall_1',
          name: 'Phở Bò Thăng Long',
          latitude: 21.0285,
          longitude: 105.7958,
        }),
        'geoapify'
      );

      const stall2 = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_court_2',
          providerId: 'geo_foodcourt_stall_2',
          name: 'Cơm Gà Hải Nam',
          latitude: 21.0285,
          longitude: 105.7958,
        }),
        'geoapify'
      );

      expect(stall1).not.toBeNull();
      expect(stall2).not.toBeNull();
      expect(stall1!.canonicalVenueId).toBe('vn_geoapify_geo_foodcourt_stall_1');
      expect(stall2!.canonicalVenueId).toBe('vn_geoapify_geo_foodcourt_stall_2');
      expect(stall1!.canonicalVenueId).not.toBe(stall2!.canonicalVenueId);
    });
  });

  describe('4. Zero-Bite Venue Proof & Verified Bite Invariant', () => {
    it('provider venue with 0 bites is indexed, discoverable, but NOT verified', async () => {
      const candidate = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_zero_bite',
          providerId: 'geo_zero_bite_spot',
          name: 'Quán Chè Bưởi An Giang',
          latitude: 21.025,
          longitude: 105.791,
          category: 'dessert',
        }),
        'geoapify'
      );

      expect(candidate).not.toBeNull();
      expect(candidate!.verifiedBiteCount).toBe(0);
      expect(candidate!.isCommunitySpot).toBe(false);

      const unified = registry.toUnifiedPlace(candidate!, 21.025, 105.791);
      expect(unified.verifiedBiteCount).toBe(0);
      expect(unified.communityVerified).toBeUndefined();

      // Provider existence does not increment bite count
      registry.syncVerifiedBiteCounts([]);
      expect(candidate!.verifiedBiteCount).toBe(0);
    });

    it('verifiedBiteCount derives authoritatively only from verified check-ins', () => {
      const v = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_pho_10',
          providerId: 'geo_pho_10',
          name: 'Phở 10 Lý Quốc Sư',
          latitude: 21.03,
          longitude: 105.79,
          category: 'noodles',
        }),
        'geoapify'
      );

      expect(v).not.toBeNull();

      const checkins: BiteCheckin[] = [
        makeBiteCheckin({
          id: 'chk_1',
          userId: 'user_1',
          placeId: v!.canonicalVenueId,
          placeName: 'Phở 10 Lý Quốc Sư',
          tasteRating: 'tasty',
          priceRating: 'good_value',
          wouldReturn: true,
          isVerified: true, // Verified checkin
          createdAt: '2026-08-26T10:00:00.000Z',
        }),
        makeBiteCheckin({
          id: 'chk_2',
          userId: 'user_2',
          placeId: v!.canonicalVenueId,
          tasteRating: 'tasty',
          priceRating: 'good_value',
          wouldReturn: true,
          isVerified: false, // Unverified gallery upload -> MUST NOT COUNT
          createdAt: '2026-08-26T11:00:00.000Z',
        }),
      ];

      registry.syncVerifiedBiteCounts(checkins);
      expect(v!.verifiedBiteCount).toBe(1);
      expect(v!.lastVerifiedBiteAt).toBe('2026-08-26T10:00:00.000Z');
    });

    it('27 authoritative verified check-ins but feed contains only 10 -> canonical venue verifiedBiteCount must equal 27', () => {
      const v = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_pho_cuong',
          providerId: 'geo_pho_cuong',
          name: 'Phở Bò Cường',
          latitude: 21.031,
          longitude: 105.792,
          category: 'noodles',
        }),
        'geoapify'
      );

      expect(v).not.toBeNull();

      // Create 27 authoritative verified check-ins for this venue
      const authoritativeCheckins: BiteCheckin[] = Array.from({ length: 27 }, (_, i) =>
        makeBiteCheckin({
          id: `auth_chk_${i}`,
          userId: `user_${i}`,
          placeId: v!.canonicalVenueId,
          placeName: 'Phở Bò Cường',
          isVerified: true,
          createdAt: `2026-08-26T10:${i < 10 ? '0' + i : i}:00.000Z`,
        })
      );

      // Sliced public feed has only 10 checkins
      const publicFeedSlice = authoritativeCheckins.slice(0, 10);
      expect(publicFeedSlice.length).toBe(10);

      // Invariant: syncVerifiedBiteCounts with authoritative checkins reflects all 27 verified check-ins
      registry.syncVerifiedBiteCounts(authoritativeCheckins);
      expect(v!.verifiedBiteCount).toBe(27);
    });
  });

  describe('5. Authentic Community Spot Compatibility', () => {
    it('preserves community spot creator, status, and identity without overwrite', () => {
      const spot: Place = makePlace({
        id: 'place_community_oc_nong',
        name: 'Ốc Nóng Hà Trang',
        category: 'street_food',
        categoryLabel: 'Ốc ngõ',
        address: 'Ngõ 1 Đinh Liệt',
        district: 'Hoàn Kiếm',
        latitude: 21.032,
        longitude: 105.852,
        priceBand: '30k - 60k',
        priceMin: 30000,
        priceMax: 60000,
        rating: 4.8,
        isCommunitySpot: true,
        communityStatus: 'verified',
        communityVerified: true,
        firstDiscovererId: 'user_viet_cuong',
        firstDiscovererName: 'Việt Cường',
      });

      const venue = registry.registerCommunitySpot(spot);

      expect(venue.canonicalVenueId).toBe('vn_comm_place_community_oc_nong');
      expect(venue.isCommunitySpot).toBe(true);
      expect(venue.communityStatus).toBe('verified');
      expect(venue.communityVerified).toBe(true);
      expect(venue.firstDiscovererId).toBe('user_viet_cuong');
      expect(venue.firstDiscovererName).toBe('Việt Cường');
      expect(venue.primarySource).toBe('bitequest_community');
    });
  });

  describe('6. 10km Discovery Boundary Enforcement', () => {
    it('blocks queries exceeding 10,000m from discovery anchor', async () => {
      const anchor = { latitude: 21.0285, longitude: 105.7958, isRealUserLocation: true };
      // Query 14km away (Sóc Sơn / Đông Anh)
      const distantQuery = { latitude: 21.155, longitude: 105.7958 };

      const res = await registry.discoverVenues({
        latitude: distantQuery.latitude,
        longitude: distantQuery.longitude,
        radiusMeters: 2000,
        discoveryAnchor: anchor,
      });

      expect(res.venues.length).toBe(0);
      expect(res.provenance.source).toBe('UNAVAILABLE');
      expect(res.provenance.warning).toContain('DISCOVERY_BOUNDARY_EXCEEDED');
      expect(mockProvider.searchNearby).not.toHaveBeenCalled();
    });

    it('allows queries within 10,000m from discovery anchor', async () => {
      const anchor = { latitude: 21.0285, longitude: 105.7958, isRealUserLocation: true };
      // Query 2km away (Kim Mã)
      const nearbyQuery = { latitude: 21.033, longitude: 105.815 };

      (mockProvider.searchNearby as any).mockResolvedValue([]);

      const res = await registry.discoverVenues({
        latitude: nearbyQuery.latitude,
        longitude: nearbyQuery.longitude,
        radiusMeters: 1000,
        discoveryAnchor: anchor,
      });

      expect(res.provenance.warning).toBeUndefined();
      expect(mockProvider.searchNearby).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. Resilience & Truthful Provenance', () => {
    it('malformed single provider feature does not kill batch', () => {
      const valid = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_valid_1',
          providerId: 'geo_valid_1',
          name: 'Cơm Tấm Sài Gòn',
          latitude: 21.03,
          longitude: 105.79,
          category: 'rice',
        }),
        'geoapify'
      );
      expect(valid).not.toBeNull();
      expect(valid!.canonicalVenueId).toBe('vn_geoapify_geo_valid_1');

      // Invalid latitude
      const invalidLat = registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_invalid_lat',
          providerId: 'geo_invalid_lat',
          name: 'Invalid Lat Place',
          latitude: 999,
          longitude: 105.79,
          category: 'rice',
        }),
        'geoapify'
      );
      expect(invalidLat).toBeNull();
    });

    it('provider failure falls back gracefully to cached venues and reports provider error truthfully', async () => {
      // Seed one venue in registry first
      registry.upsertCandidatePOI(
        makeUnifiedPlace({
          id: 'ext_fallback_seed',
          providerId: 'geo_fallback_seed',
          name: 'Quán Phở Bò',
          latitude: 21.0285,
          longitude: 105.7958,
          category: 'noodles',
        }),
        'geoapify'
      );

      (mockProvider.searchNearby as any).mockRejectedValueOnce(new Error('Geoapify 429 Rate Limit Exceeded'));

      const res = await registry.discoverVenues({
        latitude: 21.0285,
        longitude: 105.7958,
        radiusMeters: 2000,
        forceRefresh: true,
      });

      expect(res.provenance.source).toBe('REGISTRY_CACHE');
      expect(res.provenance.warning).toContain('Geoapify 429 Rate Limit Exceeded');
      expect(res.provenance.externalApi).toBe(false);
      expect(res.venues.length).toBeGreaterThan(0);
    });

    it('in production mode (BITEQUEST_DEMO_MODE !== true), provider failure never leaks INITIAL_PLACES or benchmark fixtures', async () => {
      const savedEnv = process.env.BITEQUEST_DEMO_MODE;
      try {
        process.env.BITEQUEST_DEMO_MODE = 'false';
        const prodRegistry = new VenueRegistryService(mockProvider, mockFirestoreDb);

        // Mock provider failure
        (mockProvider.searchNearby as any).mockRejectedValueOnce(new Error('Network Error'));

        // Query when registry is empty
        const res = await prodRegistry.discoverVenues({
          latitude: 21.0285,
          longitude: 105.7958,
          radiusMeters: 2000,
        });

        // Must return empty or only authentic community spots - NEVER demo benchmark places
        expect(res.venues.length).toBe(0);
        expect(res.provenance.source).toBe('BITEQUEST_COMMUNITY');
        expect(res.provenance.isDemoMode).toBe(false);
        // Verify no INITIAL_PLACES benchmark venues exist
        const hasBenchmarkPhở10 = res.venues.some((v) => v.name.includes('Phở 10 Lý Quốc Sư'));
        expect(hasBenchmarkPhở10).toBe(false);
      } finally {
        process.env.BITEQUEST_DEMO_MODE = savedEnv;
      }
    });
  });
});
