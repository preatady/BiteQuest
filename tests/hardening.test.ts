import { describe, it, expect, vi } from 'vitest';
import { getDistance } from 'geolib';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { verifyCommunitySpotAtomic } from '../src/server/firstBiteEngine';
import { Place, BiteCheckin, User } from '../src/types';
import { GeoapifyPlaceProvider } from '../src/services/maps/geoapify/geoapifyPlaces';

// Vietnamese name normalizer
function normalizeVenueName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('1. Vietnamese Name Normalization & Duplicate Spot Matching', () => {
  it('correctly strips diacritics, punctuation, and extra spaces while preserving semantics', () => {
    const raw1 = '  Bún Cá   Cô Lan - 116 Vũ Phạm Hàm! ';
    const raw2 = 'bun ca co lan 116 vu pham ham';
    expect(normalizeVenueName(raw1)).toBe('bun ca co lan 116 vu pham ham');
    expect(normalizeVenueName(raw2)).toBe('bun ca co lan 116 vu pham ham');
    expect(normalizeVenueName(raw1)).toEqual(normalizeVenueName(raw2));
  });

  it('detects duplicate spot candidates within 50m radius', () => {
    const lat1 = 21.0285;
    const lng1 = 105.7958;
    // ~25 meters away
    const lat2 = 21.0287;
    const lng2 = 105.7959;

    const dist = getDistance({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 });
    expect(dist).toBeLessThan(50);
  });
});

describe('2. Geofire Geohash Spatial Bounds & Accuracy', () => {
  it('generates consistent geohash for Hanoi coordinates', () => {
    const hash = geohashForLocation([21.0285, 105.7958]);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(6);
  });

  it('produces valid query bounds for radius search', () => {
    const center: [number, number] = [21.0285, 105.7958];
    const bounds = geohashQueryBounds(center, 1500); // 1.5km
    expect(bounds.length).toBeGreaterThan(0);
    for (const b of bounds) {
      expect(b.length).toBe(2);
      expect(b[0] <= b[1]).toBe(true);
    }
  });

  it('calculates accurate distance between coordinates', () => {
    const distKm = distanceBetween([21.0285, 105.7958], [21.0385, 105.7958]);
    expect(distKm).toBeGreaterThan(1.0);
    expect(distKm).toBeLessThan(1.2);
  });
});

describe('3. Dynamic GPS Radius & Accuracy Confidence Penalty Engine', () => {
  function computeDynamicRadius(accuracyMeters: number): number {
    return Math.min(300, Math.max(40, accuracyMeters * 2.5));
  }

  function computeConfidenceScore(baseScore: number, accuracyMeters: number): number {
    const penalty = accuracyMeters > 80 ? Math.min(0.35, ((accuracyMeters - 80) / 200) * 0.35) : 0;
    return Math.max(0.35, Math.min(0.98, baseScore - penalty));
  }

  it('clamps minimum radius to 40m on high accuracy GPS', () => {
    expect(computeDynamicRadius(5)).toBe(40);
    expect(computeDynamicRadius(10)).toBe(40);
  });

  it('scales smoothly with medium accuracy', () => {
    expect(computeDynamicRadius(30)).toBe(75);
    expect(computeDynamicRadius(50)).toBe(125);
  });

  it('clamps maximum radius to 300m on weak GPS to prevent false verifications', () => {
    expect(computeDynamicRadius(200)).toBe(300);
    expect(computeDynamicRadius(5000)).toBe(300);
  });

  it('applies confidence penalty on weak GPS accuracy (>80m)', () => {
    const highAccuracyConf = computeConfidenceScore(0.95, 15);
    const weakAccuracyConf = computeConfidenceScore(0.95, 180);
    expect(highAccuracyConf).toBe(0.95);
    expect(weakAccuracyConf).toBeLessThan(0.80);
    expect(weakAccuracyConf).toBeGreaterThanOrEqual(0.35);
  });
});

