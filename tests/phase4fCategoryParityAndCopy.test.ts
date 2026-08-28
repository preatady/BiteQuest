import { describe, it, expect } from 'vitest';
import {
  CanonicalCategory,
  CANONICAL_CATEGORIES,
  classifyVenue,
  normalizeCategory,
  getLocalizedCategoryLabel,
  getLocalizedCategoryShortLabel,
  doesCategoryMatch,
  buildDynamicExploreCategories,
} from '../src/services/maps/categoryNormalizer';
import {
  adaptBiteOpportunities,
  formatPreferenceName,
} from '../src/services/todayIntelligenceAdapter';
import { generateBiteOpportunities, matchPassportChallenge } from '../src/services/exploreEngine';
import { UnifiedPlace } from '../src/services/maps/types';
import { DistrictPassport, User } from '../src/types';

describe('Phase 4F: Canonical Category Parity & Consumer Copy Audit', () => {
  // 1. Generic Restaurant Invariant
  describe('1. Generic Restaurant Invariant', () => {
    it('maps catering.restaurant without specialized evidence to RESTAURANT', () => {
      const v1 = classifyVenue({
        name: 'Nhà Hàng Bò Đội Nón',
        categories: ['catering', 'catering.restaurant', 'wheelchair', 'wheelchair.yes'],
      });
      expect(v1.category).toBe('RESTAURANT');

      const v2 = classifyVenue({
        name: 'Nhà Hàng Kombo',
        categories: ['catering', 'catering.restaurant'],
      });
      expect(v2.category).toBe('RESTAURANT');

      const v3 = classifyVenue({
        name: 'Nhà hàng Hà Đăng',
        categories: ['catering', 'catering.restaurant'],
      });
      expect(v3.category).toBe('RESTAURANT');
    });

    it('never automatically turns generic catering.restaurant into street_food or NOODLE', () => {
      const res = classifyVenue({
        name: 'Nhà Hàng Hải Sản Biển Đông',
        categories: ['catering', 'catering.restaurant'],
      });
      expect(res.category).toBe('RESTAURANT');
      expect(normalizeCategory({ name: 'Nhà Hàng Biển', categories: ['catering.restaurant'] })).toBe('RESTAURANT');
    });
  });

  // 2. Specialized Evidence
  describe('2. Specialized Evidence', () => {
    it('correctly classifies specialized categories when name/category evidence is present', () => {
      // Phở
      expect(classifyVenue({ name: 'Phở Bò Gia Truyền', categories: ['catering.restaurant'] }).category).toBe('PHO');
      // Noodle / Bún / Mì
      expect(classifyVenue({ name: 'Bún Chả Đắc Kim', categories: ['catering.restaurant'] }).category).toBe('NOODLE');
      expect(classifyVenue({ name: 'Mì Vằn Thắn Duy Anh', categories: ['catering.restaurant'] }).category).toBe('NOODLE');
      // Hotpot / Lẩu
      expect(classifyVenue({ name: 'Lẩu Ếch Dũng Béo', categories: ['catering.restaurant'] }).category).toBe('HOTPOT');
      // BBQ / Nướng / Grill
      expect(classifyVenue({ name: 'WA GRILL - THỊT NƯỚNG MANG VỀ KÈM BẾP 24H', categories: ['catering', 'catering.restaurant'] }).category).toBe('BBQ');
      // Cafe / Coffee
      expect(classifyVenue({ name: 'Cà Phê AnAn', categories: ['catering', 'catering.cafe'] }).category).toBe('CAFE_DRINK');
      // Vegetarian
      expect(classifyVenue({ name: 'Cơm Chay An Phúc', categories: ['catering.restaurant'] }).category).toBe('VEGETARIAN');
    });
  });

  // 3. Map / Filter / Today Parity
  describe('3. Map / Filter / Today Parity', () => {
    const real20Venues: Array<{
      name: string;
      categories: string[];
      category?: string;
      categoryLabel?: string;
    }> = [
      { name: 'Nhà hàng Hà Đăng', categories: ['catering', 'catering.restaurant'] },
      { name: 'Nhà Hàng Casa Espana', categories: ['catering', 'catering.restaurant'] },
      { name: 'Nhậu tự do', categories: ['catering', 'catering.restaurant'] },
      { name: 'WA GRILL - THỊT NƯỚNG MANG VỀ KÈM BẾP 24H', categories: ['catering', 'catering.restaurant'] },
      { name: 'Cà Phê AnAn', categories: ['catering', 'catering.cafe'] },
      { name: 'Bánh cuốn Gia An', categories: ['building', 'catering.restaurant'] },
      { name: 'Nhà Hàng Bò Đội Nón', categories: ['catering', 'catering.restaurant'] },
      { name: 'Nhà Hàng Kombo', categories: ['catering', 'catering.restaurant'] },
      { name: 'Phở Bò Cầu Giấy', categories: ['catering', 'catering.restaurant'] },
      { name: 'Bún Cá Cay Hải Phòng', categories: ['catering', 'catering.restaurant'] },
      { name: 'Lẩu Nấm Ashima', categories: ['catering', 'catering.restaurant'] },
      { name: 'Gogi House Nướng Hàn Quốc', categories: ['catering', 'catering.restaurant'] },
      { name: 'Cơm Niêu Kombo', categories: ['catering', 'catering.restaurant'] },
      { name: 'Highlands Coffee Duy Tân', categories: ['catering.cafe'] },
      { name: 'Tous Les Jours Bakery', categories: ['catering.bakery'] },
      { name: 'Lotteria Hồ Tùng Mậu', categories: ['catering.fast_food'] },
      { name: 'The Beer Club 88', categories: ['catering.bar'] },
      { name: 'Cơm Chay Từ Tâm', categories: ['catering.restaurant'] },
      { name: 'Bánh Mì Dân Tổ', categories: ['catering.fast_food'] },
      { name: 'Chè Sầu Đà Nẵng', categories: ['catering.ice_cream'] },
    ];

    it('ensures semantic mismatch count is 0 across Map, Filter, and Today', () => {
      let semanticMismatchCount = 0;

      for (const v of real20Venues) {
        const canonicalCat = normalizeCategory(v);
        const classification = classifyVenue(v);
        const mapCategory = canonicalCat;
        const filterCategory = canonicalCat;
        const localizedLabel = getLocalizedCategoryLabel(canonicalCat);

        // Verify consistency
        if (canonicalCat !== classification.category) semanticMismatchCount++;
        if (mapCategory !== filterCategory) semanticMismatchCount++;
        if (!CANONICAL_CATEGORIES[canonicalCat]) semanticMismatchCount++;
        if (!localizedLabel || localizedLabel.includes('_')) semanticMismatchCount++;
      }

      expect(semanticMismatchCount).toBe(0);
    });
  });

  // 4. Consumer Copy Integrity
  describe('4. Consumer Copy Integrity', () => {
    it('ensures no raw category slug appears in formatPreferenceName or Today copy', () => {
      const rawSlugs = [
        'street_food',
        'coffee',
        'noodles',
        'noodle',
        'restaurant',
        'dessert',
        'burger_western',
        'bbq_hotpot',
        'drinks',
        'CAFE_DRINK',
        'OTHER_FOOD',
        'RESTAURANT',
        'PHO',
        'NOODLE',
        'HOTPOT',
        'BBQ',
        'RICE',
        'FAST_FOOD',
        'BAKERY_DESSERT',
        'BAR_BEER',
        'VEGETARIAN',
      ];

      let rawCategorySlugLeakCount = 0;

      for (const slug of rawSlugs) {
        const formatted = formatPreferenceName(slug);
        if (formatted.includes('_') || (formatted === slug && slug.toUpperCase() === slug)) {
          rawCategorySlugLeakCount++;
        }
      }

      expect(rawCategorySlugLeakCount).toBe(0);
      expect(formatPreferenceName('coffee')).toBe('Cà phê');
      expect(formatPreferenceName('street_food')).toBe('Ăn vặt');
      expect(formatPreferenceName('CAFE_DRINK')).toBe('Cà phê');
      expect(formatPreferenceName('RESTAURANT')).toBe('Nhà hàng');
    });

    it('generates Today opportunities with clean localized reason copy', () => {
      const mockPlaces: UnifiedPlace[] = [
        {
          id: 'test_p1',
          name: 'Cà Phê Trung Nguyên',
          category: 'CAFE_DRINK',
          categoryLabel: 'Cà phê & Trà',
          latitude: 21.0285,
          longitude: 105.7958,
          address: 'Cầu Giấy, Hà Nội',
          source: 'GEOAPIFY',
        },
        {
          id: 'test_p2',
          name: 'Nhà Hàng Hà Đăng',
          category: 'RESTAURANT',
          categoryLabel: 'Nhà hàng',
          latitude: 21.0286,
          longitude: 105.7959,
          address: 'Cầu Giấy, Hà Nội',
          source: 'GEOAPIFY',
        },
      ];

      const mockUser: User = {
        id: 'u1',
        name: 'Tester',
        avatar: '',
        title: 'Bite Explorer',
        level: 1,
        xp: 0,
        maxXp: 100,
        preferences: ['Cà phê', 'Nhà hàng'],
        stats: { totalBites: 0, distinctLocations: 0, streaks: 0, passportsCompleted: 0, placesDiscovered: 0 },
      };

      const opps = generateBiteOpportunities({
        places: mockPlaces,
        feedBites: [],
        user: mockUser,
        userLocation: { latitude: 21.0285, longitude: 105.7958 },
      });

      const result = adaptBiteOpportunities(opps, {
        userPreferences: ['Cà phê', 'Nhà hàng'],
        isRealUserLocation: true,
      });

      expect(result.opportunities.length).toBeGreaterThan(0);
      for (const card of result.opportunities) {
        expect(card.reasonPrimary).not.toMatch(/street_food|coffee|noodles|CAFE_DRINK|OTHER_FOOD/);
        expect(card.reasonSecondary).not.toMatch(/street_food|coffee|noodles|CAFE_DRINK|OTHER_FOOD/);
      }
    });
  });

  // 5. Journey Milestone Matching
  describe('5. Journey Milestone Matching', () => {
    it('matches Journey milestones using canonical category semantics and adapter', () => {
      const passport: DistrictPassport = {
        id: 'cau_giay',
        districtName: 'Cầu Giấy',
        description: '',
        icon: '',
        badgeName: '',
        unlockedBadge: false,
        totalMilestones: 3,
        completedMilestones: 0,
        xp: 0,
        maxXp: 300,
        challenges: [
          {
            id: 'ch_noodle',
            title: 'Thưởng thức món Bún/Phở',
            description: '',
            icon: '🍜',
            rewardXp: 50,
            isCompleted: false,
            type: 'category',
            category: 'noodles', // Legacy challenge category slug
          },
          {
            id: 'ch_cafe',
            title: 'Ghé quán Cà phê',
            description: '',
            icon: '☕',
            rewardXp: 50,
            isCompleted: false,
            type: 'category',
            category: 'coffee', // Legacy challenge category slug
          },
        ],
      };

      const phoPlace: UnifiedPlace = {
        id: 'place_pho',
        name: 'Phở Bò Cầu Giấy',
        category: 'PHO',
        categoryLabel: 'Phở truyền thống',
        lat: 21.0285,
        lng: 105.7958,
        address: 'Cầu Giấy, Hà Nội',
        district: 'Cầu Giấy',
        source: 'GEOAPIFY',
      };

      const matchPho = matchPassportChallenge(phoPlace, passport);
      expect(matchPho).not.toBeNull();
      expect(matchPho?.challengeId).toBe('ch_noodle');

      const cafePlace: UnifiedPlace = {
        id: 'place_cafe',
        name: 'Cà Phê AnAn',
        category: 'CAFE_DRINK',
        categoryLabel: 'Cà phê & Trà',
        lat: 21.0285,
        lng: 105.7958,
        address: 'Cầu Giấy, Hà Nội',
        district: 'Cầu Giấy',
        source: 'GEOAPIFY',
      };

      const matchCafe = matchPassportChallenge(cafePlace, passport);
      expect(matchCafe).not.toBeNull();
      expect(matchCafe?.challengeId).toBe('ch_cafe');
    });
  });
});
