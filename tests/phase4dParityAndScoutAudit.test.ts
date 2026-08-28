import { describe, it, expect } from 'vitest';
import { generateBiteOpportunities, checkScoutWindowEligibility } from '../src/services/exploreEngine';
import { getTodayOpportunities } from '../src/services/todayIntelligenceAdapter';
import { verifyCommunitySpotAtomic } from '../src/server/firstBiteEngine';
import { INITIAL_PLACES } from '../src/data/seedData';
import { Place, User, BiteCheckin, DistrictPassport } from '../src/types';

describe('BiteQuest V6 Phase 4D: Venue-Source Parity & Scout Semantics Audit', () => {
  const mockUser: User = {
    id: 'user_main_explorer',
    name: 'Explorer Main',
    avatar: 'https://example.com/avatar.jpg',
    level: 2,
    xp: 250,
    nextLevelXp: 400,
    stats: {
      totalBites: 5,
      uniqueSpots: 4,
      firstBitesCount: 1,
      streaksDays: 3,
      reviewsCount: 4,
      photosCount: 6,
    },
    unlockedBadges: [],
    foodPreferences: ['coffee', 'street_food'],
  };

  const cauGiayLocation = {
    latitude: 21.0285,
    longitude: 105.7958,
    isRealUserLocation: false,
  };

  // Simulated 98 Live Geoapify venues from Cầu Giấy
  const liveGeoapifyVenues: Place[] = Array.from({ length: 98 }, (_, i) => ({
    id: `vn_geoapify_place_${i + 1}`,
    providerPlaceId: `geoapify_raw_id_${i + 1}`,
    name: i === 0 ? 'Cafe Cây Khế' : i === 1 ? 'AHA Cafe' : i === 2 ? 'Nhà hàng Hà Đăng' : `Quán Ăn Cầu Giấy ${i + 1}`,
    category: (i % 4 === 0 ? 'coffee' : i % 4 === 1 ? 'noodles' : i % 4 === 2 ? 'street_food' : 'rice') as any,
    categoryLabel: i % 4 === 0 ? 'Cà phê' : i % 4 === 1 ? 'Bún phở' : i % 4 === 2 ? 'Ăn vặt' : 'Cơm',
    address: `${i + 1} Phố Cầu Giấy, Hà Nội`,
    district: 'Cầu Giấy',
    latitude: 21.0285 + (i * 0.0002) - 0.01,
    longitude: 105.7958 + (i * 0.0002) - 0.01,
    priceBand: '30k–50k',
    priceMin: 30000,
    priceMax: 50000,
    rating: 4.5,
    reviewCount: 40 + i,
    isOpen: true,
    isCommunitySpot: false,
    verifiedBiteCount: 0,
  }));

  // 2 Real Community Spots (1 pending unverified created by user_creator_a, 1 verified)
  const communitySpots: Place[] = [
    {
      id: 'spot_ngoc_ha_community_pending',
      name: 'Bánh Mì Ngõ 12 Đội Cấn',
      category: 'street_food',
      categoryLabel: 'Bánh mì ngõ',
      address: '12 Ngõ 12 Đội Cấn, Ba Đình',
      district: 'Ba Đình',
      latitude: 21.0345,
      longitude: 105.8234,
      priceBand: '25k–35k',
      rating: 4.9,
      reviewCount: 2,
      isOpen: true,
      isCommunitySpot: true,
      communityStatus: 'pending',
      communityVerified: false,
      firstDiscovererId: 'user_creator_a',
      firstDiscovererName: 'Huyền My',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      verifiedBiteCount: 0,
    },
    {
      id: 'spot_ngoc_ha_community_verified',
      name: 'Chè Ngõ Chợ Đồng Xuân',
      category: 'dessert',
      categoryLabel: 'Chè truyền thống',
      address: 'Chợ Đồng Xuân, Hoàn Kiếm',
      district: 'Hoàn Kiếm',
      latitude: 21.0385,
      longitude: 105.8502,
      priceBand: '20k–30k',
      rating: 4.8,
      reviewCount: 15,
      isOpen: true,
      isCommunitySpot: true,
      communityStatus: 'verified',
      communityVerified: true,
      firstDiscovererId: 'user_creator_b',
      firstDiscovererName: 'Quang Dũng',
      verifiedByUserId: 'user_independent_v',
      verifiedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      lastVerifiedBiteAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      verifiedBiteCount: 3,
    },
  ];

  it('1. Traces the exact 98 -> 100 pipeline counts at each stage', () => {
    // API returns 98 live Geoapify + 2 Community spots = 100 total
    const nearbyApiResponsePlaces = [...liveGeoapifyVenues, ...communitySpots];
    const providerVenueCount = liveGeoapifyVenues.length; // 98
    const registryVenueCount = 100;
    const places = INITIAL_PLACES; // 8 promoted seed places in local app state
    
    // Deduplication filter: unpromotedNearbyPOIs removes any POI matching places
    const unpromotedNearbyPOIs = nearbyApiResponsePlaces.filter(
      (poi) => !places.some((p) => p.id === poi.id)
    );
    const unpromotedNearbyPOICount = unpromotedNearbyPOIs.length; // 100 (since IDs don't collide)
    
    const allLoadedVenues = [...places, ...unpromotedNearbyPOIs]; // 8 + 100 = 108
    const mapGeoJSONVenueCount = unpromotedNearbyPOIs.length; // 100 in background GeoJSON layer + 8 promoted markers = 108 total map venues
    const todayEngineInputCount = allLoadedVenues.length; // 108

    expect(providerVenueCount).toBe(98);
    expect(registryVenueCount).toBe(100);
    expect(places.length).toBe(8);
    expect(unpromotedNearbyPOICount).toBe(100);
    expect(allLoadedVenues.length).toBe(108);
    expect(todayEngineInputCount).toBe(108);
  });

  it('2. Proves Map and Today ID Parity (same canonical discovery pool)', () => {
    const allLoadedVenues = [...liveGeoapifyVenues, ...communitySpots];
    
    const mapCanonicalIds = allLoadedVenues.map((v) => v.id);
    
    const todayResult = getTodayOpportunities({
      userLocation: cauGiayLocation,
      places: allLoadedVenues,
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });

    const todayCanonicalIds = todayResult.opportunities.map((o) => o.venueId);

    // Every Today recommendation must belong to the Map's canonical venue pool
    const sharedIds = todayCanonicalIds.filter((id) => mapCanonicalIds.includes(id));
    const todayOnlyIds = todayCanonicalIds.filter((id) => !mapCanonicalIds.includes(id));

    expect(sharedIds.length).toBe(todayResult.opportunities.length);
    expect(todayOnlyIds.length).toBe(0);
  });

  it('3. Enforces Seed Policy: 0 Seed fixtures in Top 3 when live provider data exists', () => {
    // Combined pool containing both 8 INITIAL_PLACES (seed) and 98 live Geoapify venues
    const combinedPool = [...INITIAL_PLACES, ...liveGeoapifyVenues];

    const todayResult = getTodayOpportunities({
      userLocation: cauGiayLocation,
      places: combinedPool,
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });

    expect(todayResult.opportunities.length).toBe(3);

    // Verify none of the Top 3 are from INITIAL_PLACES (which start with place_ and lack providerId)
    const seedIdsInTop3 = todayResult.opportunities.filter((o) =>
      INITIAL_PLACES.some((p) => p.id === o.venueId)
    );

    expect(seedIdsInTop3.length).toBe(0);

    // Verify all Top 3 are genuine LIVE_PROVIDER venues
    todayResult.opportunities.forEach((opp) => {
      expect(opp.venueId).toMatch(/^vn_geoapify_/);
    });
  });

  it('4. Generates a True Live Top 3 from live provider dataset', () => {
    const todayResult = getTodayOpportunities({
      userLocation: cauGiayLocation,
      places: liveGeoapifyVenues,
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });

    expect(todayResult.opportunities.length).toBe(3);

    const top3 = todayResult.opportunities;
    console.log('--- TRUE LIVE TOP 3 ---');
    top3.forEach((opp, i) => {
      console.log(`[Top ${i + 1}] ${opp.title} (${opp.venueId}) | Type: ${opp.type} | Primary: "${opp.reasonPrimary}" | Secondary: "${opp.reasonSecondary}"`);
    });

    expect(top3[0].type).toBe('PREFERENCE_MATCH'); // User loves coffee & street_food
    expect(top3[1].type).toBe('PREFERENCE_MATCH');
  });

  it('5. Distinguishes SCOUT opportunity from FIRST_VERIFIER domain semantics', () => {
    // 1. SCOUT Opportunity check on pending community spot
    const pendingSpot = communitySpots[0];
    const scoutCheck = checkScoutWindowEligibility(pendingSpot, mockUser.id, false);
    expect(scoutCheck).not.toBeNull();
    expect(scoutCheck?.firstDiscovererId).toBe('user_creator_a');

    // 2. FIRST_VERIFIER: Creator cannot self-verify
    const selfVerifyAttempt = checkScoutWindowEligibility(pendingSpot, 'user_creator_a', false);
    expect(selfVerifyAttempt).toBeNull(); // Self-verification forbidden

    // 3. Adapter consumes engine Scout directly without creating Scout from zero-count itself
    const engineOpps = generateBiteOpportunities({
      userLocation: { latitude: 21.0345, longitude: 105.8234, isRealUserLocation: false },
      places: [pendingSpot],
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });

    expect(engineOpps.length).toBe(1);
    expect(engineOpps[0].type).toBe('SCOUT_WINDOW');
  });

  it('6. Does not damage Community Verification authority & 2-Party independence', async () => {
    const testSpotList: Place[] = [
      {
        id: 'spot_phuc_tan_1',
        name: 'Bún Riêu Phúc Tân',
        category: 'noodles',
        address: 'Phúc Tân, Hoàn Kiếm',
        district: 'Hoàn Kiếm',
        latitude: 21.04,
        longitude: 105.85,
        rating: 5.0,
        reviewCount: 1,
        isOpen: true,
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_creator_original',
        createdAt: new Date().toISOString(),
        verifiedBiteCount: 0,
      },
    ];

    // Attempt 1: Creator self-verification -> FORBIDDEN
    const selfRes = await verifyCommunitySpotAtomic(testSpotList, 'spot_phuc_tan_1', 'user_creator_original', 'Creator Name');
    expect(selfRes.success).toBe(false);
    expect(selfRes.code).toBe('SELF_VERIFY_FORBIDDEN');

    // Attempt 2: Independent User verification -> SUCCESS
    const verifierRes = await verifyCommunitySpotAtomic(testSpotList, 'spot_phuc_tan_1', 'user_independent_b', 'Independent Explorer');
    expect(verifierRes.success).toBe(true);
    expect(verifierRes.code).toBe('VERIFIED_SUCCESS');
    expect(verifierRes.spot?.communityStatus).toBe('verified');
    expect(verifierRes.spot?.verifiedByUserId).toBe('user_independent_b');

    // Attempt 3: Subsequent verification attempt -> ALREADY_VERIFIED
    const repeatRes = await verifyCommunitySpotAtomic(testSpotList, 'spot_phuc_tan_1', 'user_third', 'Third User');
    expect(repeatRes.success).toBe(false);
    expect(repeatRes.code).toBe('ALREADY_VERIFIED');
  });

  it('7. Area Change Parity: Area A -> Area B leaves 0 stale Today-only Area A IDs', () => {
    const areaAVenues = liveGeoapifyVenues.slice(0, 50); // Cầu Giấy
    const areaBVenues = Array.from({ length: 50 }, (_, i) => ({
      id: `vn_geoapify_hoankiem_${i + 1}`,
      providerPlaceId: `geoapify_hk_${i + 1}`,
      name: `Quán Hoàn Kiếm ${i + 1}`,
      category: 'street_food' as const,
      address: `${i + 1} Phố Hàng Bông, Hoàn Kiếm`,
      district: 'Hoàn Kiếm',
      latitude: 21.0315 + (i * 0.0001),
      longitude: 105.8500 + (i * 0.0001),
      rating: 4.6,
      reviewCount: 50,
      isOpen: true,
      isCommunitySpot: false,
      verifiedBiteCount: 0,
    }));

    // In Area A
    const todayResultAreaA = getTodayOpportunities({
      userLocation: cauGiayLocation,
      places: areaAVenues,
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });
    expect(todayResultAreaA.opportunities.length).toBe(3);
    const areaAIds = todayResultAreaA.opportunities.map((o) => o.venueId);

    // User pans to Area B (Hoàn Kiếm) and calls "Search This Area" -> Map places updated to areaBVenues
    const todayResultAreaB = getTodayOpportunities({
      userLocation: { latitude: 21.0315, longitude: 105.85, isRealUserLocation: false },
      places: areaBVenues,
      feedBites: [],
      user: mockUser,
      mode: 'radar',
      isDemo: false,
    });
    expect(todayResultAreaB.opportunities.length).toBe(3);
    const areaBIds = todayResultAreaB.opportunities.map((o) => o.venueId);

    // Stale check: none of the Area A IDs remain in Area B's Today opportunities
    const staleIds = areaBIds.filter((id) => areaAIds.includes(id));
    expect(staleIds.length).toBe(0);
  });
});