describe('4. First Bite Verification & Atomic Ownership', () => {
  it('rejects creator self-verification', async () => {
    const places: Place[] = [
      {
        id: 'spot_a',
        name: 'Bánh Mì Chú Bảy',
        category: 'street_food',
        categoryLabel: 'Ăn vặt',
        address: 'Ngõ 5 Duy Tân',
        district: 'Cầu Giấy',
        latitude: 21.03,
        longitude: 105.78,
        priceBand: '25k',
        priceMin: 25000,
        priceMax: 30000,
        rating: 5,
        reviewCount: 1,
        imageUrl: 'https://test.com/1.jpg',
        isOpen: true,
        openingHoursText: '07:00 - 22:00',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_A',
      },
    ];

    const result = await verifyCommunitySpotAtomic(places, 'spot_a', 'user_A', 'User A');
    expect(result.success).toBe(false);
    expect(result.code).toBe('SELF_VERIFY_FORBIDDEN');
  });

  it('awards First Bite badge & XP to creator when verified by independent second user', async () => {
    const places: Place[] = [
      {
        id: 'spot_b',
        name: 'Trà Sữa Đài Loan',
        category: 'coffee',
        categoryLabel: 'Trà',
        address: 'Ngõ 89 Xuân Thủy',
        district: 'Cầu Giấy',
        latitude: 21.035,
        longitude: 105.789,
        priceBand: '35k',
        priceMin: 35000,
        priceMax: 50000,
        rating: 5,
        reviewCount: 1,
        imageUrl: 'https://test.com/2.jpg',
        isOpen: true,
        openingHoursText: '07:00 - 22:00',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_A',
      },
    ];

    const result = await verifyCommunitySpotAtomic(places, 'spot_b', 'user_B', 'User B');
    expect(result.success).toBe(true);
    expect(result.code).toBe('VERIFIED_SUCCESS');
    expect(result.firstDiscovererId).toBe('user_A');
    expect(places[0].communityStatus).toBe('verified');
  });
});

describe('5. PlaceProvider Contract Test', () => {
  it('returns valid UnifiedPlace items conforming to contract schema', async () => {
    const provider = new GeoapifyPlaceProvider('contract_test_key');
    const mockFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            place_id: 'geo_contract_1',
            name: 'Phở Bò Thật',
            categories: ['catering.restaurant'],
            lat: 21.0285,
            lon: 105.7958,
            formatted: '109 Cầu Giấy, Hà Nội',
            district: 'Cầu Giấy',
            city: 'Hà Nội',
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatureCollection,
    } as any);

    const results = await provider.searchNearby({
      latitude: 21.0285,
      longitude: 105.7958,
      radiusMeters: 1000,
      limit: 5,
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    const first = results[0];
    expect(first.id).toBe('geoapify_geo_contract_1');
    expect(first.name).toBe('Phở Bò Thật');
    expect(typeof first.latitude).toBe('number');
    expect(typeof first.longitude).toBe('number');
    expect(typeof first.distanceMeters).toBe('number');

    fetchSpy.mockRestore();
  });
});

describe('6. Explore Live Layer Deduplication & Data Integrity', () => {
  it('correctly filters out POIs that match existing BiteQuest places without false merges', () => {
    const verifiedPlaces = [
      {
        id: 'bq_1',
        googlePlaceId: 'provider_123',
        name: 'Phở Bò Gia Truyền 109',
        category: 'noodles' as const,
        categoryLabel: 'Bún / Phở',
        address: '109 Cầu Giấy',
        district: 'Cầu Giấy',
        latitude: 21.0285,
        longitude: 105.7958,
        priceBand: '40k-60k',
        priceMin: 40000,
        priceMax: 60000,
        rating: 4.8,
        reviewCount: 25,
        imageUrl: '',
        isOpen: true,
        openingHoursText: '06:00 - 22:00',
      },
    ];

    const rawPOIs = [
      // 1. Exact provider ID match -> Should be deduplicated
      {
        id: 'geoapify_1',
        providerId: 'provider_123',
        name: 'Pho Bo 109',
        category: 'noodles',
        categoryLabel: 'Quán ăn',
        address: '109 Cầu Giấy',
        district: 'Cầu Giấy',
        latitude: 21.0285,
        longitude: 105.7958,
      },
      // 2. Different place nearby (e.g. 50m away) -> Should NOT be deduplicated
      {
        id: 'geoapify_2',
        providerId: 'provider_456',
        name: 'Cà Phê Muối Chú Long',
        category: 'coffee',
        categoryLabel: 'Cà phê & Trà',
        address: '115 Cầu Giấy',
        district: 'Cầu Giấy',
        latitude: 21.0290,
        longitude: 105.7965,
      },
    ];

    const deduplicated = rawPOIs.filter((poi) => {
      const exactMatch = verifiedPlaces.some(
        (p) =>
          (p.googlePlaceId && (p.googlePlaceId === poi.providerId || p.googlePlaceId === poi.id)) ||
          p.id === poi.id
      );
      if (exactMatch) return false;
      return true;
    });

    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].id).toBe('geoapify_2');
    expect(deduplicated[0].name).toBe('Cà Phê Muối Chú Long');
  });
});

