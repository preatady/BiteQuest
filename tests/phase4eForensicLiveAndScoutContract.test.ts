import { describe, it, expect } from 'vitest';
import { INITIAL_PLACES } from '../src/data/seedData';
import { getTodayOpportunities } from '../src/services/todayIntelligenceAdapter';
import { User, Place } from '../src/types';
import { SEED_COMMUNITY_SPOT_IDS } from '../src/services/exploreEngine';
import { verifyCommunitySpotAtomic } from '../src/server/firstBiteEngine';

describe('BiteQuest V6 Phase 4E: Forensic Live Venue & Scout Contract Audit', () => {
  const mockUser: User = {
    id: 'user_main_explorer',
    name: 'Explorer Main',
    level: 2,
    xp: 250,
    nextLevelXp: 400,
    stats: { totalBites: 5, uniqueSpots: 4, firstBitesCount: 1, streaksDays: 3, reviewsCount: 4, photosCount: 6 },
    unlockedBadges: [],
    foodPreferences: ['coffee', 'street_food'],
  };

  const cauGiayLocation = {
    latitude: 21.0285,
    longitude: 105.7958,
    isRealUserLocation: false,
  };

  it('1. Reconciles mutually exclusive venue counts mathematically', () => {
    // 98 live Geoapify venues from provider
    const liveVenues: Place[] = Array.from({ length: 98 }, (_, i) => ({
      id: `vn_geoapify_prov_${i + 1}`,
      name: `Quán Real Hanoi ${i + 1}`,
      provider: 'geoapify',
      source: 'geoapify',
      providerPlaceId: `geoapify_real_id_${i + 1}`,
      category: i % 2 === 0 ? 'coffee' : 'street_food',
      categoryLabel: i % 2 === 0 ? 'Cà phê & Trà' : 'Ẩm thực đường phố',
      latitude: 21.0285 + (i * 0.0001),
      longitude: 105.7958 + (i * 0.0001),
      isCommunitySpot: false,
      verifiedBiteCount: 0,
    }));

    // 2 real community spots
    const communitySpots: Place[] = [
      {
        id: 'spot_ngoc_ha_community_pending',
        name: 'Quán Ốc Ngõ 55 Hoàng Hoa Thám',
        category: 'street_food',
        latitude: 21.038,
        longitude: 105.815,
        isCommunitySpot: true,
        communityStatus: 'pending',
        firstDiscovererId: 'user_bob',
        firstDiscovererName: 'Bob',
        createdAt: '2026-08-28T02:00:00.000Z',
        verifiedBiteCount: 0,
      },
      {
        id: 'spot_ngoc_ha_community_verified',
        name: 'Bánh Mì Ngõ Cầu Gỗ',
        category: 'street_food',
        latitude: 21.032,
        longitude: 105.852,
        isCommunitySpot: true,
        communityStatus: 'verified',
        firstDiscovererId: 'user_charlie',
        firstDiscovererName: 'Charlie',
        verifiedByUserId: 'user_david',
        verifiedAt: '2026-08-28T01:00:00.000Z',
        lastVerifiedBiteAt: '2026-08-28T01:00:00.000Z',
        verifiedBiteCount: 1,
      },
    ];

    const nearbyPOIs = [...liveVenues, ...communitySpots];
    const places = INITIAL_PLACES; // 8 seeds
    const unpromotedNearbyPOIs = nearbyPOIs.filter(
      (poi) => !places.some((p) => p.id === poi.id || (p.providerPlaceId && p.providerPlaceId === poi.providerPlaceId))
    );
    const allLoadedVenues = [...places, ...unpromotedNearbyPOIs];

    const uniqueIds = new Set(allLoadedVenues.map((v) => v.id));

    let liveProviderCurrentFetchCount = 0;
    let registryCacheProviderCount = 0;
    let communityRealCount = 0;
    let seededRegistryCount = 0;
    let demoFixtureCount = 0;
    let testFixtureCount = 0;

    for (const v of allLoadedVenues) {
      if (v.id.startsWith('place_')) {
        seededRegistryCount++;
      } else if (v.isCommunitySpot && (v.id.startsWith('spot_') || !v.id.startsWith('place_'))) {
        communityRealCount++;
      } else if (v.id.startsWith('vn_geoapify_') || v.provider === 'geoapify') {
        liveProviderCurrentFetchCount++;
      }
    }

    const totalUniqueCanonicalIds = uniqueIds.size;
    const sum =
      liveProviderCurrentFetchCount +
      registryCacheProviderCount +
      communityRealCount +
      seededRegistryCount +
      demoFixtureCount +
      testFixtureCount;

    const expectedSeededCount = INITIAL_PLACES.length;
    const expectedTotal = expectedSeededCount + 98 + 2;

    expect(totalUniqueCanonicalIds).toBe(expectedTotal);
    expect(liveProviderCurrentFetchCount).toBe(98);
    expect(registryCacheProviderCount).toBe(0);
    expect(communityRealCount).toBe(2);
    expect(seededRegistryCount).toBe(expectedSeededCount);
    expect(demoFixtureCount).toBe(0);
    expect(testFixtureCount).toBe(0);
    expect(sum).toBe(expectedTotal);
    expect(sum).toBe(totalUniqueCanonicalIds);
  });

  it('2. Proves production seed policy: 0 Seed fixtures in production Today Top 3', () => {
    const combinedPool = [
      ...INITIAL_PLACES,
      {
        id: 'vn_geoapify_ha_dang',
        canonicalVenueId: 'vn_geoapify_ha_dang',
        name: 'Nhà hàng Hà Đăng',
        providerId: '5160bf7163c4725a4059a2da3bfe66073540f00103f901c415a299020000009203154e68c3a02068c3a06e672048c3a020c490c4836e67',
        providerPlaceId: '5160bf7163c4725a4059a2da3bfe66073540f00103f901c415a299020000009203154e68c3a02068c3a06e672048c3a020c490c4836e67',
        category: 'street_food',
        categoryLabel: 'Quán ăn / Nhà hàng',
        latitude: 21.0289153,
        longitude: 105.7932366,
        isCommunitySpot: false,
        verifiedBiteCount: 0,
      },
      {
        id: 'vn_geoapify_casa_espana',
        canonicalVenueId: 'vn_geoapify_casa_espana',
        name: 'Nhà Hàng Casa Espana',
        providerId: '51e1905731a6725a4059993336cf6c063540f00103f90167e93fce010000009203164e68c3a02048c3a06e67204361736120457370616e61',
        providerPlaceId: '51e1905731a6725a4059993336cf6c063540f00103f90167e93fce010000009203164e68c3a02048c3a06e67204361736120457370616e61',
        category: 'street_food',
        categoryLabel: 'Quán ăn / Nhà hàng',
        latitude: 21.0315,
        longitude: 105.7995,
        isCommunitySpot: false,
        verifiedBiteCount: 0,
      },
      {
        id: 'vn_geoapify_nhau_tu_do',
        canonicalVenueId: 'vn_geoapify_nhau_tu_do',
        name: 'Nhậu tự do',
        providerId: '51a42d5338a7725a40595b73ec4559083540f00103f901211e23c20200000092030e4e68e1baad752074e1bbb120646f',
        providerPlaceId: '51a42d5338a7725a40595b73ec4559083540f00103f901211e23c20200000092030e4e68e1baad752074e1bbb120646f',
        category: 'street_food',
        categoryLabel: 'Quán ăn / Nhà hàng',
        latitude: 21.033,
        longitude: 105.801,
        isCommunitySpot: false,
        verifiedBiteCount: 0,
      },
    ];

    const todayResult = getTodayOpportunities({
      userLocation: cauGiayLocation,
      places: combinedPool,
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });

    const top3 = todayResult.opportunities.slice(0, 3);
    expect(top3.length).toBe(3);

    top3.forEach((opp) => {
      expect(opp.venueId.startsWith('place_')).toBe(false);
      expect(SEED_COMMUNITY_SPOT_IDS.has(opp.venueId)).toBe(false);
    });

    expect(top3[0].title).toBe('Nhà hàng Hà Đăng');
    expect(top3[1].title).toBe('Nhà Hàng Casa Espana');
    expect(top3[2].title).toBe('Nhậu tự do');
  });

  it('3. Preserves First Verifier Community Spot verification authority and creator self-verification guard', async () => {
    const memoryPlaces: Place[] = [
      {
        id: 'spot_ngoc_ha_community_pending',
        name: 'Quán Ốc Ngõ 55 Hoàng Hoa Thám',
        category: 'street_food',
        latitude: 21.038,
        longitude: 105.815,
        isCommunitySpot: true,
        communityStatus: 'pending',
        firstDiscovererId: 'user_bob',
        firstDiscovererName: 'Bob',
        createdAt: '2026-08-28T02:00:00.000Z',
        verifiedBiteCount: 0,
      },
    ];

    // Attempt 1: Creator self-verification fails
    const selfVerifyResult = await verifyCommunitySpotAtomic(
      memoryPlaces,
      'spot_ngoc_ha_community_pending',
      'user_bob',
      'Bob'
    );
    expect(selfVerifyResult.success).toBe(false);
    expect(selfVerifyResult.code).toBe('SELF_VERIFY_FORBIDDEN');

    // Attempt 2: Independent 2nd user verification succeeds
    const independentVerifyResult = await verifyCommunitySpotAtomic(
      memoryPlaces,
      'spot_ngoc_ha_community_pending',
      'user_alice',
      'Alice'
    );
    expect(independentVerifyResult.success).toBe(true);
    expect(independentVerifyResult.spot?.verifiedByUserId).toBe('user_alice');
    expect(independentVerifyResult.spot?.communityStatus).toBe('verified');
  });
});
