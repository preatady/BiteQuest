import { describe, it, expect } from 'vitest';
import {
  adaptBiteOpportunities,
  getTodayOpportunities,
  mapInternalOpportunityToToday,
  FORBIDDEN_CONSUMER_TERMS,
  TodayOpportunity,
  TodayOpportunityType,
  TruthSource,
} from '../src/services/todayIntelligenceAdapter';
import {
  generateBiteOpportunities,
  ExploreEngineParams,
  checkScoutWindowEligibility,
} from '../src/services/exploreEngine';
import { Place, BiteOpportunity, DistrictPassport, User, BiteCheckin } from '../src/types';
import { INITIAL_PLACES, INITIAL_USER } from '../src/data/seedData';

describe('BiteQuest V6 Phase 4: Today Intelligence Adapter Unit & Integration Tests', () => {
  const BASE_USER_LOCATION = { latitude: 21.0285, longitude: 105.7958 }; // Cầu Giấy

  const samplePlace: Place = {
    id: 'place_test_coffee_1',
    name: 'Cà Phê Yên',
    category: 'cafe',
    categoryLabel: 'Quán Cà Phê',
    address: '184 Quán Thánh, Ba Đình',
    district: 'Ba Đình',
    latitude: 21.042,
    longitude: 105.839,
    priceBand: '30k–50k',
    rating: 4.7,
    reviewCount: 120,
    isOpen: true,
  };

  describe('1. Deterministic Vietnamese Consumer Copy Mapping', () => {
    it('PROXIMITY / Ambient signal maps to "Gần bạn" ONLY when isRealUserLocation is true', () => {
      const opp: BiteOpportunity = {
        id: 'opp_prox_1',
        placeId: samplePlace.id,
        type: 'NEW_TO_YOU',
        score: 20,
        distanceMeters: 350,
        reasons: [],
        place: samplePlace,
      };

      // With real user location
      const todayOppReal = mapInternalOpportunityToToday(opp, { isRealUserLocation: true });
      expect(todayOppReal.reasonPrimary).toBe('Bạn chưa từng Bite tại đây');
      expect(todayOppReal.reasonSecondary).toBe('Gần bạn · 350m');
      expect(todayOppReal.truthSources).toContain('REAL_USER_DISCOVERY_LOCATION');
      expect(todayOppReal.truthSources).not.toContain('ACTIVE_DISCOVERY_ANCHOR');

      // With fallback / searched location (isRealUserLocation === false)
      const todayOppFallback = mapInternalOpportunityToToday(opp, { isRealUserLocation: false });
      expect(todayOppFallback.reasonPrimary).toBe('Bạn chưa từng Bite tại đây');
      expect(todayOppFallback.reasonSecondary).toBe('Trong khu vực đang xem · 350m');
      expect(todayOppFallback.reasonSecondary).not.toContain('Gần bạn');
      expect(todayOppFallback.truthSources).toContain('ACTIVE_DISCOVERY_ANCHOR');
      expect(todayOppFallback.truthSources).not.toContain('REAL_USER_DISCOVERY_LOCATION');
    });

    it('PREFERENCE_MATCH maps to "Hợp sở thích <Category>" and includes all truth sources for primary and secondary reasons', () => {
      const opp: BiteOpportunity = {
        id: 'opp_pref_1',
        placeId: samplePlace.id,
        type: 'NEW_TO_YOU',
        score: 35,
        distanceMeters: 450,
        reasons: [],
        place: samplePlace,
      };

      const todayOpp = mapInternalOpportunityToToday(opp, {
        userPreferences: ['Cà phê'],
        isRealUserLocation: true,
      });
      expect(todayOpp).not.toBeNull();
      expect(todayOpp?.type).toBe('PREFERENCE_MATCH');
      expect(todayOpp?.reasonPrimary).toBe('Hợp sở thích Cà phê');
      expect(todayOpp?.reasonSecondary).toBe('Gần bạn · 450m');
      expect(todayOpp?.truthSources).toEqual([
        'USER_EXPLICIT_PREFERENCE',
        'VENUE_CATEGORY',
        'REAL_USER_DISCOVERY_LOCATION',
        'VENUE_COORDINATES',
      ]);
    });

    it('NEW_TO_YOU maps to "Bạn chưa từng Bite tại đây" and includes location and novelty truth sources', () => {
      const opp: BiteOpportunity = {
        id: 'opp_new_1',
        placeId: samplePlace.id,
        type: 'NEW_TO_YOU',
        score: 15,
        distanceMeters: 600,
        reasons: [],
        place: samplePlace,
      };

      const todayOpp = mapInternalOpportunityToToday(opp, { isRealUserLocation: true });
      expect(todayOpp.type).toBe('NEW_TO_YOU');
      expect(todayOpp.reasonPrimary).toBe('Bạn chưa từng Bite tại đây');
      expect(todayOpp.reasonSecondary).toBe('Gần bạn · 600m');
      expect(todayOpp.truthSources).toEqual([
        'USER_VERIFIED_BITE_HISTORY',
        'VENUE_ID',
        'REAL_USER_DISCOVERY_LOCATION',
        'VENUE_COORDINATES',
      ]);
    });

    it('JOURNEY_MATCH maps to "Giúp hoàn thành mốc <Challenge>" and includes journey, category, and location truth sources', () => {
      const opp: BiteOpportunity = {
        id: 'opp_quest_1',
        placeId: samplePlace.id,
        type: 'QUEST_MATCH',
        score: 45,
        distanceMeters: 800,
        challengeTitle: 'Thử thách Cà phê ngõ',
        reasons: [],
        place: samplePlace,
      };

      const todayOpp = mapInternalOpportunityToToday(opp, { isRealUserLocation: true });
      expect(todayOpp.type).toBe('JOURNEY_MATCH');
      expect(todayOpp.reasonPrimary).toBe('Giúp hoàn thành mốc Thử thách Cà phê ngõ');
      expect(todayOpp.cta).toBe('OPEN_JOURNEY');
      expect(todayOpp.truthSources).toEqual([
        'AUTHORITATIVE_JOURNEY_STATE',
        'VENUE_CATEGORY',
        'REAL_USER_DISCOVERY_LOCATION',
        'VENUE_COORDINATES',
      ]);
    });

    it('SCOUT maps to "Chưa có Verified Bite" with complete truth sources', () => {
      const opp: BiteOpportunity = {
        id: 'opp_scout_1',
        placeId: samplePlace.id,
        type: 'SCOUT_WINDOW',
        score: 55,
        distanceMeters: 1200,
        reasons: [],
        place: samplePlace,
      };

      const todayOpp = mapInternalOpportunityToToday(opp, { isRealUserLocation: true });
      expect(todayOpp.type).toBe('SCOUT');
      expect(todayOpp.reasonPrimary).toBe('Chưa có Verified Bite');
      expect(todayOpp.truthSources).toEqual([
        'AUTHORITATIVE_VERIFIED_BITE_COUNT',
        'REAL_USER_DISCOVERY_LOCATION',
        'VENUE_COORDINATES',
      ]);
    });

    it('FRESH_VERIFIED maps to "Vừa có Verified Bite" with recency and timestamp truth sources', () => {
      const opp: BiteOpportunity = {
        id: 'opp_fresh_1',
        placeId: samplePlace.id,
        type: 'FRESH_VERIFIED',
        score: 40,
        distanceMeters: 500,
        verifiedAt: new Date(Date.now() - 30 * 60000).toISOString(),
        reasons: [],
        place: samplePlace,
      };

      const todayOpp = mapInternalOpportunityToToday(opp, { isRealUserLocation: true });
      expect(todayOpp.type).toBe('FRESH_VERIFIED');
      expect(todayOpp.reasonPrimary).toContain('Vừa có Verified Bite');
      expect(todayOpp.truthSources).toEqual([
        'AUTHORITATIVE_LAST_VERIFIED_BITE_AT',
        'REAL_USER_DISCOVERY_LOCATION',
        'VENUE_COORDINATES',
      ]);
    });
  });

  describe('2. Truth Source & Audit Trail Invariants', () => {
    it('Every TodayOpportunity must have non-empty valid truthSources', () => {
      const opps: BiteOpportunity[] = [
        {
          id: 'opp_1',
          placeId: 'p1',
          type: 'QUEST_MATCH',
          score: 50,
          distanceMeters: 300,
          challengeTitle: 'Lẩu ếch',
          reasons: [],
          place: { ...samplePlace, id: 'p1' },
        },
        {
          id: 'opp_2',
          placeId: 'p2',
          type: 'SCOUT_WINDOW',
          score: 45,
          distanceMeters: 500,
          reasons: [],
          place: { ...samplePlace, id: 'p2' },
        },
        {
          id: 'opp_3',
          placeId: 'p3',
          type: 'NEW_TO_YOU',
          score: 30,
          distanceMeters: 700,
          reasons: [],
          place: { ...samplePlace, id: 'p3' },
        },
      ];

      const result = adaptBiteOpportunities(opps);
      expect(result.opportunities.length).toBe(3);

      for (const opp of result.opportunities) {
        expect(opp.truthSources).toBeDefined();
        expect(opp.truthSources.length).toBeGreaterThan(0);
        expect(['PROXIMITY', 'PREFERENCE_MATCH', 'NEW_TO_YOU', 'JOURNEY_MATCH', 'SCOUT', 'FRESH_VERIFIED']).toContain(opp.type);
      }
    });
  });

  describe('3. Forbidden Marketing Copy & Leakage Prevention', () => {
    it('Adapter never outputs banned marketing terms or internal engine jargon', () => {
      const allOpps: BiteOpportunity[] = [
        {
          id: 'opp_1',
          placeId: 'p1',
          type: 'QUEST_MATCH',
          score: 50,
          distanceMeters: 300,
          challengeTitle: 'Phở bò',
          reasons: [],
          place: { ...samplePlace, id: 'p1' },
        },
        {
          id: 'opp_2',
          placeId: 'p2',
          type: 'SCOUT_WINDOW',
          score: 45,
          distanceMeters: 500,
          reasons: [],
          place: { ...samplePlace, id: 'p2' },
        },
        {
          id: 'opp_3',
          placeId: 'p3',
          type: 'STARTER_QUEST',
          score: 35,
          distanceMeters: 400,
          reasons: [],
          place: { ...samplePlace, id: 'p3' },
        },
        {
          id: 'opp_4',
          placeId: 'p4',
          type: 'FRESH_VERIFIED',
          score: 40,
          distanceMeters: 800,
          verifiedAt: new Date().toISOString(),
          reasons: [],
          place: { ...samplePlace, id: 'p4' },
        },
      ];

      const result = adaptBiteOpportunities(allOpps, { userPreferences: ['Cà phê', 'Món Việt'] });

      for (const opp of result.opportunities) {
        const fullCopy = `${opp.title} ${opp.reasonPrimary} ${opp.reasonSecondary || ''}`;

        for (const forbidden of FORBIDDEN_CONSUMER_TERMS) {
          expect(fullCopy.includes(forbidden)).toBe(false);
        }
      }
    });
  });

  describe('4. NEW_TO_YOU Semantics (Personal Bite History Novelty)', () => {
    it('NEW_TO_YOU strictly evaluates that the current user has not recorded a Bite here, NOT venue opening age', () => {
      const userBites: BiteCheckin[] = [
        {
          id: 'bite_1',
          userId: 'user_alice',
          placeId: 'place_bun_ca_co_lan',
          timestamp: new Date().toISOString(),
          isVerified: true,
          photoUrl: 'https://example.com/p.jpg',
          caption: 'Great',
          tasteRating: 'tasty',
          wantsReturn: true,
        },
      ];

      const visitedPlace = INITIAL_PLACES.find((p) => p.id === 'place_bun_ca_co_lan')!;
      const unvisitedPlace = INITIAL_PLACES.find((p) => p.id === 'place_blackbird_coffee')!;

      const paramsVisited: ExploreEngineParams = {
        userLocation: BASE_USER_LOCATION,
        places: [visitedPlace],
        feedBites: userBites,
        user: { ...INITIAL_USER, id: 'user_alice' },
      };

      const paramsUnvisited: ExploreEngineParams = {
        userLocation: BASE_USER_LOCATION,
        places: [unvisitedPlace],
        feedBites: userBites,
        user: { ...INITIAL_USER, id: 'user_alice' },
      };

      const todayUnvisited = getTodayOpportunities(paramsUnvisited);
      expect(todayUnvisited.opportunities.length).toBe(1);
      expect(todayUnvisited.opportunities[0].reasonPrimary).toBe('Bạn chưa từng Bite tại đây');

      const todayVisited = getTodayOpportunities(paramsVisited);
      // For visited place with no other active opportunity signals, it does not claim "Bạn chưa từng Bite tại đây"
      if (todayVisited.opportunities.length > 0) {
        expect(todayVisited.opportunities[0].reasonPrimary).not.toBe('Bạn chưa từng Bite tại đây');
      }
    });
  });

  describe('5. SCOUT Semantics (Scarcity & Eligibility Integrity)', () => {
    it('SCOUT is NOT manufactured purely from zero count if uneligible (respects engine scarcity)', () => {
      // Create a standard verified place with 0 bites
      const nonCommunityPlace: Place = {
        ...samplePlace,
        id: 'place_regular_0_bites',
        isCommunitySpot: false, // Regular venue, not unverified community spot
      };

      const scoutEligibility = checkScoutWindowEligibility(nonCommunityPlace, 'user_alice', false);
      expect(scoutEligibility).toBeNull();

      const opps = generateBiteOpportunities({
        userLocation: BASE_USER_LOCATION,
        places: [nonCommunityPlace],
        feedBites: [],
        user: { ...INITIAL_USER, id: 'user_alice' },
      });

      const todayRes = adaptBiteOpportunities(opps);
      for (const opp of todayRes.opportunities) {
        expect(opp.type).not.toBe('SCOUT');
        expect(opp.reasonPrimary).not.toBe('Chưa có Verified Bite');
      }
    });
  });

  describe('6. JOURNEY Semantics (Authentic Active Passport / Challenge)', () => {
    it('JOURNEY_MATCH only emits when an active incomplete challenge genuinely matches the venue', () => {
      const activePassport: DistrictPassport = {
        id: 'passport_cau_giay',
        districtId: 'cau_giay',
        districtName: 'Cầu Giấy',
        description: 'Khám phá Cầu Giấy',
        badgeIcon: '🥢',
        progress: 1,
        totalMilestones: 3,
        isCompleted: false,
        challenges: [
          {
            id: 'ch_noodle',
            type: 'category',
            category: 'noodles',
            title: 'Món Bún đặc trưng Cầu Giấy',
            description: 'Thưởng thức 1 tô bún',
            rewardXp: 50,
            isCompleted: false,
          },
        ],
      };

      const noodlePlace: Place = {
        id: 'place_bun_ca_co_lan',
        name: 'Bún Cá Cô Lan',
        category: 'noodles',
        categoryLabel: 'Bún cá',
        district: 'Cầu Giấy',
        address: 'Vũ Phạm Hàm, Cầu Giấy',
        latitude: 21.0185,
        longitude: 105.7952,
      };

      const coffeePlace: Place = {
        id: 'place_blackbird_coffee',
        name: 'Blackbird Coffee',
        category: 'cafe',
        categoryLabel: 'Cà phê',
        district: 'Hoàn Kiếm',
        address: 'Chân Cầm',
        latitude: 21.031,
        longitude: 105.848,
      };

      const result = getTodayOpportunities({
        userLocation: BASE_USER_LOCATION,
        places: [noodlePlace, coffeePlace],
        feedBites: [],
        passport: activePassport,
        user: INITIAL_USER,
      });

      const noodleOpp = result.opportunities.find((o) => o.venueId === noodlePlace.id);
      expect(noodleOpp).toBeDefined();
      expect(noodleOpp?.type).toBe('JOURNEY_MATCH');
      expect(noodleOpp?.reasonPrimary).toContain('Món Bún đặc trưng Cầu Giấy');

      const coffeeOpp = result.opportunities.find((o) => o.venueId === coffeePlace.id);
      expect(coffeeOpp).toBeDefined();
      expect(coffeeOpp?.type).not.toBe('JOURNEY_MATCH'); // Coffee does not match noodle challenge
    });
  });

  describe('7. Opportunity Capping & Venue Deduplication', () => {
    it('Emits maximum 3 Today opportunities even when 20 candidate venues exist', () => {
      const dummyPlaces: Place[] = Array.from({ length: 20 }, (_, i) => ({
        id: `place_dummy_${i}`,
        name: `Quán ăn ${i + 1}`,
        category: 'noodles',
        address: `Phố ${i + 1}, Cầu Giấy`,
        district: 'Cầu Giấy',
        latitude: 21.0285 + i * 0.001,
        longitude: 105.7958 + i * 0.001,
      }));

      const result = getTodayOpportunities({
        userLocation: BASE_USER_LOCATION,
        places: dummyPlaces,
        feedBites: [],
        user: INITIAL_USER,
      });

      expect(result.opportunities.length).toBeLessThanOrEqual(3);
      expect(result.metadata.todayOpportunityCount).toBeLessThanOrEqual(3);
      expect(result.metadata.inputOpportunityCount).toBeGreaterThan(3);
    });

    it('Collapses multiple signals for the same venue into 1 top TodayOpportunity', () => {
      const placeA: Place = { ...samplePlace, id: 'place_A', name: 'Quán A' };

      const duplicateOppsForSamePlace: BiteOpportunity[] = [
        {
          id: 'opp_a_1',
          placeId: 'place_A',
          type: 'QUEST_MATCH',
          score: 50,
          distanceMeters: 200,
          challengeTitle: 'Bún cá',
          reasons: [],
          place: placeA,
        },
        {
          id: 'opp_a_2',
          placeId: 'place_A',
          type: 'NEW_TO_YOU',
          score: 20,
          distanceMeters: 200,
          reasons: [],
          place: placeA,
        },
      ];

      const result = adaptBiteOpportunities(duplicateOppsForSamePlace);
      expect(result.opportunities.length).toBe(1);
      expect(result.opportunities[0].venueId).toBe('place_A');
      expect(result.opportunities[0].type).toBe('JOURNEY_MATCH');
    });
  });

  describe('8. Cold Start Resilience', () => {
    it('Successfully produces truthful output for novice user with 0 history, 0 community bites, 0 friends', () => {
      const coldStartUser: User = {
        id: 'user_fresh_newbie',
        name: 'Người dùng mới',
        email: 'newbie@example.com',
        level: 1,
        xp: 0,
        stats: {
          placesDiscovered: 0,
          passportsCompleted: 0,
          firstBitesCount: 0,
        },
        foodPreferences: ['Cà phê', 'Món Việt'],
      };

      const result = getTodayOpportunities({
        userLocation: BASE_USER_LOCATION,
        places: INITIAL_PLACES,
        feedBites: [], // 0 bites
        user: coldStartUser,
      });

      expect(result.opportunities.length).toBeGreaterThan(0);
      expect(result.opportunities.length).toBeLessThanOrEqual(3);

      for (const opp of result.opportunities) {
        expect(['PREFERENCE_MATCH', 'NEW_TO_YOU', 'PROXIMITY']).toContain(opp.type);
        expect(opp.reasonPrimary).toBeTruthy();
        expect(opp.truthSources.length).toBeGreaterThan(0);
      }
    });
  });

  describe('9. Real Runtime Top 3 Inspection', () => {
    it('Produces valid Top 3 from INITIAL_PLACES with full explainability', () => {
      const result = getTodayOpportunities({
        userLocation: BASE_USER_LOCATION,
        places: INITIAL_PLACES,
        feedBites: [],
        user: INITIAL_USER,
      });

      expect(result.opportunities.length).toBe(3);

      result.opportunities.forEach((opp, idx) => {
        expect(opp.title).toBeTruthy();
        expect(opp.venueId).toBeTruthy();
        expect(opp.reasonPrimary).toBeTruthy();
        expect(opp.truthSources.length).toBeGreaterThan(0);
        console.log(`[Top ${idx + 1}] ${opp.title} (${opp.venueId}) | Type: ${opp.type} | Primary: "${opp.reasonPrimary}" | Secondary: "${opp.reasonSecondary}" | Sources: ${opp.truthSources.join(', ')}`);
      });
    });
  });

  describe('10. Phase 4B Location Truth, Provenance & Semantics Hardening', () => {
    it('Fallback discovery anchor never emits "Gần bạn"', () => {
      const result = getTodayOpportunities({
        userLocation: { ...BASE_USER_LOCATION, isRealUserLocation: false },
        places: INITIAL_PLACES,
        feedBites: [],
        user: INITIAL_USER,
      });

      expect(result.metadata.isRealUserLocation).toBe(false);
      for (const opp of result.opportunities) {
        if (opp.reasonSecondary) {
          expect(opp.reasonSecondary).not.toContain('Gần bạn');
          expect(opp.reasonSecondary).toContain('Trong khu vực đang xem');
        }
        if (opp.type === 'PROXIMITY') {
          expect(opp.reasonPrimary).not.toContain('Gần bạn');
          expect(opp.reasonPrimary).toContain('Trong khu vực đang xem');
        }
        expect(opp.truthSources).toContain('ACTIVE_DISCOVERY_ANCHOR');
        expect(opp.truthSources).not.toContain('REAL_USER_DISCOVERY_LOCATION');
      }
    });

    it('Searched map area never emits "Gần bạn"', () => {
      const searchedAreaLocation = { latitude: 21.035, longitude: 105.845, isRealUserLocation: false };
      const result = getTodayOpportunities({
        userLocation: searchedAreaLocation,
        places: INITIAL_PLACES,
        feedBites: [],
        user: INITIAL_USER,
      });

      for (const opp of result.opportunities) {
        const fullText = `${opp.reasonPrimary} ${opp.reasonSecondary || ''}`;
        expect(fullText).not.toContain('Gần bạn');
        expect(opp.truthSources).toContain('ACTIVE_DISCOVERY_ANCHOR');
      }
    });

    it('Real user location may emit "Gần bạn"', () => {
      const result = getTodayOpportunities({
        userLocation: { ...BASE_USER_LOCATION, isRealUserLocation: true },
        places: INITIAL_PLACES,
        feedBites: [],
        user: INITIAL_USER,
      });

      expect(result.metadata.isRealUserLocation).toBe(true);
      for (const opp of result.opportunities) {
        if (opp.reasonSecondary && opp.reasonSecondary.includes('·')) {
          expect(opp.reasonSecondary).toContain('Gần bạn');
          expect(opp.reasonSecondary).not.toContain('Trong khu vực đang xem');
        }
        expect(opp.truthSources).toContain('REAL_USER_DISCOVERY_LOCATION');
        expect(opp.truthSources).not.toContain('ACTIVE_DISCOVERY_ANCHOR');
      }
    });

    it('Secondary reasons contribute truth sources to the union', () => {
      const opp: BiteOpportunity = {
        id: 'opp_sec_test',
        placeId: samplePlace.id,
        type: 'NEW_TO_YOU',
        score: 25,
        distanceMeters: 400,
        reasons: [],
        place: samplePlace,
      };

      const adapted = mapInternalOpportunityToToday(opp, { isRealUserLocation: true });
      // Primary: "Bạn chưa từng Bite tại đây" (USER_VERIFIED_BITE_HISTORY, VENUE_ID)
      // Secondary: "Gần bạn · 400m" (REAL_USER_DISCOVERY_LOCATION, VENUE_COORDINATES)
      expect(adapted.truthSources).toContain('USER_VERIFIED_BITE_HISTORY');
      expect(adapted.truthSources).toContain('VENUE_ID');
      expect(adapted.truthSources).toContain('REAL_USER_DISCOVERY_LOCATION');
      expect(adapted.truthSources).toContain('VENUE_COORDINATES');
      expect(adapted.truthSources.length).toBe(4);
    });

    it('Scout requires engine Scout opportunity and does not invent scout out of thin air', () => {
      const regularPlace: Place = {
        ...samplePlace,
        id: 'place_regular_not_scout',
        isCommunitySpot: false,
        communityVerified: false,
      };

      const opps = generateBiteOpportunities({
        userLocation: { ...BASE_USER_LOCATION, isRealUserLocation: true },
        places: [regularPlace],
        feedBites: [],
        user: INITIAL_USER,
      });

      const todayRes = adaptBiteOpportunities(opps);
      const scoutOpps = todayRes.opportunities.filter((o) => o.type === 'SCOUT');
      expect(scoutOpps.length).toBe(0);
    });

    it('Fresh Verified obeys freshness window and rejects timestamps older than 72 hours', () => {
      const now = Date.now();
      const freshTimestamp = new Date(now - 2 * 3600 * 1000).toISOString(); // 2h ago
      const expiredTimestamp = new Date(now - 80 * 3600 * 1000).toISOString(); // 80h ago

      const freshPlace: Place = {
        ...samplePlace,
        id: 'place_fresh_comm',
        isCommunitySpot: true,
        communityVerified: true,
        communityStatus: 'verified',
        verifiedAt: freshTimestamp,
      };

      const expiredPlace: Place = {
        ...samplePlace,
        id: 'place_expired_comm',
        isCommunitySpot: true,
        communityVerified: true,
        communityStatus: 'verified',
        verifiedAt: expiredTimestamp,
      };

      const opps = generateBiteOpportunities({
        userLocation: { ...BASE_USER_LOCATION, isRealUserLocation: true },
        places: [freshPlace, expiredPlace],
        feedBites: [],
        user: INITIAL_USER,
        isDemo: true,
      });

      const adapted = adaptBiteOpportunities(opps);
      const freshOpp = adapted.opportunities.find((o) => o.venueId === 'place_fresh_comm');
      const expiredOpp = adapted.opportunities.find((o) => o.venueId === 'place_expired_comm');

      expect(freshOpp).toBeDefined();
      expect(freshOpp?.type).toBe('FRESH_VERIFIED');
      expect(freshOpp?.reasonPrimary).toContain('Vừa có Verified Bite');

      if (expiredOpp) {
        expect(expiredOpp.type).not.toBe('FRESH_VERIFIED');
      }
    });

    it('STARTER_QUEST causal independence: dropped unless independently verified by consumer signal', () => {
      const starterOpp: BiteOpportunity = {
        id: 'opp_starter_test',
        placeId: samplePlace.id,
        type: 'STARTER_QUEST',
        score: 30,
        distanceMeters: 250,
        reasons: [],
        place: samplePlace,
      };

      // 1. STARTER_QUEST without independent proof is dropped (returns null)
      const dropped = mapInternalOpportunityToToday(starterOpp, { isRealUserLocation: true });
      expect(dropped).toBeNull();

      // 2. STARTER_QUEST with independent preference match emits PREFERENCE_MATCH
      const prefAdapted = mapInternalOpportunityToToday(starterOpp, {
        userPreferences: ['Cà phê'],
        isRealUserLocation: true,
      });
      expect(prefAdapted).not.toBeNull();
      expect(prefAdapted?.type).toBe('PREFERENCE_MATCH');
      expect(prefAdapted?.reasonPrimary).toBe('Hợp sở thích Cà phê');
      expect(prefAdapted?.truthSources).toContain('USER_EXPLICIT_PREFERENCE');

      // 3. STARTER_QUEST with independent verified bite history proving unvisited emits NEW_TO_YOU
      const noveltyAdapted = mapInternalOpportunityToToday(starterOpp, {
        visitedPlaceIds: new Set(['other_place_id']),
        isRealUserLocation: true,
      });
      expect(noveltyAdapted).not.toBeNull();
      expect(noveltyAdapted?.type).toBe('NEW_TO_YOU');
      expect(noveltyAdapted?.reasonPrimary).toBe('Bạn chưa từng Bite tại đây');
      expect(noveltyAdapted?.truthSources).toContain('USER_VERIFIED_BITE_HISTORY');
    });

    it('Production-like sample excludes demo fixtures (0 demo fixtures in production output)', () => {
      const result = getTodayOpportunities({
        userLocation: { ...BASE_USER_LOCATION, isRealUserLocation: true },
        places: INITIAL_PLACES,
        feedBites: [],
        user: INITIAL_USER,
        isDemo: false,
      });

      const demoFixtures = result.opportunities.filter((o) => o.venueId.includes('demo'));
      expect(demoFixtures.length).toBe(0);
    });

    it('Today and Explore Map consume the same canonical venue dataset', () => {
      const canonicalVenues: Place[] = [
        {
          id: 'vn_canonical_live_1',
          name: 'Live Quán Phở 1',
          category: 'noodles',
          categoryLabel: 'Phở',
          address: '10 Cầu Giấy',
          district: 'Cầu Giấy',
          latitude: 21.0286,
          longitude: 105.7959,
          priceBand: '₫₫',
          priceMin: 35000,
          priceMax: 60000,
          rating: 4.6,
          reviewCount: 15,
          imageUrl: '',
          isOpen: true,
          openingHoursText: '06:00 - 22:00',
        },
        {
          id: 'vn_canonical_live_2',
          name: 'Live Quán Cà Phê 2',
          category: 'coffee',
          categoryLabel: 'Cà phê',
          address: '20 Cầu Giấy',
          district: 'Cầu Giấy',
          latitude: 21.0287,
          longitude: 105.7960,
          priceBand: '₫₫',
          priceMin: 25000,
          priceMax: 45000,
          rating: 4.8,
          reviewCount: 30,
          imageUrl: '',
          isOpen: true,
          openingHoursText: '07:00 - 23:00',
        },
      ];

      const result = getTodayOpportunities({
        userLocation: { latitude: 21.0285, longitude: 105.7958, isRealUserLocation: true },
        places: canonicalVenues,
        feedBites: [],
        user: { ...INITIAL_USER, foodPreferences: ['Phở'] },
        isDemo: false,
      });

      expect(result.opportunities.length).toBeGreaterThan(0);
      expect(result.opportunities.some((o) => o.venueId === 'vn_canonical_live_1')).toBe(true);
      expect(result.opportunities.find((o) => o.venueId === 'vn_canonical_live_1')?.type).toBe('PREFERENCE_MATCH');
    });

    it('Area B search replaces Area A venues without retaining stale Area A items', () => {
      const areaAVenues: Place[] = [
        {
          id: 'area_a_venue_1',
          name: 'Area A Quán Ăn',
          category: 'rice',
          categoryLabel: 'Cơm',
          address: 'Cầu Giấy',
          district: 'Cầu Giấy',
          latitude: 21.0285,
          longitude: 105.7958,
          priceBand: '₫₫',
          priceMin: 30000,
          priceMax: 50000,
          rating: 4.5,
          reviewCount: 10,
          imageUrl: '',
          isOpen: true,
          openingHoursText: '08:00 - 21:00',
        },
      ];

      const areaBVenues: Place[] = [
        {
          id: 'area_b_venue_1',
          name: 'Area B Quán Ăn',
          category: 'rice',
          categoryLabel: 'Cơm',
          address: 'Hoàn Kiếm',
          district: 'Hoàn Kiếm',
          latitude: 21.0150,
          longitude: 105.8500,
          priceBand: '₫₫',
          priceMin: 40000,
          priceMax: 70000,
          rating: 4.7,
          reviewCount: 25,
          imageUrl: '',
          isOpen: true,
          openingHoursText: '08:00 - 22:00',
        },
      ];

      const resultA = getTodayOpportunities({
        userLocation: { latitude: 21.0285, longitude: 105.7958, isRealUserLocation: false },
        places: areaAVenues,
        feedBites: [],
        user: INITIAL_USER,
      });
      expect(resultA.opportunities.map((o) => o.venueId)).toContain('area_a_venue_1');

      const resultB = getTodayOpportunities({
        userLocation: { latitude: 21.0150, longitude: 105.8500, isRealUserLocation: false },
        places: areaBVenues,
        feedBites: [],
        user: INITIAL_USER,
      });
      expect(resultB.opportunities.map((o) => o.venueId)).toContain('area_b_venue_1');
      expect(resultB.opportunities.map((o) => o.venueId)).not.toContain('area_a_venue_1');
    });

    it('Max 3 upper bound remains strictly enforced', () => {
      const result = getTodayOpportunities({
        userLocation: { ...BASE_USER_LOCATION, isRealUserLocation: true },
        places: INITIAL_PLACES,
        feedBites: [],
        user: INITIAL_USER,
      });

      expect(result.opportunities.length).toBeLessThanOrEqual(3);
    });
  });
});
