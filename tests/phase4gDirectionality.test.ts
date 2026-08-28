import { describe, it, expect } from 'vitest';
import {
  CanonicalCategory,
  CANONICAL_CATEGORIES,
  classifyVenue,
  normalizeCategory,
  doesCategoryMatch,
  getLocalizedCategoryLabel,
  getLocalizedCategoryShortLabel,
} from '../src/services/maps/categoryNormalizer';
import { formatPreferenceName } from '../src/services/todayIntelligenceAdapter';

describe('Phase 4G: Journey Category Directionality Final Check', () => {
  describe('1. Canonical Specific Challenges Directionality', () => {
    it('enforces strict specific matching for canonical challenge categories', () => {
      // PHO vs PHO / NOODLE
      expect(doesCategoryMatch('PHO', 'PHO')).toBe(true);
      expect(doesCategoryMatch('NOODLE', 'PHO')).toBe(false);

      // NOODLE vs NOODLE / PHO
      expect(doesCategoryMatch('NOODLE', 'NOODLE')).toBe(true);
      expect(doesCategoryMatch('PHO', 'NOODLE')).toBe(false);

      // BBQ vs BBQ / HOTPOT
      expect(doesCategoryMatch('BBQ', 'BBQ')).toBe(true);
      expect(doesCategoryMatch('HOTPOT', 'BBQ')).toBe(false);

      // HOTPOT vs HOTPOT / BBQ
      expect(doesCategoryMatch('HOTPOT', 'HOTPOT')).toBe(true);
      expect(doesCategoryMatch('BBQ', 'HOTPOT')).toBe(false);

      // Other canonical specifics
      expect(doesCategoryMatch('CAFE_DRINK', 'CAFE_DRINK')).toBe(true);
      expect(doesCategoryMatch('FAST_FOOD', 'CAFE_DRINK')).toBe(false);
      expect(doesCategoryMatch('BAKERY_DESSERT', 'BAKERY_DESSERT')).toBe(true);
      expect(doesCategoryMatch('RICE', 'RICE')).toBe(true);
      expect(doesCategoryMatch('RESTAURANT', 'RESTAURANT')).toBe(true);
      expect(doesCategoryMatch('VEGETARIAN', 'VEGETARIAN')).toBe(true);
      expect(doesCategoryMatch('BAR_BEER', 'BAR_BEER')).toBe(true);
      expect(doesCategoryMatch('OTHER_FOOD', 'OTHER_FOOD')).toBe(true);
    });
  });

  describe('2. Legacy Broad Category Downward Compatibility', () => {
    it('correctly maps legacy broad challenges downward to specific canonical venue categories', () => {
      // Legacy "noodles" maps downward to both PHO and NOODLE
      expect(doesCategoryMatch('PHO', 'noodles')).toBe(true);
      expect(doesCategoryMatch('NOODLE', 'noodles')).toBe(true);
      expect(doesCategoryMatch('BBQ', 'noodles')).toBe(false);

      // Legacy "bbq_hotpot" maps downward to both BBQ and HOTPOT
      expect(doesCategoryMatch('BBQ', 'bbq_hotpot')).toBe(true);
      expect(doesCategoryMatch('HOTPOT', 'bbq_hotpot')).toBe(true);
      expect(doesCategoryMatch('PHO', 'bbq_hotpot')).toBe(false);

      // Legacy "coffee" / "cafe"
      expect(doesCategoryMatch('CAFE_DRINK', 'coffee')).toBe(true);
      expect(doesCategoryMatch('CAFE_DRINK', 'cafe')).toBe(true);
      expect(doesCategoryMatch('RESTAURANT', 'coffee')).toBe(false);

      // Legacy "dessert" / "bakery"
      expect(doesCategoryMatch('BAKERY_DESSERT', 'dessert')).toBe(true);
      expect(doesCategoryMatch('BAKERY_DESSERT', 'bakery')).toBe(true);

      // Legacy "rice" / "com"
      expect(doesCategoryMatch('RICE', 'rice')).toBe(true);
      expect(doesCategoryMatch('RICE', 'com')).toBe(true);

      // Legacy "street_food"
      expect(doesCategoryMatch('OTHER_FOOD', 'street_food')).toBe(true);
      expect(doesCategoryMatch('RESTAURANT', 'street_food')).toBe(false);
    });
  });

  describe('3. Filter Count Snapshot on Cầu Giấy Live Dataset', () => {
    const cauGiayLive20Venues: Array<{
      name: string;
      categories: string[];
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

    it('computes exact counts across all canonical categories with complete coherency', () => {
      const counts: Record<CanonicalCategory, number> = {
        CAFE_DRINK: 0,
        PHO: 0,
        NOODLE: 0,
        HOTPOT: 0,
        BBQ: 0,
        RICE: 0,
        FAST_FOOD: 0,
        BAKERY_DESSERT: 0,
        BAR_BEER: 0,
        VEGETARIAN: 0,
        RESTAURANT: 0,
        OTHER_FOOD: 0,
      };

      for (const v of cauGiayLive20Venues) {
        const cat = normalizeCategory(v);
        counts[cat]++;
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(cauGiayLive20Venues.length);
      expect(total).toBe(20);

      // Print out classifications for clarity
      const classified = cauGiayLive20Venues.map(v => ({ name: v.name, category: normalizeCategory(v) }));

      // Exact counts
      expect(counts.RESTAURANT).toBe(6); // Hà Đăng, Casa Espana, Nhậu tự do, Bò Đội Nón, Kombo, Bánh cuốn Gia An
      expect(counts.CAFE_DRINK).toBe(2); // Cà Phê AnAn, Highlands Coffee Duy Tân
      expect(counts.PHO).toBe(1); // Phở Bò Cầu Giấy
      expect(counts.NOODLE).toBe(1); // Bún Cá Cay Hải Phòng
      expect(counts.HOTPOT).toBe(1); // Lẩu Nấm Ashima
      expect(counts.BBQ).toBe(2); // WA GRILL, Gogi House Nướng Hàn Quốc
      expect(counts.RICE).toBe(1); // Cơm Niêu Kombo
      expect(counts.FAST_FOOD).toBe(2); // Lotteria Hồ Tùng Mậu, Bánh Mì Dân Tổ
      expect(counts.BAKERY_DESSERT).toBe(2); // Tous Les Jours Bakery, Chè Sầu Đà Nẵng
      expect(counts.BAR_BEER).toBe(1); // The Beer Club 88
      expect(counts.VEGETARIAN).toBe(1); // Cơm Chay Từ Tâm
      expect(counts.OTHER_FOOD).toBe(0); // All 20 venues mapped to specific canonical categories
    });
  });

  describe('4. Consumer Copy Leak Audit', () => {
    it('confirms rawCategorySlugLeakCount is exactly 0', () => {
      const allSlugs = [
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
      for (const slug of allSlugs) {
        const formatted = formatPreferenceName(slug);
        if (formatted.includes('_') || (formatted === slug && slug.toUpperCase() === slug)) {
          rawCategorySlugLeakCount++;
        }
      }

      expect(rawCategorySlugLeakCount).toBe(0);
    });
  });
});