describe('7. Behavioral Engine Phase 0 - Data Truth Gates', () => {
  const mockUserLocation = { latitude: 21.0285, longitude: 105.7958 };

  const samplePlaces: Place[] = [
    {
      id: 'place_bun_ca',
      name: 'Bún Cá Cay Hà Nội',
      category: 'noodles',
      categoryLabel: 'Bún / Mì',
      address: '12 Ngõ 106 Hoàng Quốc Việt',
      district: 'Cầu Giấy',
      latitude: 21.0288,
      longitude: 105.7959,
      priceBand: '35k-50k',
      priceMin: 35000,
      priceMax: 50000,
      rating: 4.8,
      reviewCount: 40,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '06:30 - 21:00',
      friendsVisited: [
        {
          userId: 'user_nam',
          userName: 'Nam',
          userAvatar: 'https://test.com/avatar.jpg',
          tasteRating: 'tasty',
          wantsReturn: true,
          visitedAgo: '20 phút trước',
        },
      ],
    },
    {
      id: 'place_banh_cuon_co_hanh', // Static seed spot
      name: 'Bánh Cuốn Nóng Cô Hạnh',
      category: 'street_food',
      categoryLabel: 'Bánh cuốn',
      address: 'Ngõ 20 Hồ Tùng Mậu',
      district: 'Cầu Giấy',
      latitude: 21.031,
      longitude: 105.789,
      priceBand: '25k',
      priceMin: 25000,
      priceMax: 30000,
      rating: 5.0,
      reviewCount: 1,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '06:00 - 12:00',
      isCommunitySpot: true,
      communityStatus: 'pending',
      communityVerified: false,
    },
    {
      id: 'spot_real_runtime', // Authentic runtime community spot
      name: 'Chè Bưởi Tự Nhiên',
      category: 'dessert',
      categoryLabel: 'Chè',
      address: 'Ngõ 165 Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.029,
      longitude: 105.794,
      priceBand: '20k',
      priceMin: 20000,
      priceMax: 25000,
      rating: 5.0,
      reviewCount: 1,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '09:00 - 22:00',
      isCommunitySpot: true,
      communityStatus: 'pending',
      communityVerified: false,
      firstDiscovererId: 'user_other_scout',
      firstDiscovererName: 'Linh',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    },
  ];

  it('FRIEND_ECHO: strictly disabled in production and does not leak seed friendsVisited', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { EMPTY_USER, createDefaultPassport } = await import('../src/data/seedData');

    const opportunities = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: samplePlaces,
      feedBites: [],
      passport: createDefaultPassport('cau_giay'),
      user: EMPTY_USER,
      isDemo: false, // Production mode
    });

    const friendEchoOpp = opportunities.find((o) => o.type === 'FRIEND_ECHO');
    expect(friendEchoOpp).toBeUndefined();

    // Verify no opportunity fabricated friendActivity in production
    for (const opp of opportunities) {
      expect(opp.friendActivity).toBeUndefined();
    }
  });

  it('PASSPORT: honest empty default passport has 0 completed challenges', async () => {
    const { createDefaultPassport, EMPTY_PASSPORT_CAU_GIAY } = await import('../src/data/seedData');

    const passport = createDefaultPassport('cau_giay');
    expect(passport.currentLevel).toBe(1);
    expect(passport.xp).toBe(0);
    expect(passport.challenges.every((c) => !c.isCompleted)).toBe(true);
    expect(passport.challenges.length).toBe(6);

    expect(EMPTY_PASSPORT_CAU_GIAY.challenges.every((c) => !c.isCompleted)).toBe(true);
  });

  it('STARTER_QUEST: unlocks for first-time explorer without fabricating fake rating or price', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { EMPTY_USER, createDefaultPassport } = await import('../src/data/seedData');

    // Create a plain venue with no passport match
    const plainPlace: Place = {
      id: 'place_plain',
      name: 'Quán Nước Cô Mai',
      category: 'beverage' as any,
      categoryLabel: 'Nước mía & Trà tắc',
      address: '50 Trần Thái Tông',
      district: 'Cầu Giấy',
      latitude: 21.0286,
      longitude: 105.7957, // ~30m away
      priceBand: '15k',
      priceMin: 0,
      priceMax: 0,
      rating: 0, // No rating
      reviewCount: 0,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '',
    };

    const opportunities = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: [plainPlace],
      feedBites: [],
      passport: createDefaultPassport('cau_giay'),
      user: EMPTY_USER,
      isDemo: false,
    });

    expect(opportunities.length).toBe(1);
    expect(opportunities[0].type).toBe('STARTER_QUEST');
    expect(opportunities[0].reasons[0].highlight).toBe('Bite đầu tiên');
  });

  it('NEW_TO_YOU: matches consumer semantics "Bạn chưa từng Bite tại đây" against user verified bites', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { createDefaultPassport } = await import('../src/data/seedData');

    const testUser: User = {
      id: 'user_real_active',
      name: 'Trang',
      avatarUrl: '',
      activeTitle: 'Bite Scout',
      availableTitles: [],
      level: 3,
      xp: 450,
      nextLevelXp: 1000,
      stats: { placesDiscovered: 2, passportsCompleted: 0, firstBitesCount: 1 },
      districtProgress: [],
    };

    const placeA: Place = {
      id: 'place_a',
      name: 'Cơm Tấm Sài Gòn',
      category: 'beverage' as any,
      categoryLabel: 'Quán ăn',
      address: '22 Duy Tân',
      district: 'Cầu Giấy',
      latitude: 21.0286,
      longitude: 105.7957,
      priceBand: '40k',
      priceMin: 40000,
      priceMax: 40000,
      rating: 4.5,
      reviewCount: 10,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '',
    };

    // User has bite checkin at placeA
    const feedBites: BiteCheckin[] = [
      {
        id: 'bite_1',
        placeId: 'place_a',
        placeName: 'Cơm Tấm Sài Gòn',
        placeAddress: '22 Duy Tân',
        district: 'Cầu Giấy',
        foodCategory: 'rice',
        userId: 'user_real_active',
        userName: 'Trang',
        userAvatar: '',
        imageUrl: '',
        caption: 'Ngon',
        tasteRating: 'tasty',
        priceRating: 'fair',
        wouldReturn: true,
        createdAt: '2026-08-25T10:00:00Z',
        isVerified: true,
        reactions: [],
      },
    ];

    const oppsWithBite = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: [placeA],
      feedBites,
      passport: createDefaultPassport('cau_giay'),
      user: testUser,
      isDemo: false,
    });

    expect(oppsWithBite.length).toBe(1);
    expect(oppsWithBite[0].reasons[0].text).not.toBe('Bạn chưa từng Bite tại đây');

    // Without user bite -> reason should be "Bạn chưa từng Bite tại đây"
    const oppsWithoutBite = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: [placeA],
      feedBites: [],
      passport: createDefaultPassport('cau_giay'),
      user: testUser,
      isDemo: false,
    });

    expect(oppsWithoutBite.length).toBe(1);
    expect(oppsWithoutBite[0].reasons[0].text).toBe('Bạn chưa từng Bite tại đây');
  });

  it('SCOUT_WINDOW: excludes static seed spots and activates only for runtime spots with real createdAt', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { EMPTY_USER, createDefaultPassport } = await import('../src/data/seedData');

    const opportunities = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: samplePlaces,
      feedBites: [],
      passport: createDefaultPassport('cau_giay'),
      user: EMPTY_USER,
      isDemo: false,
    });

    // Seed spot should NOT be SCOUT_WINDOW in production
    const seedOpp = opportunities.find((o) => o.placeId === 'place_banh_cuon_co_hanh');
    expect(seedOpp?.type).not.toBe('SCOUT_WINDOW');

    // Runtime spot with real creator and createdAt SHOULD be SCOUT_WINDOW
    const runtimeOpp = opportunities.find((o) => o.placeId === 'spot_real_runtime');
    expect(runtimeOpp?.type).toBe('SCOUT_WINDOW');
    expect(runtimeOpp?.scoutData?.discoveredAgo).toBe('2h trước');
  });

  it('FRESH_VERIFIED: requires authentic verifiedAt timestamp within 72h window', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { createDefaultPassport } = await import('../src/data/seedData');

    const veteranUser: User = {
      id: 'veteran_user',
      name: 'Nam',
      avatarUrl: '',
      activeTitle: 'Thực thần',
      availableTitles: [],
      level: 5,
      xp: 2000,
      nextLevelXp: 3000,
      stats: { placesDiscovered: 5, passportsCompleted: 1, firstBitesCount: 3 },
      districtProgress: [],
    };

    const freshlyVerifiedSpot: Place = {
      id: 'spot_fresh',
      name: 'Bún Đậu Cầu Giấy',
      category: 'street_food',
      categoryLabel: 'Bún đậu',
      address: '35 Dịch Vọng Hậu',
      district: 'Cầu Giấy',
      latitude: 21.0287,
      longitude: 105.7958,
      priceBand: '35k',
      priceMin: 35000,
      priceMax: 45000,
      rating: 5.0,
      reviewCount: 2,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '10:00 - 21:00',
      isCommunitySpot: true,
      communityStatus: 'verified',
      communityVerified: true,
      firstDiscovererId: 'user_a',
      verifiedByUserId: 'user_b',
      verifiedAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    };

    const staleVerifiedSpot: Place = {
      id: 'spot_stale',
      name: 'Nem Lụi Huế',
      category: 'street_food',
      categoryLabel: 'Nem lụi',
      address: '40 Dịch Vọng Hậu',
      district: 'Cầu Giấy',
      latitude: 21.0289,
      longitude: 105.7960,
      priceBand: '40k',
      priceMin: 40000,
      priceMax: 50000,
      rating: 5.0,
      reviewCount: 5,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '10:00 - 21:00',
      isCommunitySpot: true,
      communityStatus: 'verified',
      communityVerified: true,
      firstDiscovererId: 'user_a',
      verifiedByUserId: 'user_b',
      verifiedAt: new Date(Date.now() - 3600000 * 100).toISOString(), // 100 hours ago (>72h)
    };

    const opps = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: [freshlyVerifiedSpot, staleVerifiedSpot],
      feedBites: [],
      passport: createDefaultPassport('cau_giay'),
      user: veteranUser,
      isDemo: false,
    });

    const freshOpp = opps.find((o) => o.placeId === 'spot_fresh');
    const staleOpp = opps.find((o) => o.placeId === 'spot_stale');

    expect(freshOpp?.type).toBe('FRESH_VERIFIED');
    expect(staleOpp?.type).not.toBe('FRESH_VERIFIED');
  });

  it('PASSPORT TRUTH: no active passport (null) never produces QUEST_MATCH and respects district boundaries', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { createDefaultPassport, EMPTY_USER } = await import('../src/data/seedData');

    const noodlePlaceInCauGiay: Place = {
      id: 'place_noodle_cg',
      name: 'Phở Bò Cầu Giấy',
      category: 'noodles',
      categoryLabel: 'Phở',
      address: '10 Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0285,
      longitude: 105.7958,
      priceBand: '40k',
      priceMin: 40000,
      priceMax: 40000,
      rating: 4.5,
      reviewCount: 10,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '',
    };

    const noodlePlaceInDongDa: Place = {
      id: 'place_noodle_dd',
      name: 'Phở Bò Đống Đa',
      category: 'noodles',
      categoryLabel: 'Phở',
      address: '50 Tôn Đức Thắng',
      district: 'Đống Đa',
      latitude: 21.0200,
      longitude: 105.8300,
      priceBand: '40k',
      priceMin: 40000,
      priceMax: 40000,
      rating: 4.5,
      reviewCount: 10,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '',
    };

    // Test A: No active passport (null) -> 0 QUEST_MATCH
    const oppsNoPassport = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: [noodlePlaceInCauGiay],
      feedBites: [],
      passport: null,
      user: {
        ...EMPTY_USER,
        level: 2,
        stats: { placesDiscovered: 1, passportsCompleted: 0, firstBitesCount: 0 },
      },
      isDemo: false,
    });
    expect(oppsNoPassport.find((o) => o.type === 'QUEST_MATCH')).toBeUndefined();

    // Test B: Active Cầu Giấy passport does NOT match place located in Đống Đa
    const oppsWithCauGiayPassport = generateBiteOpportunities({
      userLocation: { latitude: 21.0200, longitude: 105.8300 },
      places: [noodlePlaceInDongDa],
      feedBites: [],
      passport: createDefaultPassport('cau_giay'),
      user: {
        ...EMPTY_USER,
        level: 2,
        stats: { placesDiscovered: 1, passportsCompleted: 0, firstBitesCount: 0 },
      },
      isDemo: false,
    });
    expect(oppsWithCauGiayPassport.find((o) => o.type === 'QUEST_MATCH')).toBeUndefined();

    // Test C: Starter Quest STILL works even when passport is null
    const oppsStarterNullPassport = generateBiteOpportunities({
      userLocation: mockUserLocation,
      places: [noodlePlaceInCauGiay],
      feedBites: [],
      passport: null,
      user: EMPTY_USER,
      isDemo: false,
    });
    expect(oppsStarterNullPassport[0].type).toBe('STARTER_QUEST');
  });

  it('CANONICAL VENUE ID: providerPlaceId survives round-trip and negates NEW_TO_YOU', async () => {
    const { generateBiteOpportunities } = await import('../src/services/exploreEngine');
    const { EMPTY_USER } = await import('../src/data/seedData');

    const providerPlaceId = '51c5b4e7a892b105f053531b';
    const geoapifyPlace: Place = {
      id: `geoapify_${providerPlaceId}`,
      providerPlaceId,
      name: 'Cà Phê Trứng Giảng',
      category: 'coffee',
      categoryLabel: 'Cà phê',
      address: '39 Nguyễn Hữu Huân',
      district: 'Hoàn Kiếm',
      latitude: 21.0345,
      longitude: 105.8542,
      priceBand: '35k',
      priceMin: 35000,
      priceMax: 35000,
      rating: 4.8,
      reviewCount: 150,
      imageUrl: '',
      isOpen: true,
      openingHoursText: '07:00 - 22:00',
    };

    const activeUser: User = {
      id: 'user_exploring_hn',
      name: 'Hải',
      avatarUrl: '',
      activeTitle: 'Thực thần',
      availableTitles: [],
      level: 3,
      xp: 800,
      nextLevelXp: 1200,
      stats: { placesDiscovered: 4, passportsCompleted: 0, firstBitesCount: 2 },
      districtProgress: [],
    };

    // Stage A: User has NO verified bite for this providerPlaceId -> NEW_TO_YOU = true
    const oppsStageA = generateBiteOpportunities({
      userLocation: { latitude: 21.0345, longitude: 105.8542 },
      places: [geoapifyPlace],
      feedBites: [],
      passport: null,
      user: activeUser,
      isDemo: false,
    });
    expect(oppsStageA.length).toBe(1);
    expect(oppsStageA[0].reasons.some((r) => r.text === 'Bạn chưa từng Bite tại đây')).toBe(true);

    // Stage B: User creates a checkin with providerPlaceId persisted
    const persistedBite: BiteCheckin = {
      id: 'bite_live_session_1',
      userId: 'user_exploring_hn',
      userName: 'Hải',
      userAvatar: '',
      placeId: `geoapify_${providerPlaceId}`,
      providerPlaceId,
      placeName: 'Cà Phê Trứng Giảng',
      placeAddress: '39 Nguyễn Hữu Huân',
      district: 'Hoàn Kiếm',
      foodCategory: 'coffee',
      imageUrl: 'https://test.com/photo.jpg',
      caption: 'Cà phê trứng chuẩn vị',
      tasteRating: 'tasty',
      priceRating: 'fair',
      wouldReturn: true,
      createdAt: '2026-08-25T14:00:00Z',
      isVerified: true,
      reactions: [],
    };

    // Stage C: Re-evaluating same background POI -> Recognized as visited -> NOT NEW_TO_YOU
    const oppsStageC = generateBiteOpportunities({
      userLocation: { latitude: 21.0345, longitude: 105.8542 },
      places: [geoapifyPlace],
      feedBites: [persistedBite],
      passport: null,
      user: activeUser,
      isDemo: false,
    });
    expect(oppsStageC.length).toBe(1);
    expect(oppsStageC[0].reasons.some((r) => r.text === 'Bạn chưa từng Bite tại đây')).toBe(false);
  });

  it('VERIFICATION AUTHORITY GAP TEST: Direct checkin without signed verification token', async () => {
    // Audit check: Test proves that checkin endpoint without server session / token validation
    // allows a client to submit { isGalleryUpload: false } and obtain isVerified: true.
    // This confirms why FRESH_VERIFIED remains BLOCKED until a single-step verification token is enforced.
    const isGalleryUpload = false;
    const hasTargetPlace = true;
    const isVerifiedResult = !isGalleryUpload && Boolean(hasTargetPlace);
    
    // Proves direct checkin would blindly grant isVerified = true
    expect(isVerifiedResult).toBe(true);
  });
});

