import { describe, it, expect } from 'vitest';
import {
  generateBiteOpportunities,
  checkNewToYouEligibility,
  checkScoutWindowEligibility,
  checkFreshVerifiedEligibility,
  matchPassportChallenge,
  computeQuestCompletionScore,
  OPPORTUNITY_CONFIG,
} from '../src/services/exploreEngine';
import { Place, BiteCheckin, User, DistrictPassport } from '../src/types';

const MOCK_USER_LOCATION = { latitude: 21.0285, longitude: 105.7958 };

const MOCK_STARTER_USER: User = {
  id: 'user_newbie',
  name: 'Linh Chi',
  avatarUrl: '',
  activeTitle: 'Người Mới',
  availableTitles: [],
  level: 1,
  xp: 0,
  nextLevelXp: 100,
  stats: { placesDiscovered: 0, passportsCompleted: 0, firstBitesCount: 0 },
  districtProgress: [],
};

const MOCK_VETERAN_USER: User = {
  id: 'user_veteran',
  name: 'Bảo Long',
  avatarUrl: '',
  activeTitle: 'Thực Thần',
  availableTitles: [],
  level: 6,
  xp: 3500,
  nextLevelXp: 5000,
  stats: { placesDiscovered: 12, passportsCompleted: 2, firstBitesCount: 4 },
  districtProgress: [],
};

const createMockPlace = (overrides: Partial<Place> = {}): Place => ({
  id: 'place_pho_cuong',
  name: 'Phở Cuốn Cầu Giấy',
  category: 'street_food',
  categoryLabel: 'Phở cuốn',
  address: '12 Ngõ 116 Vũ Phạm Hàm',
  district: 'Cầu Giấy',
  latitude: 21.029,
  longitude: 105.796,
  priceBand: '40k–65k',
  priceMin: 40000,
  priceMax: 65000,
  rating: 4.8,
  reviewCount: 30,
  imageUrl: '',
  isOpen: true,
  openingHoursText: '07:00 - 22:00',
  isCommunitySpot: false,
  ...overrides,
});

const createMockBite = (overrides: Partial<BiteCheckin> = {}): BiteCheckin => ({
  id: 'bite_1',
  placeId: 'place_other',
  placeName: 'Other Place',
  placeAddress: '123 Đường Láng',
  district: 'Đống Đa',
  userId: MOCK_STARTER_USER.id,
  userName: MOCK_STARTER_USER.name,
  userAvatar: '',
  imageUrl: '',
  caption: '',
  foodCategory: 'street_food',
  createdAt: new Date().toISOString(),
  tasteRating: 'tasty',
  priceRating: 'fair',
  wouldReturn: true,
  isVerified: true,
  reactions: [],
  ...overrides,
});

describe('Behavioral Engine V1: Top 3 Truthful Reasons To Go', () => {
  describe('1. Cold Start & STARTER_QUEST', () => {
    it('activates STARTER_QUEST for 0-bite explorer within practical radius', () => {
      const place = createMockPlace({ id: 'place_nearby' });
      const opps = generateBiteOpportunities({
        userLocation: MOCK_USER_LOCATION,
        places: [place],
        feedBites: [],
        user: MOCK_STARTER_USER,
      });

      expect(opps.length).toBe(1);
      expect(opps[0].type).toBe('STARTER_QUEST');
      expect(opps[0].reasonData?.badgeText).toBe('🎯 Bite đầu tiên');
      expect(opps[0].reasonData?.ctaText).toBe('Bắt đầu Bite');
      expect(opps[0].actionType).toBe('starter');
    });

    it('does not give STARTER_QUEST to users who already have verified bites', () => {
      const place = createMockPlace({ id: 'place_nearby' });
      const verifiedBite = createMockBite({
        placeId: 'place_other',
        userId: MOCK_STARTER_USER.id,
        userName: MOCK_STARTER_USER.name,
      });

      const opps = generateBiteOpportunities({
        userLocation: MOCK_USER_LOCATION,
        places: [place],
        feedBites: [verifiedBite],
        user: MOCK_STARTER_USER,
      });

      expect(opps.length).toBe(1);
      expect(opps[0].type).toBe('NEW_TO_YOU');
      expect(opps[0].type).not.toBe('STARTER_QUEST');
    });
  });

  describe('2. Canonical Identity & NEW_TO_YOU', () => {
    it('correctly suppresses NEW_TO_YOU if user previously verified a bite at this venue', () => {
      const place = createMockPlace({
        id: 'place_geoapify_123',
        providerPlaceId: 'provider_geo_456',
      });

      const biteByProviderId = createMockBite({
        id: 'bite_user_veteran',
        placeId: 'provider_geo_456',
        providerPlaceId: 'provider_geo_456',
        placeName: place.name,
        userId: MOCK_VETERAN_USER.id,
        userName: MOCK_VETERAN_USER.name,
      });

      const isNew = checkNewToYouEligibility(place, [biteByProviderId]);
      expect(isNew).toBe(false);
    });

    it('identifies place as NEW_TO_YOU if user only bitten at other places', () => {
      const place = createMockPlace({ id: 'place_unvisited' });
      const otherBite = createMockBite({
        id: 'bite_other',
        placeId: 'place_somewhere_else',
        placeName: 'Somewhere Else',
        userId: MOCK_VETERAN_USER.id,
        userName: MOCK_VETERAN_USER.name,
      });

      const isNew = checkNewToYouEligibility(place, [otherBite]);
      expect(isNew).toBe(true);
    });
  });

  describe('3. Goal-Gradient & QUEST_MATCH', () => {
    const cauGiayPassport: DistrictPassport = {
      id: 'passport_cau_giay',
      districtName: 'Cầu Giấy',
      subtitle: 'Thám hiểm ẩm thực Cầu Giấy',
      coverImage: '',
      levelTitle: 'Khám phá Tập sự',
      currentLevel: 1,
      xp: 200,
      maxXp: 300,
      challenges: [
        {
          id: 'c1',
          title: 'Quán Ngõ Thơm Lừng',
          icon: '🛵',
          type: 'alley',
          isCompleted: true,
          rewardXp: 50,
        },
        {
          id: 'c2',
          title: 'Phở & Bún Nước',
          icon: '🍜',
          type: 'category',
          category: 'street_food',
          isCompleted: false,
          rewardXp: 100,
        },
      ],
    };

    it('boosts QUEST_MATCH score when 1 challenge remains (goal gradient)', () => {
      const place = createMockPlace({
        category: 'street_food',
        district: 'Cầu Giấy',
      });

      const match = matchPassportChallenge(place, cauGiayPassport);
      expect(match).not.toBeNull();
      expect(match?.remainingChallengesCount).toBe(1);
      expect(computeQuestCompletionScore(match!.remainingChallengesCount)).toBe(25);

      const opps = generateBiteOpportunities({
        userLocation: MOCK_USER_LOCATION,
        places: [place],
        feedBites: [],
        passport: cauGiayPassport,
        user: MOCK_VETERAN_USER,
      });

      expect(opps[0].type).toBe('QUEST_MATCH');
      expect(opps[0].reasonData?.badgeText).toBe('🗺️ Sắp hoàn thành');
      expect(opps[0].reasonData?.title).toContain('Còn 1 Bite để hoàn thành');
    });

    it('does not generate QUEST_MATCH when all challenges in passport are completed', () => {
      const completedPassport: DistrictPassport = {
        ...cauGiayPassport,
        challenges: cauGiayPassport.challenges.map((c) => ({ ...c, isCompleted: true })),
      };

      const place = createMockPlace({
        category: 'street_food',
        district: 'Cầu Giấy',
      });

      const match = matchPassportChallenge(place, completedPassport);
      expect(match).toBeNull();
    });
  });

  describe('4. SCOUT_WINDOW Self-Verification Prevention & Truth Gates', () => {
    it('prevents creator from seeing their own scout spot as SCOUT_WINDOW', () => {
      const creatorSpot: Place = createMockPlace({
        id: 'spot_by_veteran',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: MOCK_VETERAN_USER.id,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      });

      const eligibility = checkScoutWindowEligibility(creatorSpot, MOCK_VETERAN_USER.id);
      expect(eligibility).toBeNull();
    });

    it('allows other users to see scout spot with authentic creator details and recency', () => {
      const creatorSpot: Place = createMockPlace({
        id: 'spot_by_another',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_stranger_456',
        firstDiscovererName: 'Thu Hà',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2h ago
      });

      const eligibility = checkScoutWindowEligibility(creatorSpot, MOCK_VETERAN_USER.id);
      expect(eligibility).not.toBeNull();
      expect(eligibility?.firstDiscovererName).toBe('Thu Hà');
      expect(eligibility?.recency).toBe('2h trước');
    });
  });

  describe('5. FRESH_VERIFIED 72h Truth Window', () => {
    it('qualifies newly verified venue (<72h) and rejects stale verified venue (>72h)', () => {
      const freshSpot: Place = createMockPlace({
        id: 'spot_fresh_10h',
        isCommunitySpot: true,
        communityStatus: 'verified',
        communityVerified: true,
        verifiedAt: new Date(Date.now() - 3600000 * 10).toISOString(), // 10h ago
      });

      const staleSpot: Place = createMockPlace({
        id: 'spot_stale_90h',
        isCommunitySpot: true,
        communityStatus: 'verified',
        communityVerified: true,
        verifiedAt: new Date(Date.now() - 3600000 * 90).toISOString(), // 90h ago
      });

      expect(checkFreshVerifiedEligibility(freshSpot)).not.toBeNull();
      expect(checkFreshVerifiedEligibility(staleSpot)).toBeNull();
    });
  });

  describe('6. Attention Budget & Signal Diversity', () => {
    it('caps primary carousel at strictly 3 opportunities', () => {
      const places = [
        createMockPlace({ id: 'p1', latitude: 21.0286, longitude: 105.7959 }),
        createMockPlace({ id: 'p2', latitude: 21.0287, longitude: 105.7960 }),
        createMockPlace({ id: 'p3', latitude: 21.0288, longitude: 105.7961 }),
        createMockPlace({ id: 'p4', latitude: 21.0289, longitude: 105.7962 }),
        createMockPlace({ id: 'p5', latitude: 21.0290, longitude: 105.7963 }),
      ];

      const opps = generateBiteOpportunities({
        userLocation: MOCK_USER_LOCATION,
        places,
        feedBites: [],
        user: MOCK_VETERAN_USER,
      });

      const carouselItems = opps.slice(0, OPPORTUNITY_CONFIG.attentionBudget.carouselMax);
      expect(carouselItems.length).toBeLessThanOrEqual(3);
    });

    it('deduplicates reasons so each place only appears once with its highest scoring reason', () => {
      const multiSignalPlace = createMockPlace({
        id: 'multi_signal_place',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'other_user',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        category: 'street_food',
      });

      const opps = generateBiteOpportunities({
        userLocation: MOCK_USER_LOCATION,
        places: [multiSignalPlace],
        feedBites: [],
        user: MOCK_VETERAN_USER,
      });

      expect(opps.length).toBe(1);
      expect(opps[0].placeId).toBe('multi_signal_place');
      // SCOUT_WINDOW (weight 45) wins over NEW_TO_YOU (weight 15)
      expect(opps[0].type).toBe('SCOUT_WINDOW');
    });
  });
});
